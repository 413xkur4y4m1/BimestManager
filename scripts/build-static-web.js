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
#  BimestManager — sitio estatico (Hostinger / Apache)
#  Generado por scripts/build-static-web.js — NO editar a mano.
# ============================================================

# ── Forzar HTTPS ───────────────────────────────────────────
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# ── URLs limpias: /login -> login.html, /turismo/admin -> turismo/admin.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]

# ── Compresion ─────────────────────────────────────────────
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

  // 5) .htaccess (URLs limpias + cache) — sobreescribe el de la landing
  fs.writeFileSync(path.join(OUT_DIR, '.htaccess'), HTACCESS, 'utf8');
  console.log('[ok] .htaccess generado');

  console.log('\nListo. ' + n + ' paginas del sistema + landing en:\n  ' + OUT_DIR);
}

build();
