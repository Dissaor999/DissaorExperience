const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new DatabaseSync(DB_PATH);

// Helper para hashing seguro de contraseñas con salt
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, hash, salt) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// Definición canónica de los perfiles especiales (Rol: entrañable)
const ENTRANABLE_PROFILES = [
    {
        username: 'Alder',
        password: 'alder123',
        config: {
            character_name: "Irene Alder",
            archetype: "Alder",
            title: "Estratega & Contrainteligencia",
            status: "ocupado",
            irrepetible: true,
            theme_color: "#ffb86c",
            variables: {
                character_name: "Irene Alder",
                title: "Estratega & Contrainteligencia",
                catchphrase: "Buenas noches, señor Sherlock Holmes",
                signature: "Un plan maestro nunca deja cabos sueltos; los mejores secretos se ocultan a plena vista.",
                lore_location: "Brühl, Varsovia & Londres",
                lore_concept: "Disfraces de alta precisión, gabinete secreto y fuga impecable",
                lore_item: "Fotografía de gabinete y carta sellada con lacre",
                elemental_o_kadath: "un gambito impecable de Bohemia",
                comentario_forense: "Los hombres suelen buscar la fuerza bruta o el error evidente; yo busco lo que el culpable intentó disimular deliberadamente."
            },
            command_responses: {
                "bohemia": "El escándalo en Bohemia demostró que hasta la mente más brillante de Europa puede ser superada cuando subestima la intuición y el disfraz.",
                "disfraz": "Un abrigo de tweed masculino, paso ligero por la neblina y una despedida susurrada: 'Buenas noches, señor Sherlock Holmes'. La sorpresa es el arte supremo.",
                "escandalo": "Aquellos que ostentan poder siempre creen estar por encima de las consecuencias. Este expediente no es la excepción.",
                "irene": "Para Sherlock siempre seré 'La Mujer'. Para este sistema clasificado, soy quien custodia las evidencias que otros no supieron encontrar."
            },
            response_flavor: {
                prefix: "[INFORME PRIVADO // ALDER]: ",
                suffix: "<br><span style='color:#ffb86c; font-size:13px;'>[APUNTE DE ALDER]: \"Cualquier aficionado busca la evidencia ruidosa; la verdadera clave reside en la firma invisible de quien orquestó la escena.\"</span>",
                unrecognized: "[ALDER]: Movimiento impreciso. En el juego de contrainteligencia un comando en falso alerta al objetivo. Verifique con 'ayuda'."
            }
        }
    },
    {
        username: 'Holmes',
        password: 'holmes123',
        config: {
            character_name: "Sherlock Holmes",
            archetype: "Holmes",
            title: "Detective Consultor",
            status: "ocupado",
            irrepetible: true,
            theme_color: "#50fa7b",
            variables: {
                character_name: "Sherlock Holmes",
                title: "Detective Consultor",
                catchphrase: "Elemental",
                signature: "Elemental, mi querido Watson. Cuando eliminas lo imposible, lo que queda, por improbable que parezca, debe ser la verdad.",
                lore_location: "221B Baker Street, Londres",
                lore_concept: "La Ciencia de la Deducción y el análisis forense microscópico",
                lore_item: "Pipa de brezo, lupa de aumento y violín Stradivarius",
                elemental_o_kadath: "una deducción absolutamente Elemental",
                comentario_forense: "Elemental: el patrón de las huellas y la postura del sospechoso descartan por completo cualquier hipótesis accidental."
            },
            command_responses: {
                "elemental": "Elemental, absolutamente elemental. El hilo de la verdad nunca se rompe si se tira de él con estricta ratiocinación y método inductivo.",
                "deduccion": "Usted ve, Watson, pero no observa. La distinción es clara como el agua. Cada byte de este expediente tiene una historia forense que contar.",
                "baker street": "Baker Street 221B: el tabaco persa humea en la pipa de brezo, la niebla envuelve Londres y el juego ha comenzado.",
                "watson": "El buen doctor tomaría notas de esto para su próximo relato en el Strand Magazine. Pero nosotros debemos atenernos rigurosamente a las pruebas materiales.",
                "pipa": "Un problema de tres pipas. Recomiendo examinar la minuta y las imágenes antes de aventurar hipótesis apresuradas."
            },
            response_flavor: {
                prefix: "[DEDUCCIÓN FORENSE // HOLMES]: ",
                suffix: "<br><span style='color:#50fa7b; font-size:13px;'>[APUNTE HOLMES]: \"Elemental: ningún indicio es tan pequeño que no merezca ser analizado bajo la lupa.\"</span>",
                unrecognized: "[HOLMES]: Curioso... ese comando carece de base lógica en este registro. Recuerde: 'Es un error garrafal teorizar antes de disponer de datos'. Pruebe con 'ayuda'."
            }
        }
    },
    {
        username: 'Mycroft',
        password: 'mycroft123',
        config: {
            character_name: "Mycroft Holmes",
            archetype: "Mycroft",
            title: "El Cerebro del Gobierno Británico",
            status: "ocupado",
            irrepetible: true,
            theme_color: "#8be9fd",
            variables: {
                character_name: "Mycroft Holmes",
                title: "El Cerebro del Gobierno Británico",
                catchphrase: "El gobierno británico soy yo, en ocasiones.",
                signature: "Correr tras colillas de cigarrillos es un esfuerzo fútil cuando la correlación de datos de todos los ministerios ya arroja el resultado.",
                lore_location: "Salón del Silencio, Club Diógenes, Pall Mall",
                lore_concept: "Síntesis ministerial, omnisciencia sedentaria y alta seguridad de Estado",
                lore_item: "Portafolios con cordón de seda y el sillón orejero de Whitehall",
                elemental_o_kadath: "una cuestión de Estado de máxima reserva",
                comentario_forense: "Mi hermano menor Sherlock correría por el bosque buscando huellas. A mí me basta correlacionar las fechas y el transporte para resolver la causa."
            },
            command_responses: {
                "diogenes": "El Club Diógenes prohíbe hablar en todas sus salas. Quien no puede procesar los hechos en silencio no tiene cabida en los asuntos del Estado.",
                "whitehall": "Cuando dos ministerios discrepan y las cifras no cuadran, el asunto llega a mi mesa en Whitehall. La burocracia imperial no comete deslices.",
                "hermano": "Sherlock tiene la energía física y el entusiasmo juvenil; yo poseo la capacidad de sintetizar el tablero entero sin levantarme de mi butaca."
            },
            response_flavor: {
                prefix: "[DICTAMEN ESTATAL // MYCROFT]: ",
                suffix: "<br><span style='color:#8be9fd; font-size:13px;'>[DESPACHO MYCROFT]: \"Evite desgastes físicos innecesarios; cruce las variables con frialdad y el desenlace será inapelable.\"</span>",
                unrecognized: "[MYCROFT]: Entrada incongruente con los registros de la Corona. No dilapide el tiempo del gabinete; consulte 'ayuda'."
            }
        }
    },
    {
        username: 'Moriarty',
        password: 'moriarty123',
        config: {
            character_name: "Profesor James Moriarty",
            archetype: "Moriarty",
            title: "El Napoleón del Crimen",
            status: "ocupado",
            irrepetible: true,
            theme_color: "#ff5555",
            variables: {
                character_name: "Profesor James Moriarty",
                title: "El Napoleón del Crimen",
                catchphrase: "El centro de la telaraña",
                signature: "Permanezco inmóvil en el centro de la tela, pero esa tela tiene mil ramificaciones y conozco cada vibración de cada una de ellas.",
                lore_location: "Cátedra de Matemáticas / Cataratas de Reichenbach",
                lore_concept: "La Dinámica de un Asteroide y el crimen matemáticamente predeterminado",
                lore_item: "Tratado binomial, pizarra de cálculo diferencial y bastón estoque",
                elemental_o_kadath: "un cálculo matemático perfecto",
                comentario_forense: "Una mente ordinaria ve azar y tragedia; una mente matemática ve vectores de fuerza perfectamente calculados hacia un objetivo inexorable."
            },
            command_responses: {
                "matematicas": "Mi monografía sobre la Dinámica de un Asteroide es pura poesía matemática. Gobernar el bajo mundo londinense con esa misma precisión fue un mero corolario.",
                "reichenbach": "El rugido del agua helada en Reichenbach... Un duelo intelectual supremo al borde del abismo. Si es usted lo bastante listo para intentar destruirme, pagaré el precio con gusto.",
                "telaraña": "La araña jamás persigue a la mosca; se limita a tejer los hilos en el ángulo exacto donde la gravedad y el destino harán el trabajo."
            },
            response_flavor: {
                prefix: "[CÁLCULO DEL PROFESOR // MORIARTY]: ",
                suffix: "<br><span style='color:#ff5555; font-size:13px;'>[PROFESOR MORIARTY]: \"Si es usted lo bastante perspicaz para seguir mi rastro, recuerde que cada paso suyo ya figuraba en mi ecuación.\"</span>",
                unrecognized: "[MORIARTY]: Cálculo erróneo. En mi organización la falta de rigor se castiga sin contemplaciones. Corrija su fórmula con 'ayuda'."
            }
        }
    },
    {
        username: 'Dupin',
        password: 'dupin123',
        config: {
            character_name: "C. Auguste Dupin",
            archetype: "Dupin",
            title: "Caballero del Raciocinio Analítico",
            status: "ocupado",
            irrepetible: true,
            theme_color: "#8be9fd",
            variables: {
                character_name: "C. Auguste Dupin",
                title: "Caballero del Raciocinio Analítico",
                catchphrase: "Raciocinio analítico",
                signature: "Lo que es extraordinario confunde al intelecto común, cuando en verdad no hace sino iluminar el camino hacia la verdad.",
                lore_location: "Faubourg Saint-Germain & Rue Morgue, París",
                lore_concept: "Raciocinio en la penumbra de las bujías y psicología del adversario",
                lore_item: "Pipa de espuma de mar y anteojos verdes para la luz del mediodía",
                elemental_o_kadath: "un ejercicio clásico de raciocinio",
                comentario_forense: "El error del prefecto parisino siempre consistió en buscar lo misterioso donde solo había una verdad demasiado evidente para ser vista."
            },
            command_responses: {
                "morgue": "El crimen de la Rue Morgue conmocionó a París porque nadie comprendió el testimonio de las voces. Quien no escucha con mente libre jamás resolverá el misterio.",
                "carta robada": "La carta no estaba escondida en ningún compartimento secreto; colgaba de una cinta ajada bajo las narices de todos. La audacia reside en la simplicidad.",
                "raciocinio": "El verdadero analista juega a las damas, no al ajedrez. No se trata de calcular infinitas variantes, sino de identificarse con el alma del oponente."
            },
            response_flavor: {
                prefix: "[ANÁLISIS RATIOCINATIVO // DUPIN]: ",
                suffix: "<br><span style='color:#8be9fd; font-size:13px;'>[CABALLERO DUPIN]: \"No confunda la complicación externa con la profundidad interna. La verdad siempre busca la luz.\"</span>",
                unrecognized: "[DUPIN]: El raciocinio no encuentra asidero en esa expresión amorfa. Encienda una bujía y consulte 'ayuda'."
            }
        }
    },
    {
        username: 'Carter',
        password: 'carter123',
        config: {
            character_name: "Randolph Carter",
            archetype: "Carter",
            title: "Viajero de las Dimensiones Oníricas",
            status: "ocupado",
            irrepetible: true,
            theme_color: "#bd93f9",
            variables: {
                character_name: "Randolph Carter",
                title: "Viajero de las Dimensiones Oníricas",
                catchphrase: "Ph'nglui mglw'nafh",
                signature: "En la desconocida Kadath y en los abismos de R'lyeh se ocultan verdades que ningún mortal debería descifrar.",
                lore_location: "La desconocida Kadath y la sumergida R'lyeh",
                lore_concept: "Las Tierras del Sueño, los Antiguos y la Llave de Plata",
                lore_item: "La Llave de Plata y el Manuscrito Pnakótico",
                elemental_o_kadath: "las sombras ciclópeas de Kadath y los abismos de R'lyeh",
                comentario_forense: "Este indicio me eriza la piel: no pertenece a la lógica humana, sino a los horrores que moran más allá del muro del sueño."
            },
            command_responses: {
                "kadath": "Kadath la Desconocida se alza en el desierto helado donde no brilla ninguna estrella terrenal. He cruzado las Puertas del Sueño Profundo con la Llave de Plata; sus agujas de ónice aún proyectan sombras sobre mi alma.",
                "rlyeh": "R'lyeh... la pesadilla ciclópea de basalto y ángulos no euclidianos que reposa bajo las olas. 'Cthulhu fhtagn'. Incluso en estos expedientes forenses percibo la emanación nauseabunda de su letargo.",
                "rileh": "R'lyeh (o Rileh, como pronuncian temblorosos los pescadores de Innsmouth)... ciudad antediluviana sumergida. No pronuncies ese nombre a la ligera en terminales conectadas a la red.",
                "necronomicon": "El ejemplar encuadernado en piel humana de la Universidad de Miskatonic lo advierte en sus páginas carcomidas: 'No está muerto lo que puede yacer eternamente'.",
                "silver key": "La Llave de Plata vibra con una frecuencia cósmica. La cerradura entre dimensiones ha sido entreabierta."
            },
            response_flavor: {
                prefix: "[LORE ONÍRICO // CARTER]: ",
                suffix: "<br><span style='color:#bd93f9; font-size:13px;'>[SUSURRO DE CARTER]: \"Cuidado con indagar en lo profundo... las sombras de Kadath y los ecos de R'lyeh jamás olvidan a quien cruza el umbral.\"</span>",
                unrecognized: "[CARTER]: Ese comando resuena como una blasfemia ininteligible en los abismos de R'lyeh. Las sombras de Kadath se agitan... Escriba 'ayuda' si no desea perder la cordura en el laberinto."
            }
        }
    }
];

// Inicialización del esquema
function initDb() {
    db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            config_json TEXT,
            is_occupied INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            system_header TEXT,
            connection_msg TEXT,
            initial_hint TEXT,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL,
            command_pattern TEXT NOT NULL COLLATE NOCASE,
            response_type TEXT NOT NULL, /* text, decrypt_text, image, doc_embed, phase_trigger, clear */
            response_payload TEXT NOT NULL, /* texto o json con params (url, delay, exif, etc) */
            required_phase INTEGER DEFAULT 1,
            next_phase INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        /* Tabla de asignación de expedientes a operadores */
        CREATE TABLE IF NOT EXISTS user_cases (
            user_id INTEGER NOT NULL,
            case_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, case_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
        );
    `);

    // Migraciones seguras para columnas añadidas
    try { db.exec('ALTER TABLE users ADD COLUMN config_json TEXT;'); } catch (e) {}
    try { db.exec('ALTER TABLE users ADD COLUMN is_occupied INTEGER DEFAULT 0;'); } catch (e) {}

    // Crear usuario admin inicial si no existe
    const checkUser = db.prepare('SELECT count(*) as count FROM users WHERE role = ?').get('admin');
    if (checkUser.count === 0) {
        const { hash, salt } = hashPassword('admin1234');
        db.prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)').run('admin', hash, salt, 'admin');
        console.log('[DB] Usuario admin creado por defecto: admin / admin1234');
    }

    // Inicializar o sincronizar los 6 perfiles especiales con rol entrañable
    for (const profile of ENTRANABLE_PROFILES) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(profile.username);
        const jsonStr = JSON.stringify(profile.config, null, 2);
        if (!existing) {
            const { hash, salt } = hashPassword(profile.password);
            db.prepare(`
                INSERT INTO users (username, password_hash, salt, role, config_json, is_occupied)
                VALUES (?, ?, ?, 'entrañable', ?, 1)
            `).run(profile.username, hash, salt, jsonStr);
            console.log(`[DB] Operador entrañable registrado: ${profile.username} (rol: entrañable, ocupado: 1)`);
        } else {
            db.prepare(`
                UPDATE users 
                SET role = 'entrañable', config_json = ?, is_occupied = 1
                WHERE id = ?
            `).run(jsonStr, existing.id);
        }
    }

    // Crear caso inicial si no existe
    const checkCase = db.prepare('SELECT count(*) as count FROM cases').get();
    if (checkCase.count === 0) {
        db.prepare(`
            INSERT INTO cases (slug, title, system_header, connection_msg, initial_hint, active)
            VALUES (?, ?, ?, ?, ?, 1)
        `).run(
            'ted-1974',
            'CASO LAGO SAMMAMISH - 1974',
            'SISTEMA DE ARCHIVOS CLASIFICADOS V.1.03',
            'Conexión cifrada establecida.',
            "Escriba 'ayuda' para continuar."
        );

        const caseId = db.prepare('SELECT id FROM cases WHERE slug = ?').get('ted-1974').id;

        // Comandos del caso
        const insertCmd = db.prepare(`
            INSERT INTO commands (case_id, command_pattern, response_type, response_payload, required_phase, next_phase, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // ayuda fase 1
        insertCmd.run(
            caseId,
            'ayuda',
            'text',
            JSON.stringify({ text: "Comandos disponibles: <br>- ls (Listar archivos)<br>- leer [archivo]<br>- abrir [archivo]<br>- exif [archivo]<br>- doc [documento/álbum]<br>- perfil (Reporte forense del analista)<br>- clear (Limpiar pantalla)" }),
            1,
            0,
            1
        );

        // ayuda fase 2 (paranoia)
        insertCmd.run(
            caseId,
            'ayuda',
            'text',
            JSON.stringify({ text: "ACCESO DENEGADO. ¿Ayuda? Nadie te va a ayudar. Te he estado observando desde que abriste el archivo. Estás exactamente donde quiero que estés.", alert: true }),
            2,
            0,
            2
        );

        // ls
        insertCmd.run(
            caseId,
            'ls',
            'text',
            JSON.stringify({ text: "[LOCKED] rep_autopsia_01.pdf<br>[LOCKED] transcripcion_cinta_4.wav<br>[ACCESIBLE] minuta_policial_74.txt<br>[ACCESIBLE] doc expediente_completo" }),
            0,
            0,
            3
        );

        // leer minuta_policial_74.txt
        insertCmd.run(
            caseId,
            'leer minuta_policial_74.txt',
            'text',
            JSON.stringify({ text: "Reporte preliminar: 14 de julio, 1974. Sujeto masculino avistado en el área de picnic del lago. Vestía ropa clara y llevaba un yeso en el brazo izquierdo. Múltiples testigos confirman que solicitaba ayuda para descargar un velero. Vehículo sospechoso localizado en el perímetro oeste. Escriba 'abrir ted.jpeg' para visualizar el registro fotográfico de la escena." }),
            0,
            0,
            4
        );

        // abrir ted.jpeg (imagen con protección contra descargas)
        insertCmd.run(
            caseId,
            'abrir ted.jpeg',
            'image',
            JSON.stringify({ url: '/ted.jpeg', caption: 'Evidencia Fotográfica Clasificada - KODAK REF #04', delay: 2500 }),
            0,
            0,
            5
        );

        // exif ted.jpeg
        insertCmd.run(
            caseId,
            'exif ted.jpeg',
            'decrypt_text',
            JSON.stringify({
                delay: 1500,
                text: `-----------------------------------<br>
ARCHIVO_ORIGEN: ted.jpeg<br>
DISPOSITIVO:    KODAK_EVIDENCE_UNIT_04<br>
MARCA_TIEMPO:   1974:07:14 14:30:00<br>
LATITUD_GPS:    47.5597° N<br>
LONGITUD_GPS:   122.0661° W<br>
MENSAJE_OCULTO: "Tenía una sonrisa muy amable. Me preguntó si podía ayudarle con los libros. pass detective_dissaor"<br>
-----------------------------------`
            }),
            1,
            2, // pasa a fase 2
            6
        );

        // doc expediente_completo (Marco de Álbum Forense - Google Photos Picker)
        insertCmd.run(
            caseId,
            'doc expediente_completo',
            'doc_embed',
            JSON.stringify({
                title: "Expediente Digitalizado - Google Photos Picker & Álbum Forense",
                caption: "Marco de evidencias desclasificado. Protegido contra descarga y optimizado para pantalla completa.",
                photos: [
                    {
                        url: "/ted.jpeg",
                        title: "Evidencia KODAK #04 - Lago Sammamish 1974",
                        caption: "Sujeto avistado con yeso en el brazo izquierdo solicitando auxilio para maniobrar velero."
                    },
                    {
                        url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80",
                        title: "Minuta Forense - Protocolo de Necropsia 74-B",
                        caption: "Documento oficial del médico legista. Hallazgos preliminares y sellos judiciales."
                    },
                    {
                        url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
                        title: "Peritaje Balístico - Perímetro del Bosque Este",
                        caption: "Marcas periciales y levantamiento de evidencias en el sector de picnic."
                    }
                ]
            }),
            0,
            0,
            7
        );

        // unloock rep_autopsia_01.pdf detective_dissaor
        insertCmd.run(
            caseId,
            'unloock rep_autopsia_01.pdf detective_dissaor',
            'text',
            JSON.stringify({ text: "Felicidades detective encontraste la evidencia y resolviste este misterio, sigueme para mas @Dissaor999." }),
            0,
            0,
            8
        );

        console.log('[DB] Caso y comandos iniciales insertados con éxito.');
    }

    // Asignar tres perfiles especiales al expediente 'ted-1974' (Alder, Holmes, Carter)
    const theCase = db.prepare('SELECT id FROM cases WHERE slug = ?').get('ted-1974');
    if (theCase) {
        const specialThree = ['Alder', 'Holmes', 'Carter'];
        const assignStmt = db.prepare('INSERT OR IGNORE INTO user_cases (user_id, case_id) VALUES (?, ?)');
        for (const name of specialThree) {
            const userRow = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(name);
            if (userRow) {
                assignStmt.run(userRow.id, theCase.id);
            }
        }
    }

    // Asegurar comando 'perfil' con variables en el caso 1 para demostrar sustitución dinámica
    if (theCase) {
        const checkPerfilCmd = db.prepare('SELECT id FROM commands WHERE case_id = ? AND command_pattern = ?').get(theCase.id, 'perfil');
        if (!checkPerfilCmd) {
            db.prepare(`
                INSERT INTO commands (case_id, command_pattern, response_type, response_payload, required_phase, next_phase, sort_order)
                VALUES (?, ?, ?, ?, 0, 0, 99)
            `).run(
                theCase.id,
                'perfil',
                'text',
                JSON.stringify({
                    text: `<b>[DICTAMEN FORENSE DEL ANALISTA ASIGNADO]</b><br>
Operador en servicio: <b>{character_name}</b><br>
Rango / Especialidad: <i>{title}</i><br>
Sede & Coordenadas:   <b>{lore_location}</b><br>
Indicio contextual:   {elemental_o_kadath}<br>
Apunte pericial:      {comentario_forense}<br>
Sentencia icónica:    <i>"{signature}"</i>`
                })
            );
        }
    }
}

initDb();

module.exports = {
    db,
    hashPassword,
    verifyPassword,
    ENTRANABLE_PROFILES
};
