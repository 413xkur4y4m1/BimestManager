# Despliegue de la WEB en Hostinger (bimestmanager.com)

Esta guía cubre la **separación web / API**:

- **`api.bimestmanager.com`** → la API (backend) en Coolify. Solo responde
  peticiones (GET/POST...). Ya está desplegada.
- **`bimestmanager.com`** → la web estática en Hostinger: la **landing** (React)
  + el **sistema** (login y dashboards). Consume la API por `fetch`.

```
  bimestmanager.com            (Hostinger, public_html)
  ├─ /              index.html ............ Landing React
  ├─ /documentacion .............. Landing React
  ├─ /login         login.html ........... Sistema  ─┐ fetch con cookies
  ├─ /admin /maestro /estudiante ......... Sistema   │  hacia ↓
  └─ /turismo/admin /turismo/estudiante .. Sistema  ─┘
                                   ┌───────────────────────────────┐
  api.bimestmanager.com  ◄─────────┤ /auth /admin /maestro /turismo │ (Coolify)
                                   └───────────────────────────────┘
```

---

## Cómo funciona la conexión web → API

- Cada página del sistema incluye `<meta name="bm-api-base" content="https://api.bimestmanager.com">`
  y el script `js/api-base.js`.
- `api-base.js` **intercepta `fetch`**: toda llamada relativa del sistema
  (`/auth/login`, `/admin/...`, `/imageFirma/...`) se reenvía a la API con las
  **cookies incluidas**. No hubo que tocar las ~90 llamadas existentes.
- La cookie de sesión se comparte porque `bimestmanager.com` y
  `api.bimestmanager.com` son el **mismo dominio raíz** (con `COOKIE_DOMAIN=.bimestmanager.com`).

---

## Paso 1 — Variables que faltan en la API (Coolify)

En la **app de Coolify** agrega estas variables y haz **Redeploy**:

```
CORS_ORIGINS=https://bimestmanager.com,https://www.bimestmanager.com
COOKIE_DOMAIN=.bimestmanager.com
COOKIE_SAMESITE=lax
```

Sin esto, el navegador bloqueará las llamadas (CORS) y la cookie no se compartirá.

---

## Paso 2 — DNS de los dominios

En tu proveedor de DNS (o en Hostinger/Cloudflare):

| Subdominio | Tipo | Apunta a |
|---|---|---|
| `bimestmanager.com` (y `www`) | A / CNAME | **Hostinger** (IP del hosting) |
| `api.bimestmanager.com` | A / CNAME | **el servidor de Coolify** |

En Coolify, la app debe tener el dominio `https://api.bimestmanager.com` en
**Domains** (para que emita el certificado).

---

## Paso 3 — Generar la carpeta `public_html`

El sistema estático se genera con un script del repo. **Necesitas la landing
compilada** (`web/dist`) y este repositorio (rama `nube`).

```bash
# 1) Compila la landing (en la carpeta web/)
cd web
npm install        # solo la primera vez
npm run build      # genera web/dist

# 2) Genera el sitio completo (en la carpeta de la API / rama nube)
cd ../BimestManager
node scripts/build-static-web.js
```

Variables opcionales del build:

| Variable | Default | Para qué |
|---|---|---|
| `API_BASE` | `https://api.bimestmanager.com` | URL de la API |
| `OUT_DIR` | `./web-static` | Carpeta de salida |
| `WEB_DIST` | `../web/dist` | Build de la landing |

Ejemplo (Windows PowerShell) apuntando a una carpeta concreta:

```powershell
$env:OUT_DIR='C:\Users\TU_USUARIO\Downloads\_public_html'
$env:WEB_DIST='C:\ruta\a\web\dist'
node scripts/build-static-web.js
```

El resultado contiene: la landing (`index.html`, `documentacion.html`, ...),
el sistema (`login.html`, `admin.html`, `turismo/...`), `css/ js/ img/` y un
`.htaccess` con URLs limpias.

---

## Paso 4 — Subir a Hostinger

1. Entra a **hPanel → Administrador de archivos** (o por FTP).
2. Ve a la carpeta **`public_html`** del dominio `bimestmanager.com`.
3. **Sube todo el contenido** de la carpeta generada (no la carpeta en sí, sino
   lo de adentro: `index.html`, `login.html`, `assets/`, `css/`, `js/`, `img/`,
   `turismo/`, `.htaccess`, etc.).
4. Asegúrate de que el **`.htaccess`** quedó en la raíz de `public_html`
   (activa "mostrar archivos ocultos" si no lo ves).

> El `.htaccess` hace las URLs limpias: `/login` sirve `login.html`,
> `/turismo/admin` sirve `turismo/admin.html`, etc., y fuerza HTTPS.

---

## Paso 5 — Probar

1. `https://bimestmanager.com/` → debe cargar la **landing**.
2. `https://bimestmanager.com/login` → debe cargar el **login** del sistema.
3. Inicia sesión. En las herramientas del navegador (pestaña **Network**) debes
   ver las llamadas yendo a `https://api.bimestmanager.com/auth/...` con
   estado 200, y una cookie `bimest_token` con dominio `.bimestmanager.com`.
4. Tras el login te redirige a `/admin`, `/maestro` o `/estudiante` según el rol.

---

## Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| `CORS policy: No 'Access-Control-Allow-Origin'` | Falta `CORS_ORIGINS` en la API | Paso 1 + Redeploy |
| Login responde 200 pero `/admin` te regresa a `/login` | La cookie no se comparte | Verifica `COOKIE_DOMAIN=.bimestmanager.com` y que ambos sitios usen HTTPS |
| `/login` da 404 en Hostinger | Falta el `.htaccess` o no se subió | Sube el `.htaccess` a la raíz de `public_html` |
| Las firmas (imágenes) no cargan | `mi_firma_imagen` apunta al sitio | Ya resuelto: el sistema usa `BM_apiUrl()` para mandarlas a la API |
| Cambios no se ven | Caché del navegador | El `.htaccess` revalida HTML siempre; haz hard refresh (Ctrl+F5) |

---

## Actualizar la web (flujo recurrente)

Cada vez que cambie la landing o el sistema:

```bash
cd web && npm run build && cd ../BimestManager
node scripts/build-static-web.js
# y re-subes el contenido a public_html
```

> La **API** se actualiza por separado: push a la rama `nube` → Redeploy en Coolify.
