# SISTEMA DE ARCHIVOS CLASIFICADOS & ADMINISTRADOR FORENSE

Sistema interactivo de investigación criminal y expedientes con terminal forense, degradación de cordura/paranoia, panel de administración protegido, almacenamiento persistente en SQLite y visor de evidencias seguro sin posibilidad de descarga directa.

---

## 🚀 Cómo Iniciar el Servidor

1. Abre tu terminal de comandos en la carpeta del proyecto (`c:\dissaor\exp`):
```bash
node server.js
```
2. Abre en tu navegador:
   - **Terminal Forense (Público):** [http://localhost:3000](http://localhost:3000)
   - **Panel de Administración:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔑 Credenciales Iniciales y Acceso por Terminal

* **Usuario Administrador inicial:** `admin` / `admin1234` (acceso a todos los expedientes)
* **Operador Xolo:** `Xolo` / `xolo1234` (acceso asignado exclusivamente a **"Callejeando con los Xolos"**)

---

## 🎭 Perfiles Especiales: Operadores con Rol "Entrañable"

El sistema cuenta con **6 perfiles canónicos especiales**, los cuales **NO son administradores** y poseen el rol exclusivo **`entrañable`**. Están marcados como **`[OCUPADO - IRREPETIBLE]`** y cuentan con una configuración JSON dedicada con **variables heurísticas, respuestas personalizadas e inyección de personalidad** en los comandos.

Se asignaron inicialmente **tres perfiles especiales** al expediente principal **"CASO LAGO SAMMAMISH - 1974"**:
1. **Alder** (`login alder` / clave: `alder123`) — *Estratega & Contrainteligencia (Irene Adler)*
2. **Holmes** (`login holmes` / clave: `holmes123`) — *Detective Consultor (Sherlock Holmes)*
3. **Carter** (`login carter` / clave: `carter123`) — *Viajero de las Dimensiones Oníricas (Randolph Carter)*

Los otros tres perfiles entrañables también están listos en la red para ser asignados a otros casos o alternados:
4. **Mycroft** (`login mycroft` / clave: `mycroft123`) — *El Cerebro del Gobierno Británico (Club Diógenes / Whitehall)*
5. **Moriarty** (`login moriarty` / clave: `moriarty123`) — *El Napoleón del Crimen (Dinámica de Asteroides / Reichenbach)*
6. **Dupin** (`login dupin` / clave: `dupin123`) — *Caballero del Raciocinio Analítico (Rue Morgue / París)*

### Comportamiento Especial de los Operadores Entrañables:
* **Respuestas y lore temático único:**
  * **Carter** responde a `kadath`, `rlyeh`, `rileh`, `necronomicon`, etc., y añade susurros sobre Kadath y R'lyeh al examinar minutas o evidencias.
  * **Holmes** suelta deducciones con `elemental`, `deduccion`, `baker street`, etc., e inyecta apuntes analíticos al leer archivos.
  * **Alder** aporta notas de contrainteligencia, disfraces y el escándalo en Bohemia.
* **Variables dinámicas en los comandos:**
  * El comando `perfil` interpola automáticamente variables JSON como `{character_name}`, `{title}`, `{lore_location}`, `{comentario_forense}`, `{signature}` y `{elemental_o_kadath}` según el operador activo.
* **Irrepetibles y Ocupados:**
  * No pueden duplicarse en el sistema; su estado activo figura como `[OCUPADO - IRREPETIBLE]`.
* **Sin acceso administrativo:**
  * Intentar acceder al panel de administración `/admin` con un operador entrañable devuelve `403 Forbidden` y redirige a la terminal.
* **Comandos útiles en la terminal:**
  * `quiensoy` / `whoami`: Muestra el operador activo, rol, estado ocupado y su doctrina.
  * `perfiles` / `operadores`: Lista todos los perfiles entrañables disponibles y ocupados.
  * `logout`: Cierra la sesión activa del operador.
  * `login [nombre]`: Inicia sesión con el operador indicado.
* **Gestión en el Panel Admin (`/admin`):**
  * En la pestaña **"Operadores / Usuarios"**, los operadores entrañables tienen un botón **`⚙️ Config JSON`** que abre un editor para ajustar sus variables, respuestas y estado.

---

### Acceso directo desde la terminal:
Escribe en la línea de comandos de la terminal:
```bash
login carter
```
O para Holmes:
```bash
login holmes
```
El sistema detectará al operador y solicitará la clave de acceso.

---

## 🗂️ Comportamiento de Expedientes en la Cabecera

* **Si el operador tiene un solo expediente asignado:**
  En lugar de `[SECTOR FORENSE ACTIVO]` se mostrará automáticamente el título del expediente, por ejemplo:
  `[CALLEJEANDO CON LOS XOLOS]`
* **Si el operador tiene más de un expediente seleccionado:**
  Aparecerá un **SelectBox interactivo (`<select>`)** en la cabecera para alternar entre sus expedientes en tiempo real, actualizando la ambientación, textos y comandos de la terminal.

---

## ⚙️ Características Implementadas

1. **Backend en Node.js + Base de Datos SQLite**:
   - Persistencia completa en `database.sqlite` (usando el motor nativo `node:sqlite`).
   - Tablas para `cases` (historias/expedientes), `commands` (comandos y respuestas), `users` (operadores con contraseñas hasheadas con PBKDF2 y salt), `user_cases` (asignación de expedientes) y `sessions`.

2. **Módulo de Importación y Exportación de Comandos JSON**:
   - En la pestaña **"Comandos del Caso"** puedes subir un archivo `.json` con la lista de comandos autorizados para ese expediente.
   - Te permite elegir entre **anexar** los comandos nuevos o **reemplazar todos los existentes**.
   - Incluye botón **"Exportar Comandos JSON"** para descargar el paquete de comandos de cualquier expediente.
   - Archivo de ejemplo incluido: `ejemplo_comandos.json`.

3. **Control de Acceso por Operador y Expediente**:
   - Cada operador puede tener acceso exclusivo a uno o varios casos seleccionados.
   - **Los operadores no tienen acceso al panel de administración**: si intentan ingresar a `/admin` o consultar sus rutas protegidas, el backend les deniega el acceso (`403 Forbidden`).
   - Desde el panel de administración, el admin puede **asignar, cambiar y gestionar las contraseñas** de cualquier operador con el botón `🔑 Clave` para entregárselas directamente.

4. **Consola de Administración (`/admin`)**:
   - **Comandos del Caso**: Crea, edita y elimina comandos dinámicos. Define si responden con texto inmediato, descifrado progresivo `[████░░]`, imágenes protegidas o marcos de álbum compatibles con Google Photos Picker.
   - **Gestor de Fases**: Soporta cambio de fases de paranoia/degradación (por ejemplo, alterar las respuestas de `ayuda` al avanzar la investigación).
   - **Gestor de Expedientes**: Crea nuevas historias con sus propios encabezados y ambientación.
   - **Gestor de Operadores Entrañables y JSON**: Edita la configuración JSON heurística de cada operador entrañable (`variables`, `command_responses`, `response_flavor`).
   - **Subida de Imágenes**: Sube fotos directamente a la carpeta `uploads/`.
   - **Copia de Seguridad**: Exporta e importa la configuración completa en formato JSON con un clic.

5. **Marco de Álbum (Google Photos Picker API) y Superación de Bloqueo de iframes**:
   - Google bloquea la inserción en `<iframe>` mediante `X-Frame-Options: SAMEORIGIN` y CSP `frame-ancestors 'self'`.
   - El sistema implementa un **Marco de Álbum Forense** con integración directa para la **Google Photos Picker API** (`POST /api/photos/picker-session` y `GET /api/photos/picker-media`).
   - Los comandos `album` y `doc expediente_completo` despliegan un visor de diapositivas interactivo con carrusel de miniaturas y selector de evidencias forenses.
   - Cuenta con botón `📷 GOOGLE PHOTOS PICKER` para importar fotografías en tiempo real con tokens de sesión o enlaces directos.

6. **Visor a Pantalla Completa y Protección Integral Anti-Descarga**:
   - Al pulsar sobre cualquier fotografía o el botón `🔍 PANTALLA COMPLETA`, se activa el visor inmersivo a pantalla completa.
   - Navegación fluida mediante botones flotantes `❮` y `❯`, miniaturas o teclas de flecha (`ArrowLeft`, `ArrowRight`, `Escape`).
   - **Blindaje Anti-Descarga**:
     - Capa escudo invisible (*anti-download shield guard*) sobre todas las imágenes.
     - Bloqueo total de clic derecho (`contextmenu`) con aviso forense en pantalla.
     - Bloqueo de arrastre (`draggable="false"`, `-webkit-user-drag: none`, `user-select: none`).
     - Bloqueo de atajos de teclado del navegador: `Ctrl+S`, `Cmd+S`, `Ctrl+P`, `Ctrl+U`.
     - Marcas de agua forenses periciales con metadatos de custodia.

7. **Operadores Especiales ("Rol Entrañable")**:
   - 6 operadores legendarios con personalidades no administradoras (`role: 'entrañable'`), ocupados (`is_occupied: 1`) e irrepetibles:
     - **Carter** (`carter123`): Habla de las Tierras del Sueño de Kadath y la ciudad sumergida de R'lyeh.
     - **Holmes** (`holmes123`): Emplea deducción analítica y apuntes como *"Elemental, mi querido operador"*.
     - **Alder** (`alder123`): Irene Adler, inteligencia perspicaz y astucia teatral.
     - **Mycroft** (`mycroft123`): Visión geopolítica y frialdad institucional del Diogenes Club.
     - **Moriarty** (`moriarty123`): Genio matemático del crimen y cálculo de probabilidades.
     - **Dupin** (`dupin123`): El padre de la analítica forense y los misterios de la Rue Morgue.
   - Los 3 operadores activos en el caso `ted-1974` son **Alder**, **Holmes** y **Carter**.
   - Cada operador cuenta con su bloque `variables` en formato JSON (`{character_name}`, `{signature}`, `{lore_location}`, etc.) interpoladas dinámicamente en los comandos de terminal.
