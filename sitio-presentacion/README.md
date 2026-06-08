# BimestManager — Sitio de presentación y documentación

Sitio estático construido siguiendo el pipeline **Textura / Claude Code** (PDF de referencia).
Funciona sin instalar nada: dos archivos HTML, una hoja de estilos y un JS de animaciones.

## Estructura

```
sitio-presentacion/
├── index.html           ← Landing / presentación con equipo
├── documentacion.html   ← Documentación técnica completa
├── styles.css           ← Estilo dark cinematic premium
├── animations.js        ← Scroll-reveal, navbar, sidebar activo
├── favicon.svg          ← Favicon
├── vercel.json          ← Config para Vercel
└── netlify.toml         ← Config para Netlify
```

## Cómo verlo localmente

Doble click sobre `index.html` o servir la carpeta:

```bash
# con node
npx serve .

# o con python
python -m http.server 8080
```

Luego abrí http://localhost:8080.

## Cómo desplegarlo

### Opción A — Vercel (drag & drop)

1. Entrar a https://vercel.com
2. Arrastrar la carpeta `sitio-presentacion/` al dashboard
3. Listo — HTTPS y CDN automáticos

### Opción B — Netlify (drag & drop)

1. Entrar a https://app.netlify.com/drop
2. Arrastrar la carpeta `sitio-presentacion/`
3. Listo

### Opción C — GitHub Pages

```bash
git checkout -b gh-pages
git add sitio-presentacion
git push origin gh-pages
```

Configurar en *Settings → Pages → folder: `/sitio-presentacion`*.

## Pipeline aplicado (PDF Textura)

| Paso | Acción | Implementado |
|---|---|---|
| 01 | Brief & copy en español | ✓ Tono cinemático y técnico |
| 02–03 | Referencia visual + monocromo | ✓ Estilo dark inspirado en Textura |
| 04 | Layout pixel-close | ✓ Hero + secciones modulares |
| 05 | Tipografía display | ✓ Space Grotesk + Inter + JetBrains Mono |
| 06 | Paleta de color | ✓ Azul Claude `#7eb6ff` sobre `#050507` |
| 07 | 3D models | ✗ (no necesario para documentación) |
| 08 | Assets | ✓ SVG inline, sin imágenes pesadas |
| 09 | Animaciones | ✓ Scroll-reveal, marquee, hover states |
| 10 | Optimización | ✓ Sin frameworks, `prefers-reduced-motion`, fonts preload |
| 11 | Deploy | ✓ `vercel.json` + `netlify.toml` incluidos |

## Accesibilidad

- Contraste AA (4.5:1) en todos los textos
- `prefers-reduced-motion` respetado (sin animaciones para usuarios sensibles)
- Navegación por teclado funcional
- HTML semántico (`<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`)

## Equipo

Ver `index.html#equipo` o `documentacion.html#creditos` para la lista completa.
