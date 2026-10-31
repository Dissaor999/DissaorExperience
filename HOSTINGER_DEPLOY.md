# Guía de Despliegue en Hostinger (Node.js)

Este proyecto está construido con Node.js estándar y SQLite nativo (`node:sqlite`), por lo que **no requiere compilar dependencias pesadas ni instalar módulos C++ externos**.

---

## 💻 1. Probar en tu computadora local

1. Descomprime el archivo `sistema_expedientes.zip`.
2. Asegúrate de tener instalado Node.js (versión 22 o 24 recomendada). Puedes verificarlo abriendo una terminal y escribiendo:
   ```bash
   node -v
   ```
3. En la carpeta del proyecto, ejecuta:
   ```bash
   npm start
   # o bien:
   node server.js
   ```
4. Abre en tu navegador:
   - Terminal: `http://localhost:3000`
   - Admin: `http://localhost:3000/admin`
   - Credenciales: `admin` / `admin1234`
   - Operador Xolo: `Xolo` / `xolo1234`

---

## 🌐 2. Despliegue en Hostinger

Hostinger soporta Node.js tanto en sus planes de **Hosting Web Empresarial / Cloud (mediante el gestor "Node.js" de hPanel)** como en sus servidores **VPS**.

### Opción A: Hosting Compartido / Cloud (vía hPanel)

1. **Subir los archivos:**
   - Entra al **Administrador de Archivos** de Hostinger en tu dominio/subdominio.
   - Sube el archivo `sistema_expedientes.zip` y extráelo en la raíz de la aplicación (por ejemplo en `public_html/` o en una carpeta de aplicación designada).

2. **Configurar Node.js en hPanel:**
   - En el buscador de hPanel escribe y selecciona **Node.js**.
   - Presiona **Crear aplicación**:
     - **Versión de Node.js:** Selecciona Node.js 22.x o 24.x (o la versión más reciente disponible).
     - **Modo de aplicación:** `Production`.
     - **Directorio raíz de la aplicación:** La ruta donde subiste los archivos (ej. `public_html`).
     - **Archivo de inicio (Startup file):** Escribe `server.js`.
   - Haz clic en **Crear**.

3. **Iniciar la aplicación:**
   - En la sección de la aplicación Node.js, presiona **Iniciar** / **Restart Application**.
   - ¡Listo! Tu terminal forense y panel de administración ya estarán accesibles desde tu dominio público con HTTPS automático.

---

### Opción B: En un Servidor VPS de Hostinger (Ubuntu / Debian con PM2)

Si tienes un VPS en Hostinger:

1. **Subir los archivos mediante SCP o SFTP a tu VPS.**
2. **Instalar PM2 para mantener la app activa 24/7:**
   ```bash
   npm install -g pm2
   ```
3. **Iniciar el servidor:**
   ```bash
   cd /ruta/de/tu/proyecto
   pm2 start server.js --name "expedientes-forenses"
   pm2 save
   pm2 startup
   ```
4. **Configurar Nginx (Reverse Proxy):**
   Apunta tu dominio al puerto interno (por defecto `3000`) y activa el certificado SSL con Certbot:
   ```nginx
   server {
       server_name tudominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   ```bash
   sudo certbot --nginx -d tudominio.com
   ```

---

## 📁 Archivos Clave Incluidos
- `server.js`: Servidor HTTP y API. Lee el puerto de `process.env.PORT || 3000` (perfecto para Hostinger).
- `db.js`: Base de datos SQLite.
- `database.sqlite`: Base de datos con los casos configurados (*Caso Lago Sammamish 1974* y *Callejeando con los Xolos*).
- `public/`: Contiene `index.html` (terminal) y `admin.html` (panel de control).
- `uploads/`: Carpeta para almacenamiento de imágenes de evidencias subidas desde el admin.
