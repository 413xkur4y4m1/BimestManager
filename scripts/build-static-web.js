// ============================================================
// build-static-web.js — Genera el sitio estatico para Hostinger
// ============================================================
// Arma una carpeta lista para subir a public_html que contiene:
//   * La landing React ya compilada (web/dist)
//   * El sistema (login + dashboards) renderizado de EJS a HTML estatico
//   * Los assets del sistema (public/: css, js, img)
//   * Un .htaccess con URLs limpias (/login -> login.html) + cache
//
// Todas las llamadas del sistema apuntan a la API (api.bimestmanager.com)
// gracias al <meta name="bm-api-base"> que se inyecta aqui + js/api-base.js.
//
// Uso:
//   node scripts/build-static-web.js
// Variables opcionales:
//   API_BASE   URL de la API           (def: https://api.bimestmanager.com)
//   OUT_DIR    carpeta de salida        (def: ../web-static)
//   WEB_DIST   build de la landing      (def: ../../web/dist)
//   SITE_DOMAIN dominio del sitio       (def: bimestmanager.com) [solo informativo]
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API_BASE = (process.env.API_BASE || 'https://api.bimestmanager.com').replace(/\/+$/, '');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'web-static');
const WEB_DIST = process.env.WEB_DIST || path.join(ROOT, '..', 'web', 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');
const VISTA_DIR = path.join(ROOT, 'vista');

// ---------- Mini-renderer EJS (sin dependencias) ----------
// Soporta lo que usan las vistas: <%= %>, <%- %>, <% %>, <%# %> e include().
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function compile(src) {
  let body = "var __o='';\nwith(__locals){\n";
  const re = /<%(=|-|#)?([\s\S]*?)%>/g;
  let last = 0;
  let m;
  const pushText = (t) => { if (t) body += '__o+=' + JSON.stringify(t) + ';\n'; };
  while ((m = re.exec(src))) {
    pushText(src.slice(last, m.index));
    last = re.lastIndex;
    const type = m[1];
    let code = m[2];
    if (code.charCodeAt(code.length - 1) === 45 /* '-' slurp */) code = code.slice(0, -1);
    if (type === '=') body += '__o+=escapeHtml(' + code + ');\n';
    else if (type === '-') body += '__o+=(' + code + ');\n';
    else if (type === '#') { /* comentario */ }
    else body += code + '\n';
  }
  pushText(src.slice(last));
  body += '}\nreturn __o;';
  // eslint-disable-next-line no-new-func
  return new Function('__locals', 'escapeHtml', body);
}

function renderFile(file, extra) {
  const src = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const locals = Object.assign({}, extra);
  locals.include = (p, data) => {
    const inc = path.resolve(dir, p.endsWith('.ejs') ? p : p + '.ejs');
    return renderFile(inc, Object.assign({}, locals, data || {}));
  };
  return compile(src)(locals, escapeHtml);
}

// ---------- Utilidades de copia ----------
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

// ---------- Build ----------
const paginas = [
  { vista: 'auth/login.ejs', salida: 'login.html' },
  { vista: 'auth/registro.ejs', salida: 'registro.html' },
  { vista: 'estudiante.ejs', salida: 'estudiante.html' },
  { vista: 'maestro.ejs', salida: 'maestro.html' },
  { vista: 'admin.ejs', salida: 'admin.html' },
  { vista: 'turismo/estudiante.ejs', salida: 'turismo/estudiante.html' },
  { vista: 'turismo/admin.ejs', salida: 'turismo/admin.html' }
];

const HTACCESS = `# ============================================================
#  BimestManager - sitio estatico (Hostinger / Apache)
#  Generado por scripts/build-static-web.js - NO editar a mano.
# ============================================================

RewriteEngine On

# Pagina 404 propia (reemplaza la default de Hostinger)
ErrorDocument 404 /404.html

# Forzar HTTPS (a prueba de proxy: si el proxy ya entrega por https, no redirige)
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# URLs limpias: /login -> login.html, /turismo/admin -> turismo/admin.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]

# MIME correctos. Los ES modules de Vite (type="module") NO se ejecutan si el
# servidor manda el .js como text/plain -> pagina en blanco. Esto lo evita.
<IfModule mod_mime.c>
  AddType application/javascript .js
  AddType application/javascript .mjs
  AddType text/css .css
  AddType image/svg+xml .svg
</IfModule>

# Compresion
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>

<IfModule mod_headers.c>
  # HTML: revalidar siempre (cambios visibles al instante)
  <FilesMatch "\\.html$">
    Header set Cache-Control "no-cache, must-revalidate, max-age=0"
  </FilesMatch>
  # Imagenes de nombre fijo: revalidar siempre
  <FilesMatch "\\.(png|jpe?g|gif|svg|ico|webp)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
  # Assets con hash (main-XXXX.js/.css): inmutables, cache larga
  <FilesMatch "-[A-Za-z0-9_-]{8,}\\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  Header unset ETag
</IfModule>
FileETag None
`;

const PAGINA_404 = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 · Bimest Manager</title>
<link rel="icon" type="image/png" href="/BimestLogo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;padding:24px;
    font-family:'Hanken Grotesk',system-ui,sans-serif;color:#eaf2f2;
    background:radial-gradient(1000px 560px at 80% -10%,rgba(224,115,56,.18),transparent 60%),
               radial-gradient(820px 480px at -10% 10%,rgba(29,94,110,.28),transparent 55%),#0c1719}
  .code{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;
    color:#ff7a1a;border:1px solid rgba(224,115,56,.35);border-radius:999px;padding:6px 13px;display:inline-block}
  h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(56px,16vw,140px);margin:18px 0 0;line-height:1}
  h1 span{background:linear-gradient(90deg,#ff7a1a,#2b8aa0);-webkit-background-clip:text;background-clip:text;color:transparent}
  h2{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:clamp(22px,4vw,30px);margin:6px 0 10px}
  p{color:#9fb3b5;max-width:46ch;margin:0 auto 26px;font-size:16px}
  .row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
  a.btn{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;text-decoration:none;
    padding:11px 20px;border-radius:999px;border:1px solid transparent}
  .btn--p{background:linear-gradient(180deg,#ff7a1a,#e07338);color:#1a0f08}
  .btn--g{border-color:rgba(255,255,255,.14);color:#eaf2f2;background:rgba(255,255,255,.03)}
  .logo{width:52px;height:52px;border-radius:13px;margin-bottom:6px}
</style>
</head>
<body>
  <main>
    <img class="logo" src="/BimestLogo.png" alt="Bimest Manager">
    <div><span class="code">Error 404</span></div>
    <h1><span>404</span></h1>
    <h2>Esta página no existe</h2>
    <p>La ruta que buscas no está aquí. Puede que el enlace esté roto o que la página se haya movido.</p>
    <div class="row">
      <a class="btn btn--p" href="/">Volver al inicio</a>
      <a class="btn btn--g" href="/login">Entrar al sistema</a>
    </div>
  </main>
</body>
</html>
`;

function build() {
  console.log('API_BASE  =', API_BASE);
  console.log('OUT_DIR   =', OUT_DIR);
  console.log('WEB_DIST  =', WEB_DIST);
  console.log('');

  // 1) Limpiar salida
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 2) Landing React (web/dist) -> raiz del sitio
  if (fs.existsSync(WEB_DIST)) {
    copyDir(WEB_DIST, OUT_DIR);
    console.log('[ok] Landing copiada desde web/dist');
  } else {
    console.warn('[!!] No se encontro WEB_DIST (' + WEB_DIST + '). Compila la landing con "npm run build" en web/ y vuelve a correr, o copia su dist a mano.');
  }

  // 3) Assets del sistema (public/: css, js, img)
  copyDir(PUBLIC_DIR, OUT_DIR);
  console.log('[ok] Assets del sistema copiados (css, js, img)');

  // 4) Renderizar las paginas del sistema
  const metaTag = '<meta name="bm-api-base" content="' + API_BASE + '">';
  let n = 0;
  for (const p of paginas) {
    const vistaPath = path.join(VISTA_DIR, p.vista);
    let html = renderFile(vistaPath, {});
    // Inyecta la base de la API antes de </head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', '  ' + metaTag + '\n</head>');
    } else {
      html = metaTag + '\n' + html;
    }
    const outPath = path.join(OUT_DIR, p.salida);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    n++;
    console.log('[ok] ' + p.vista + ' -> ' + p.salida);
  }

  // 5) Pagina 404 propia
  fs.writeFileSync(path.join(OUT_DIR, '404.html'), PAGINA_404, 'utf8');
  console.log('[ok] 404.html generado');

  // 6) .htaccess (URLs limpias + cache + ErrorDocument) — sobreescribe el de la landing
  fs.writeFileSync(path.join(OUT_DIR, '.htaccess'), HTACCESS, 'utf8');
  console.log('[ok] .htaccess generado');

  console.log('\nListo. ' + n + ' paginas del sistema + landing en:\n  ' + OUT_DIR);
}

build();
