const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, hashPassword, verifyPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

// Helper para leer body JSON
function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 20 * 1024 * 1024) { // límite de 20MB
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (err) {
                resolve({ raw: body });
            }
        });
        req.on('error', reject);
    });
}

// Helper para responder JSON
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(data));
}

// Helper para interpolar variables tipo {variable} en strings y objetos
function interpolateVariables(text, variables) {
    if (!text || typeof text !== 'string' || !variables) return text;
    return text.replace(/\{([a-zA-Z0-9_\-]+)\}/g, (match, varName) => {
        if (variables[varName] !== undefined && variables[varName] !== null) {
            return String(variables[varName]);
        }
        return match;
    });
}

function interpolatePayload(payload, variables) {
    if (!payload || !variables) return payload;
    if (typeof payload === 'string') {
        return interpolateVariables(payload, variables);
    }
    if (typeof payload === 'object' && !Array.isArray(payload)) {
        const result = { ...payload };
        for (const [key, val] of Object.entries(result)) {
            if (typeof val === 'string') {
                result[key] = interpolateVariables(val, variables);
            } else if (typeof val === 'object' && val !== null) {
                result[key] = interpolatePayload(val, variables);
            }
        }
        return result;
    }
    return payload;
}

// Extractor automático de fotografías para álbumes públicos de Google Fotos
async function extractGooglePhotosAlbum(albumUrl) {
    if (!albumUrl) return null;
    const cleanUrl = albumUrl.trim();
    if (!cleanUrl.includes('photos.app.goo.gl') && !cleanUrl.includes('photos.google.com')) {
        return null;
    }

    try {
        const res = await fetch(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            redirect: 'follow'
        });

        if (!res.ok) return null;

        const html = await res.text();

        // Extraer título del álbum de og:title o <title>
        let title = '';
        const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (ogTitleMatch) {
            title = ogTitleMatch[1].replace(/·.*$/, '').trim();
        }

        // Extraer descripción de og:description
        let description = '';
        const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
        if (ogDescMatch) {
            description = ogDescMatch[1].trim();
        }

        // Coincidir con los tokens de fotos de Google Photos:
        // https://lh3.googleusercontent.com/pw/[A-Za-z0-9_-]+
        const rawPhotoMatches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+/g) || [];
        const uniqueBaseUrls = [...new Set(rawPhotoMatches)];

        if (uniqueBaseUrls.length === 0) return null;

        // Formatear fotos para el visor con alta resolución y miniaturas nítidas
        const photos = uniqueBaseUrls.map((baseUrl, idx) => ({
            url: `${baseUrl}=w1600-h1200-no`,
            thumbUrl: `${baseUrl}=w200-h150-c`,
            title: `Evidencia Fotográfica #${idx + 1}`,
            caption: description || 'Fotografía de archivo clasificado.'
        }));

        return {
            title,
            description,
            photos
        };
    } catch (err) {
        console.error('Error al extraer álbum de Google Fotos:', err.message);
        return null;
    }
}

// Autenticación de sesiones
function getAuthSession(req) {
    const authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else {
        // Buscar en cookies
        const cookieHeader = req.headers['cookie'];
        if (cookieHeader) {
            const match = cookieHeader.match(/session_token=([^;]+)/);
            if (match) token = match[1];
        }
    }
    if (!token) return null;

    const session = db.prepare(`
        SELECT s.token, s.user_id, s.username, u.role, u.is_occupied, u.config_json
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token);

    return session || null;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // CORS básico para desarrollo
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        // ==========================================
        // API PÚBLICA / TERMINAL
        // ==========================================

        // GET /api/case/current - Obtiene el caso activo o según operador/id
        if (method === 'GET' && pathname === '/api/case/current') {
            const requestedCaseId = parsedUrl.searchParams.get('case_id');
            const session = getAuthSession(req);

            let currentCase = null;
            if (requestedCaseId) {
                currentCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(requestedCaseId);
            } else if (session && session.role !== 'admin' && session.role !== 'superadmin') {
                // Si el operador logueado tiene casos asignados, tomar el primero de los suyos
                currentCase = db.prepare(`
                    SELECT c.* FROM cases c
                    JOIN user_cases uc ON uc.case_id = c.id
                    WHERE uc.user_id = ?
                    ORDER BY c.active DESC, c.id DESC LIMIT 1
                `).get(session.user_id);
            }

            if (!currentCase) {
                currentCase = db.prepare('SELECT * FROM cases WHERE active = 1 ORDER BY id DESC LIMIT 1').get();
            }
            if (!currentCase) {
                currentCase = db.prepare('SELECT * FROM cases ORDER BY id DESC LIMIT 1').get();
            }
            if (!currentCase) {
                return sendJSON(res, 404, { error: 'No hay expediente activo.' });
            }
            return sendJSON(res, 200, currentCase);
        }

        // GET /api/terminal/cases - Obtener los expedientes accesibles en la terminal (según sesión o públicos)
        if (method === 'GET' && pathname === '/api/terminal/cases') {
            const session = getAuthSession(req);
            let cases = [];

            if (!session) {
                // Sin sesión activa en terminal: expedientes disponibles
                cases = db.prepare('SELECT id, slug, title, active FROM cases ORDER BY active DESC, id DESC').all();
            } else if (session.role === 'admin' || session.role === 'superadmin') {
                // Admin ve todos
                cases = db.prepare('SELECT id, slug, title, active FROM cases ORDER BY active DESC, id DESC').all();
            } else {
                // Operador con casos específicos asignados
                cases = db.prepare(`
                    SELECT c.id, c.slug, c.title, c.active
                    FROM cases c
                    JOIN user_cases uc ON uc.case_id = c.id
                    WHERE uc.user_id = ?
                    ORDER BY c.id DESC
                `).all(session.user_id);
            }

            return sendJSON(res, 200, {
                session: session ? { username: session.username, role: session.role } : null,
                cases
            });
        }

        // ==========================================
        // GOOGLE PHOTOS PICKER API & MARCO DE ÁLBUM
        // ==========================================

        // POST /api/photos/picker-session - Iniciar sesión de Google Photos Picker
        if (method === 'POST' && pathname === '/api/photos/picker-session') {
            const body = await parseRequestBody(req);
            const { access_token } = body;

            if (access_token && !access_token.startsWith('mock_') && !access_token.startsWith('fake_') && !access_token.startsWith('test_')) {
                try {
                    // Llamada directa a Google Photos Picker API oficial
                    const gRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${access_token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const gData = await gRes.json();
                    return sendJSON(res, gRes.status, gData);
                } catch (err) {
                    console.error('[Google Photos Picker API Error]:', err.message);
                    return sendJSON(res, 502, { error: 'Fallo al enlazar con Google Photos Picker API: ' + err.message });
                }
            }

            // Modo Forense Local / Sesión Simulada para desarrollo y pruebas inmediatas
            const mockSessionId = 'gphotos_session_' + Date.now();
            return sendJSON(res, 200, {
                id: mockSessionId,
                pickerUri: `https://photos.google.com/picker/sample?sessionId=${mockSessionId}`,
                mediaItemsSet: true,
                isSimulated: true,
                message: 'Sesión de Google Photos Picker inicializada en el marco forense.'
            });
        }

        // GET /api/photos/picker-media - Obtener mediaItems seleccionados con Google Photos Picker
        if (method === 'GET' && pathname === '/api/photos/picker-media') {
            const sessionId = parsedUrl.searchParams.get('sessionId') || '';
            const accessToken = req.headers['x-google-access-token'] || '';

            if (accessToken && sessionId && !sessionId.startsWith('gphotos_session_')) {
                try {
                    const gRes = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    const gData = await gRes.json();
                    return sendJSON(res, gRes.status, gData);
                } catch (err) {
                    return sendJSON(res, 502, { error: 'Error al consultar items de Google Photos Picker: ' + err.message });
                }
            }

            // Evidencias fotográficas forenses de alta resolución predeterminadas
            const sampleEvidences = [
                {
                    id: 'evidence_01',
                    filename: 'ted_perimetro_04.jpeg',
                    title: 'Evidencia #01 - Registro Fotográfico del Perímetro',
                    caption: 'KODAK EVIDENCE UNIT #04. Sujeto masculino en zona de veleros (Lago Sammamish).',
                    baseUrl: '/ted.jpeg',
                    url: '/ted.jpeg'
                },
                {
                    id: 'evidence_02',
                    filename: 'minuta_forense_documento.jpg',
                    title: 'Evidencia #02 - Documentación de Necropsia 74-B',
                    caption: 'Protocolo pericial digitalizado desde el gabinete del médico forense.',
                    baseUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
                    url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80'
                },
                {
                    id: 'evidence_03',
                    filename: 'levantamiento_balistico.jpg',
                    title: 'Evidencia #03 - Peritaje del Área de Picnic',
                    caption: 'Levantamiento de rastros periciales y marcas de neumáticos en perímetro oeste.',
                    baseUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
                    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80'
                }
            ];

            return sendJSON(res, 200, {
                sessionId,
                mediaItems: sampleEvidences
            });
        }

        // POST /api/command - Ejecuta un comando en el caso actual
        if (method === 'POST' && pathname === '/api/command') {
            const body = await parseRequestBody(req);
            const { command, case_id, current_phase = 1, operator } = body;

            if (!command) {
                return sendJSON(res, 400, { error: 'Comando requerido' });
            }

            const cleanCmd = command.trim().toLowerCase();

            // Detectar operador activo: por sesión o enviado explícitamente
            const session = getAuthSession(req);
            let activeUser = null;
            if (session && session.user_id) {
                activeUser = db.prepare('SELECT id, username, role, config_json, is_occupied FROM users WHERE id = ?').get(session.user_id);
            } else if (operator) {
                activeUser = db.prepare('SELECT id, username, role, config_json, is_occupied FROM users WHERE username = ? COLLATE NOCASE').get(operator);
            }

            let entrañableConfig = null;
            if (activeUser && activeUser.role === 'entrañable' && activeUser.config_json) {
                try {
                    entrañableConfig = JSON.parse(activeUser.config_json);
                } catch (e) {
                    console.error('[SERVER] Error al parsear config_json de operador entrañable:', e);
                }
            }

            // Comando especial de login por terminal: login / operador / perfil / su [username]
            const loginMatch = cleanCmd.match(/^(?:login|operador|perfil|su)\s+([a-zA-Z0-9_\-\.]+)/i);
            if (loginMatch) {
                const username = loginMatch[1];
                const user = db.prepare('SELECT id, username, role, is_occupied FROM users WHERE username = ? COLLATE NOCASE').get(username);
                if (!user) {
                    return sendJSON(res, 200, {
                        type: 'text',
                        payload: {
                            text: `[DENEGADO] El operador '${username}' no está registrado en el protocolo de seguridad.`,
                            alert: true
                        }
                    });
                }

                let promptMsg = `[IDENTIFICACIÓN] Operador '${user.username}' detectado. Ingrese clave de acceso:`;
                if (user.role === 'entrañable') {
                    promptMsg = `[PROTOCOLO ENTRAÑABLE // PERFIL OCUPADO E IRREPETIBLE]<br>Operador especial '${user.username}' detectado. Ingrese clave de acceso:`;
                }

                return sendJSON(res, 200, {
                    type: 'login_prompt',
                    payload: {
                        username: user.username,
                        prompt: promptMsg
                    }
                });
            }

            // Comando especial: quiensoy / whoami
            if (cleanCmd === 'quiensoy' || cleanCmd === 'whoami') {
                if (activeUser) {
                    let ocupadoBadge = activeUser.is_occupied 
                        ? '<span style="color:#ffb86c; font-weight:bold;">[ESTADO: OCUPADO - IRREPETIBLE]</span>' 
                        : '<span style="color:#50fa7b;">[DISPONIBLE]</span>';
                    let extraInfo = '';
                    if (entrañableConfig) {
                        const vars = entrañableConfig.variables || {};
                        extraInfo = `<br>Título: <b>${entrañableConfig.title || 'Operador Especial'}</b>` +
                                    `<br>Doctrina / Lore: <i>${vars.lore_concept || vars.lore_location || 'Clasificado'}</i>` +
                                    `<br>Sentencia icónica: <span style="color:#72ef72;">"${vars.signature || vars.catchphrase || ''}"</span>`;
                    }
                    return sendJSON(res, 200, {
                        type: 'text',
                        payload: {
                            text: `[IDENTIDAD ACTIVA] Operador: <b>${activeUser.username.toUpperCase()}</b> | Rol: <b>${activeUser.role.toUpperCase()}</b> ${ocupadoBadge}${extraInfo}`,
                            alert: false
                        }
                    });
                } else {
                    return sendJSON(res, 200, {
                        type: 'text',
                        payload: {
                            text: `[CONEXIÓN ANÓNIMA] No hay un operador autenticado.<br>Escriba <b>login [operador]</b> (ej: <code>login carter</code> o <code>login holmes</code>) para identificarse, o <b>perfiles</b> para ver los operadores entrañables.`,
                            alert: false
                        }
                    });
                }
            }

            // Comando especial: perfiles / operadores
            if (cleanCmd === 'perfiles' || cleanCmd === 'operadores') {
                const entrañables = db.prepare("SELECT username, role, is_occupied, config_json FROM users WHERE role = 'entrañable' ORDER BY id ASC").all();
                let txt = `<b>=== PROTOCOLO FORENSE // OPERADORES ENTRAÑABLES ===</b><br>`;
                txt += `Estos operadores especiales no son administradores; poseen configuración JSON personalizada, variables heurísticas y respuestas únicas.<br><br>`;
                entrañables.forEach(op => {
                    let cfg = {};
                    try { cfg = JSON.parse(op.config_json); } catch(e){}
                    const statusTag = op.is_occupied ? '<span style="color:#ffb86c;">[OCUPADO - IRREPETIBLE]</span>' : '<span style="color:#50fa7b;">[DISPONIBLE]</span>';
                    const phrase = (cfg.variables && cfg.variables.catchphrase) ? ` — <i>"${cfg.variables.catchphrase}"</i>` : '';
                    txt += `• <b>${op.username}</b> (${cfg.title || 'Operador Especial'}) ${statusTag}${phrase}<br>`;
                });
                txt += `<br>Para acceder como un operador, ingrese: <b>login [nombre]</b> (ej: <code>login carter</code> o <code>login holmes</code>).`;
                return sendJSON(res, 200, {
                    type: 'text',
                    payload: { text: txt, alert: false }
                });
            }

            // Comando especial: logout
            if (cleanCmd === 'logout') {
                if (session) {
                    db.prepare('DELETE FROM sessions WHERE token = ?').run(session.token);
                }
                res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
                return sendJSON(res, 200, {
                    type: 'logout_action',
                    payload: {
                        text: `[SISTEMA] Sesión de operador cerrada correctamente. Retornando a consola de investigación anónima.`
                    }
                });
            }

            // Respuestas personalizadas del perfil entrañable (command_responses en su config_json)
            if (entrañableConfig && entrañableConfig.command_responses && entrañableConfig.command_responses[cleanCmd]) {
                let specialText = entrañableConfig.command_responses[cleanCmd];
                if (entrañableConfig.variables) {
                    specialText = interpolateVariables(specialText, entrañableConfig.variables);
                }
                return sendJSON(res, 200, {
                    type: 'text',
                    payload: {
                        text: specialText,
                        alert: false
                    }
                });
            }

            // Buscar en comandos de la base de datos
            // Primero buscar coincidencia exacta respetando fase actual
            let cmdRow = db.prepare(`
                SELECT * FROM commands 
                WHERE case_id = ? AND command_pattern = ? AND (required_phase = 0 OR required_phase = ?)
                ORDER BY required_phase DESC LIMIT 1
            `).get(case_id, cleanCmd, current_phase);

            // Si no encontró coincidencia exacta y no se filtró por fase, buscar genérico
            if (!cmdRow) {
                cmdRow = db.prepare(`
                    SELECT * FROM commands 
                    WHERE case_id = ? AND command_pattern = ?
                    ORDER BY required_phase DESC LIMIT 1
                `).get(case_id, cleanCmd);
            }

                if (cmdRow) {
                let payload = {};
                try {
                    payload = JSON.parse(cmdRow.response_payload);
                } catch {
                    payload = { text: cmdRow.response_payload };
                }

                // Si es un doc_embed con URL de Google Fotos, auto-sincronizar y recachear si hubo cambios en Google
                if (cmdRow.response_type === 'doc_embed' && payload.embedUrl) {
                    if (payload.embedUrl.includes('photos.app.goo.gl') || payload.embedUrl.includes('photos.google.com')) {
                        const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos de caché
                        const now = Date.now();
                        const lastSynced = payload.last_synced || 0;

                        if (!payload.photos || payload.photos.length === 0) {
                            // Primera vez o sin fotos: extracción síncrona
                            const albumData = await extractGooglePhotosAlbum(payload.embedUrl);
                            if (albumData && albumData.photos && albumData.photos.length > 0) {
                                payload.photos = albumData.photos;
                                payload.last_synced = now;
                                if (!payload.title || payload.title === 'Documento' || payload.title === 'Álbum de Evidencias Clasificadas') {
                                    payload.title = albumData.title || payload.title;
                                }
                                if (!payload.caption && albumData.description) {
                                    payload.caption = albumData.description;
                                }
                                try {
                                    db.prepare('UPDATE commands SET response_payload = ? WHERE id = ?').run(JSON.stringify(payload), cmdRow.id);
                                } catch (e) {}
                            }
                        } else if (now - lastSynced > CACHE_TTL_MS) {
                            // Si ya tiene fotos pero pasaron más de 30 min: responder de inmediato y refrescar en segundo plano
                            payload.last_synced = now;
                            extractGooglePhotosAlbum(payload.embedUrl).then(albumData => {
                                if (albumData && albumData.photos && albumData.photos.length > 0) {
                                    payload.photos = albumData.photos;
                                    payload.last_synced = Date.now();
                                    if (albumData.description) payload.caption = albumData.description;
                                    try {
                                        db.prepare('UPDATE commands SET response_payload = ? WHERE id = ?').run(JSON.stringify(payload), cmdRow.id);
                                    } catch (e) {}
                                }
                            }).catch(err => console.warn('Auto-sync Google Photos warn:', err.message));
                        }
                    }
                }

                // Interpolar variables dinámicas si el operador tiene variables en su JSON
                if (entrañableConfig && entrañableConfig.variables) {
                    payload = interpolatePayload(payload, entrañableConfig.variables);
                }

                // Si es un operador entrañable y la respuesta es de texto o desencriptación, enriquecer con sufijo de personaje
                if (entrañableConfig && entrañableConfig.response_flavor && (cmdRow.response_type === 'text' || cmdRow.response_type === 'decrypt_text')) {
                    if (payload.text && entrañableConfig.response_flavor.suffix && !payload.alert) {
                        payload.text = payload.text + entrañableConfig.response_flavor.suffix;
                    }
                }

                return sendJSON(res, 200, {
                    type: cmdRow.response_type,
                    payload: payload,
                    next_phase: cmdRow.next_phase || 0
                });
            }

            // Si el comando no se reconoció en la base de datos pero el operador tiene respuesta personalizada para no reconocidos
            if (entrañableConfig && entrañableConfig.response_flavor && entrañableConfig.response_flavor.unrecognized) {
                let unrecText = entrañableConfig.response_flavor.unrecognized;
                if (entrañableConfig.variables) {
                    unrecText = interpolateVariables(unrecText, entrañableConfig.variables);
                }
                return sendJSON(res, 200, {
                    type: 'text',
                    payload: {
                        text: unrecText,
                        alert: false
                    }
                });
            }

            // Guías temáticas para comandos lore si no está autenticado como ese operador
            if (cleanCmd === 'kadath' || cleanCmd === 'rlyeh' || cleanCmd === 'rileh') {
                return sendJSON(res, 200, {
                    type: 'text',
                    payload: {
                        text: `[SUSURRO ARCANO // KADATH & R'LYEH]<br>Se percibe una débil vibración dimensional. Para sintonizar plenamente con las Tierras del Sueño y los secretos sumergidos, inicie sesión con el operador <b>Carter</b> (<code>login carter</code>).`,
                        alert: false
                    }
                });
            }

            if (cleanCmd === 'elemental') {
                return sendJSON(res, 200, {
                    type: 'text',
                    payload: {
                        text: `[DEDUCCIÓN FORENSE // BAKER STREET]<br>"Elemental, pero incompleto. Para aplicar la ciencia deductiva en este expediente, inicie sesión con el operador <b>Holmes</b> (<code>login holmes</code>)."`,
                        alert: false
                    }
                });
            }

            // Comando no reconocido estándar
            return sendJSON(res, 200, {
                type: 'text',
                payload: {
                    text: `[!] Comando '${command.trim()}' no reconocido en el directorio forense. Escriba 'ayuda' para ver las opciones disponibles.`,
                    alert: false
                }
            });
        }

        // POST /api/login - Autenticación con contraseña
        if (method === 'POST' && pathname === '/api/login') {
            const body = await parseRequestBody(req);
            const { username, password } = body;

            if (!username || !password) {
                return sendJSON(res, 400, { error: 'Usuario y contraseña requeridos' });
            }

            const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
            if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
                return sendJSON(res, 401, { error: 'Clave de seguridad inválida o acceso restringido.' });
            }

            // Crear sesión (validez 7 días)
            const token = crypto.randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            db.prepare(`
                INSERT INTO sessions (token, user_id, username, expires_at)
                VALUES (?, ?, ?, ?)
            `).run(token, user.id, user.username, expires);

            res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
            return sendJSON(res, 200, {
                success: true,
                token,
                user: { id: user.id, username: user.username, role: user.role, is_occupied: user.is_occupied }
            });
        }

        // GET /api/session - Verificar sesión
        if (method === 'GET' && pathname === '/api/session') {
            const session = getAuthSession(req);
            if (!session) {
                return sendJSON(res, 401, { authenticated: false });
            }
            return sendJSON(res, 200, { authenticated: true, user: session });
        }

        // POST /api/logout
        if (method === 'POST' && pathname === '/api/logout') {
            const session = getAuthSession(req);
            if (session) {
                db.prepare('DELETE FROM sessions WHERE token = ?').run(session.token);
            }
            res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
            return sendJSON(res, 200, { success: true });
        }

        // ==========================================
        // RUTAS PROTEGIDAS DE ADMINISTRACIÓN
        // ==========================================
        if (pathname.startsWith('/api/admin/')) {
            const session = getAuthSession(req);
            if (!session) {
                return sendJSON(res, 401, { error: 'Acceso no autorizado. Inicie sesión con credenciales válidas.' });
            }

            // RESTRICCIÓN ESTRICTA: Los operadores no tienen acceso al panel de administración
            if (session.role !== 'admin' && session.role !== 'superadmin') {
                return sendJSON(res, 403, { error: 'ACCESO DENEGADO: El rol de Operador no tiene permisos en la consola administrativa.' });
            }

            // GET /api/admin/cases
            if (method === 'GET' && pathname === '/api/admin/cases') {
                let cases;
                if (session.role === 'superadmin' || session.role === 'admin') {
                    // Si es admin general ve todos los casos
                    cases = db.prepare('SELECT * FROM cases ORDER BY id DESC').all();
                } else {
                    // Si es un operador con acceso asignado
                    cases = db.prepare(`
                        SELECT c.* FROM cases c
                        JOIN user_cases uc ON uc.case_id = c.id
                        WHERE uc.user_id = ?
                        ORDER BY c.id DESC
                    `).all(session.user_id);
                }
                return sendJSON(res, 200, cases);
            }

            // POST /api/admin/cases - Crear caso
            if (method === 'POST' && pathname === '/api/admin/cases') {
                const body = await parseRequestBody(req);
                const { slug, title, system_header, connection_msg, initial_hint, active } = body;
                if (!slug || !title) {
                    return sendJSON(res, 400, { error: 'Slug y título son obligatorios' });
                }

                if (active) {
                    db.prepare('UPDATE cases SET active = 0').run();
                }

                const result = db.prepare(`
                    INSERT INTO cases (slug, title, system_header, connection_msg, initial_hint, active)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(slug.toLowerCase().trim(), title, system_header || '', connection_msg || '', initial_hint || '', active ? 1 : 0);

                return sendJSON(res, 201, { id: result.lastInsertRowid, message: 'Expediente creado' });
            }

            // PUT /api/admin/cases/:id - Editar caso
            const caseUpdateMatch = pathname.match(/^\/api\/admin\/cases\/(\d+)$/);
            if (method === 'PUT' && caseUpdateMatch) {
                const caseId = parseInt(caseUpdateMatch[1], 10);
                const body = await parseRequestBody(req);
                const { slug, title, system_header, connection_msg, initial_hint, active } = body;

                if (active) {
                    db.prepare('UPDATE cases SET active = 0 WHERE id != ?').run(caseId);
                }

                db.prepare(`
                    UPDATE cases 
                    SET slug = ?, title = ?, system_header = ?, connection_msg = ?, initial_hint = ?, active = ?
                    WHERE id = ?
                `).run(slug.toLowerCase().trim(), title, system_header, connection_msg, initial_hint, active ? 1 : 0, caseId);

                return sendJSON(res, 200, { message: 'Expediente actualizado' });
            }

            // DELETE /api/admin/cases/:id - Eliminar caso
            if (method === 'DELETE' && caseUpdateMatch) {
                const caseId = parseInt(caseUpdateMatch[1], 10);
                db.prepare('DELETE FROM cases WHERE id = ?').run(caseId);
                return sendJSON(res, 200, { message: 'Expediente eliminado' });
            }

            // POST /api/admin/resolve-album - Resolver y extraer fotos de un álbum público de Google Fotos
            if (method === 'POST' && pathname === '/api/admin/resolve-album') {
                const body = await parseRequestBody(req);
                const { albumUrl } = body;
                if (!albumUrl) return sendJSON(res, 400, { error: 'URL del álbum requerida' });

                const albumData = await extractGooglePhotosAlbum(albumUrl);
                if (!albumData || !albumData.photos || albumData.photos.length === 0) {
                    return sendJSON(res, 404, {
                        error: 'No se pudieron extraer fotografías de este enlace. Asegúrese de que el álbum de Google Fotos sea público ("Cualquiera con el enlace puede ver").'
                    });
                }

                return sendJSON(res, 200, {
                    success: true,
                    title: albumData.title,
                    description: albumData.description,
                    count: albumData.photos.length,
                    photos: albumData.photos
                });
            }

            // GET /api/admin/commands?case_id=X
            if (method === 'GET' && pathname === '/api/admin/commands') {
                const caseId = parseInt(parsedUrl.searchParams.get('case_id'), 10);
                if (!caseId) return sendJSON(res, 400, { error: 'case_id requerido' });

                // Verificar si el operador tiene permiso para este caso
                if (session.role !== 'admin' && session.role !== 'superadmin') {
                    const hasAccess = db.prepare('SELECT 1 FROM user_cases WHERE user_id = ? AND case_id = ?').get(session.user_id, caseId);
                    if (!hasAccess) {
                        return sendJSON(res, 403, { error: 'Acceso denegado a este expediente' });
                    }
                }

                const cmds = db.prepare('SELECT * FROM commands WHERE case_id = ? ORDER BY sort_order ASC, id ASC').all(caseId);
                return sendJSON(res, 200, cmds);
            }

            // POST /api/admin/commands - Crear comando
            if (method === 'POST' && pathname === '/api/admin/commands') {
                const body = await parseRequestBody(req);
                const { case_id, command_pattern, response_type, response_payload, required_phase = 0, next_phase = 0, sort_order = 0 } = body;

                if (!case_id || !command_pattern || !response_type) {
                    return sendJSON(res, 400, { error: 'Campos requeridos incompletos' });
                }

                if (session.role !== 'admin' && session.role !== 'superadmin') {
                    const hasAccess = db.prepare('SELECT 1 FROM user_cases WHERE user_id = ? AND case_id = ?').get(session.user_id, parseInt(case_id, 10));
                    if (!hasAccess) {
                        return sendJSON(res, 403, { error: 'No tienes autorización para modificar este expediente' });
                    }
                }

                let finalPayload = typeof response_payload === 'string' ? JSON.parse(response_payload || '{}') : (response_payload || {});
                if (response_type === 'doc_embed' && finalPayload.embedUrl && (!finalPayload.photos || finalPayload.photos.length === 0)) {
                    if (finalPayload.embedUrl.includes('photos.app.goo.gl') || finalPayload.embedUrl.includes('photos.google.com')) {
                        const albumData = await extractGooglePhotosAlbum(finalPayload.embedUrl);
                        if (albumData && albumData.photos && albumData.photos.length > 0) {
                            finalPayload.photos = albumData.photos;
                            if (!finalPayload.title || finalPayload.title === 'Documento' || finalPayload.title === 'Álbum de Evidencias Clasificadas') {
                                finalPayload.title = albumData.title || finalPayload.title;
                            }
                            if (!finalPayload.caption && albumData.description) {
                                finalPayload.caption = albumData.description;
                            }
                        }
                    }
                }

                const payloadStr = typeof finalPayload === 'object' ? JSON.stringify(finalPayload) : finalPayload;

                const result = db.prepare(`
                    INSERT INTO commands (case_id, command_pattern, response_type, response_payload, required_phase, next_phase, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(case_id, command_pattern.trim().toLowerCase(), response_type, payloadStr, required_phase, next_phase, sort_order);

                return sendJSON(res, 201, { id: result.lastInsertRowid, message: 'Comando registrado' });
            }

            // PUT /api/admin/commands/:id - Editar comando
            const cmdUpdateMatch = pathname.match(/^\/api\/admin\/commands\/(\d+)$/);
            if (method === 'PUT' && cmdUpdateMatch) {
                const cmdId = parseInt(cmdUpdateMatch[1], 10);
                const body = await parseRequestBody(req);
                const { command_pattern, response_type, response_payload, required_phase = 0, next_phase = 0, sort_order = 0 } = body;

                let finalPayload = typeof response_payload === 'string' ? JSON.parse(response_payload || '{}') : (response_payload || {});
                if (response_type === 'doc_embed' && finalPayload.embedUrl && (!finalPayload.photos || finalPayload.photos.length === 0)) {
                    if (finalPayload.embedUrl.includes('photos.app.goo.gl') || finalPayload.embedUrl.includes('photos.google.com')) {
                        const albumData = await extractGooglePhotosAlbum(finalPayload.embedUrl);
                        if (albumData && albumData.photos && albumData.photos.length > 0) {
                            finalPayload.photos = albumData.photos;
                            if (!finalPayload.title || finalPayload.title === 'Documento' || finalPayload.title === 'Álbum de Evidencias Clasificadas') {
                                finalPayload.title = albumData.title || finalPayload.title;
                            }
                            if (!finalPayload.caption && albumData.description) {
                                finalPayload.caption = albumData.description;
                            }
                        }
                    }
                }

                const payloadStr = typeof finalPayload === 'object' ? JSON.stringify(finalPayload) : finalPayload;

                db.prepare(`
                    UPDATE commands
                    SET command_pattern = ?, response_type = ?, response_payload = ?, required_phase = ?, next_phase = ?, sort_order = ?
                    WHERE id = ?
                `).run(command_pattern.trim().toLowerCase(), response_type, payloadStr, required_phase, next_phase, sort_order, cmdId);

                return sendJSON(res, 200, { message: 'Comando actualizado' });
            }

            // DELETE /api/admin/commands/:id
            if (method === 'DELETE' && cmdUpdateMatch) {
                const cmdId = parseInt(cmdUpdateMatch[1], 10);
                db.prepare('DELETE FROM commands WHERE id = ?').run(cmdId);
                return sendJSON(res, 200, { message: 'Comando eliminado' });
            }

            // GET /api/admin/users - Listar operadores y sus casos asignados
            if (method === 'GET' && pathname === '/api/admin/users') {
                const users = db.prepare('SELECT id, username, role, config_json, is_occupied, created_at FROM users ORDER BY id ASC').all();
                // Adjuntar los IDs de los casos asignados a cada usuario
                const userCases = db.prepare('SELECT user_id, case_id FROM user_cases').all();
                const usersWithCases = users.map(u => {
                    const assigned = userCases.filter(uc => uc.user_id === u.id).map(uc => uc.case_id);
                    return { ...u, assigned_cases: assigned };
                });
                return sendJSON(res, 200, usersWithCases);
            }

            // POST /api/admin/users - Crear nuevo operador
            if (method === 'POST' && pathname === '/api/admin/users') {
                const body = await parseRequestBody(req);
                const { username, password, role = 'operator', assigned_cases = [], config_json = null, is_occupied = null } = body;
                if (!username || !password) {
                    return sendJSON(res, 400, { error: 'Usuario y clave requeridos' });
                }

                // Perfiles irrepetibles: verificar duplicado
                const checkExisting = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
                if (checkExisting) {
                    return sendJSON(res, 400, { error: `El operador '${username.trim()}' ya existe. Los perfiles son irrepetibles.` });
                }

                const finalOccupied = is_occupied !== null ? (is_occupied ? 1 : 0) : (role === 'entrañable' ? 1 : 0);
                const { hash, salt } = hashPassword(password);
                try {
                    const resUser = db.prepare(`
                        INSERT INTO users (username, password_hash, salt, role, config_json, is_occupied)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(username.trim(), hash, salt, role, config_json, finalOccupied);
                    const newUserId = resUser.lastInsertRowid;

                    // Asignar expedientes seleccionados
                    if (Array.isArray(assigned_cases) && assigned_cases.length > 0) {
                        const insertUserCase = db.prepare('INSERT OR IGNORE INTO user_cases (user_id, case_id) VALUES (?, ?)');
                        for (const caseId of assigned_cases) {
                            insertUserCase.run(newUserId, parseInt(caseId, 10));
                        }
                    }

                    return sendJSON(res, 201, { message: 'Operador registrado con éxito' });
                } catch (err) {
                    return sendJSON(res, 400, { error: 'Error al registrar operador: ' + err.message });
                }
            }

            // PUT /api/admin/users/:id/config - Actualizar configuración JSON y estado de operador
            const userConfigMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/config$/);
            if (method === 'PUT' && userConfigMatch) {
                const userId = parseInt(userConfigMatch[1], 10);
                const body = await parseRequestBody(req);
                const { config_json, is_occupied } = body;

                const targetUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
                if (!targetUser) {
                    return sendJSON(res, 404, { error: 'Operador no encontrado' });
                }

                let configStr = config_json;
                if (typeof config_json === 'object' && config_json !== null) {
                    configStr = JSON.stringify(config_json, null, 2);
                } else if (typeof config_json === 'string') {
                    try {
                        JSON.parse(config_json);
                    } catch (e) {
                        return sendJSON(res, 400, { error: 'Formato JSON inválido: ' + e.message });
                    }
                }

                const occupiedVal = is_occupied !== undefined ? (is_occupied ? 1 : 0) : 1;
                db.prepare('UPDATE users SET config_json = ?, is_occupied = ? WHERE id = ?').run(configStr, occupiedVal, userId);

                return sendJSON(res, 200, {
                    message: `Configuración JSON actualizada con éxito para el operador '${targetUser.username}'`,
                    is_occupied: occupiedVal
                });
            }

            // PUT /api/admin/users/:id/password - Cambiar contraseña de un operador desde el admin
            const userPwdMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/password$/);
            if (method === 'PUT' && userPwdMatch) {
                const userId = parseInt(userPwdMatch[1], 10);
                const body = await parseRequestBody(req);
                const { password } = body;

                if (!password || password.trim().length === 0) {
                    return sendJSON(res, 400, { error: 'La nueva contraseña no puede estar vacía' });
                }

                const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
                if (!targetUser) {
                    return sendJSON(res, 404, { error: 'Usuario no encontrado' });
                }

                const { hash, salt } = hashPassword(password);
                db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);

                return sendJSON(res, 200, {
                    message: `Contraseña actualizada para el operador '${targetUser.username}'`
                });
            }

            // PUT /api/admin/users/:id/cases - Actualizar asignación de casos de un operador
            const userCasesMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/cases$/);
            if (method === 'PUT' && userCasesMatch) {
                const userId = parseInt(userCasesMatch[1], 10);
                const body = await parseRequestBody(req);
                const { assigned_cases = [], role } = body;

                if (role) {
                    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
                }

                db.prepare('DELETE FROM user_cases WHERE user_id = ?').run(userId);
                if (Array.isArray(assigned_cases)) {
                    const insertUc = db.prepare('INSERT OR IGNORE INTO user_cases (user_id, case_id) VALUES (?, ?)');
                    for (const cid of assigned_cases) {
                        insertUc.run(userId, parseInt(cid, 10));
                    }
                }
                return sendJSON(res, 200, { message: 'Permisos de expediente actualizados' });
            }

            // DELETE /api/admin/users/:id - Eliminar operador
            const userDeleteMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
            if (method === 'DELETE' && userDeleteMatch) {
                const userId = parseInt(userDeleteMatch[1], 10);
                if (userId === session.user_id) {
                    return sendJSON(res, 400, { error: 'No puede eliminarse a sí mismo' });
                }
                db.prepare('DELETE FROM users WHERE id = ?').run(userId);
                return sendJSON(res, 200, { message: 'Operador eliminado' });
            }

            // POST /api/admin/import-commands - Importar JSON de comandos a un expediente
            if (method === 'POST' && pathname === '/api/admin/import-commands') {
                const body = await parseRequestBody(req);
                const { case_id, commands = [], replace_existing = false } = body;

                if (!case_id) {
                    return sendJSON(res, 400, { error: 'case_id es requerido' });
                }

                const cid = parseInt(case_id, 10);

                if (session.role !== 'admin' && session.role !== 'superadmin') {
                    const hasAccess = db.prepare('SELECT 1 FROM user_cases WHERE user_id = ? AND case_id = ?').get(session.user_id, cid);
                    if (!hasAccess) {
                        return sendJSON(res, 403, { error: 'No tienes autorización para importar comandos en este expediente' });
                    }
                }

                if (!Array.isArray(commands) || commands.length === 0) {
                    return sendJSON(res, 400, { error: 'El archivo JSON no contiene una lista de comandos válida' });
                }

                db.exec('BEGIN TRANSACTION;');
                try {
                    if (replace_existing) {
                        db.prepare('DELETE FROM commands WHERE case_id = ?').run(cid);
                    }

                    const insertCmd = db.prepare(`
                        INSERT INTO commands (case_id, command_pattern, response_type, response_payload, required_phase, next_phase, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);

                    let insertedCount = 0;
                    for (const cmd of commands) {
                        // Soportar tanto formato del sistema como formato simplificado:
                        // { command: "ls", type: "text", response: "...", phase: 1, next_phase: 0 }
                        const pattern = (cmd.command_pattern || cmd.command || cmd.cmd || '').trim().toLowerCase();
                        if (!pattern) continue;

                        const type = cmd.response_type || cmd.type || 'text';
                        
                        let payload = cmd.response_payload || cmd.response || cmd.payload || {};
                        if (typeof payload === 'string' && (type === 'text' || type === 'decrypt_text')) {
                            try {
                                // ver si ya era string json
                                JSON.parse(payload);
                            } catch {
                                payload = { text: payload, alert: !!cmd.alert };
                            }
                        }
                        const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;

                        const reqPhase = parseInt(cmd.required_phase !== undefined ? cmd.required_phase : (cmd.phase || 0), 10) || 0;
                        const nextPhase = parseInt(cmd.next_phase || 0, 10) || 0;
                        const sortOrder = parseInt(cmd.sort_order || insertedCount + 1, 10);

                        insertCmd.run(cid, pattern, type, payloadStr, reqPhase, nextPhase, sortOrder);
                        insertedCount++;
                    }

                    db.exec('COMMIT;');
                    return sendJSON(res, 200, {
                        message: `Se importaron ${insertedCount} comandos exitosamente al expediente.`,
                        count: insertedCount
                    });
                } catch (err) {
                    db.exec('ROLLBACK;');
                    return sendJSON(res, 500, { error: 'Fallo al procesar comandos: ' + err.message });
                }
            }

            // GET /api/admin/export-commands?case_id=X - Exportar JSON de comandos de un expediente
            if (method === 'GET' && pathname === '/api/admin/export-commands') {
                const caseId = parseInt(parsedUrl.searchParams.get('case_id'), 10);
                if (!caseId) return sendJSON(res, 400, { error: 'case_id requerido' });

                const theCase = db.prepare('SELECT slug, title FROM cases WHERE id = ?').get(caseId);
                const cmds = db.prepare('SELECT command_pattern, response_type, response_payload, required_phase, next_phase, sort_order FROM commands WHERE case_id = ? ORDER BY sort_order ASC, id ASC').all(caseId);

                const formatted = cmds.map(c => {
                    let parsedPayload;
                    try { parsedPayload = JSON.parse(c.response_payload); } catch { parsedPayload = c.response_payload; }
                    return {
                        command: c.command_pattern,
                        type: c.response_type,
                        response: parsedPayload,
                        required_phase: c.required_phase,
                        next_phase: c.next_phase,
                        sort_order: c.sort_order
                    };
                });

                return sendJSON(res, 200, {
                    case_slug: theCase ? theCase.slug : 'caso',
                    case_title: theCase ? theCase.title : '',
                    total_commands: formatted.length,
                    commands: formatted
                });
            }

            // POST /api/admin/upload-image - Subida de imágenes en Base64
            if (method === 'POST' && pathname === '/api/admin/upload-image') {
                const body = await parseRequestBody(req);
                const { filename, base64Data } = body;
                if (!base64Data || !filename) {
                    return sendJSON(res, 400, { error: 'Datos de imagen requeridos' });
                }

                const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');
                const safeName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9_\.-]/g, '_');
                const targetPath = path.join(UPLOADS_DIR, safeName);
                fs.writeFileSync(targetPath, buffer);

                return sendJSON(res, 200, {
                    url: `/uploads/${safeName}`,
                    message: 'Imagen subida exitosamente'
                });
            }

            // GET /api/admin/export - Respaldar todo en JSON
            if (method === 'GET' && pathname === '/api/admin/export') {
                const allCases = db.prepare('SELECT * FROM cases').all();
                const allCommands = db.prepare('SELECT * FROM commands').all();
                return sendJSON(res, 200, { cases: allCases, commands: allCommands, exported_at: new Date().toISOString() });
            }

            // POST /api/admin/import - Restaurar respaldo JSON
            if (method === 'POST' && pathname === '/api/admin/import') {
                const body = await parseRequestBody(req);
                const { cases = [], commands = [] } = body;
                
                db.exec('BEGIN TRANSACTION;');
                try {
                    for (const c of cases) {
                        db.prepare(`
                            INSERT INTO cases (slug, title, system_header, connection_msg, initial_hint, active)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(slug) DO UPDATE SET 
                                title=excluded.title, 
                                system_header=excluded.system_header,
                                connection_msg=excluded.connection_msg,
                                initial_hint=excluded.initial_hint,
                                active=excluded.active
                        `).run(c.slug, c.title, c.system_header, c.connection_msg, c.initial_hint, c.active ? 1 : 0);
                    }
                    db.exec('COMMIT;');
                    return sendJSON(res, 200, { message: 'Datos importados correctamente' });
                } catch (e) {
                    db.exec('ROLLBACK;');
                    return sendJSON(res, 500, { error: 'Fallo al importar: ' + e.message });
                }
            }
        }

        // ==========================================
        // ARCHIVOS ESTÁTICOS Y ASSETS
        // ==========================================
        let filePath = '';
        if (pathname.startsWith('/uploads/')) {
            const fileName = path.basename(pathname);
            filePath = path.join(UPLOADS_DIR, fileName);
        } else if (pathname === '/' || pathname === '/index.html') {
            filePath = path.join(PUBLIC_DIR, 'index.html');
        } else if (pathname === '/admin' || pathname === '/admin.html') {
            filePath = path.join(PUBLIC_DIR, 'admin.html');
        } else {
            const cleanPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
            filePath = path.join(PUBLIC_DIR, cleanPath);
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';

            // Para imágenes, agregamos cabeceras de seguridad que dificultan guardarlas o incrustarlas fuera
            const headers = { 'Content-Type': mime };
            if (ext.match(/\.(jpeg|jpg|png|webp|gif)$/i)) {
                headers['Content-Disposition'] = 'inline';
                headers['X-Content-Type-Options'] = 'nosniff';
            }

            res.writeHead(200, headers);
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        // Si no se encuentra
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Archivo No Encontrado - Acceso Clasificado');

    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error interno del servidor forense' }));
    }
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(` SISTEMA DE ARCHIVOS CLASIFICADOS EN LÍNEA`);
        console.log(` Terminal:       http://localhost:${PORT}`);
        console.log(` Administración: http://localhost:${PORT}/admin`);
        console.log(` Operador root:  admin / admin1234`);
        console.log(` Comando login:  login admin`);
        console.log(` Base de datos:  SQLite (${path.join(__dirname, 'database.sqlite')})`);
        console.log(`=======================================================`);
    });
}

module.exports = { server };
