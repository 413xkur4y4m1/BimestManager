// ============================================================
// api-base.js — Puente entre la web (bimestmanager.com) y la API
// ============================================================
// Cuando el sistema se sirve como estatico desde Hostinger
// (bimestmanager.com) y la API vive en api.bimestmanager.com, este
// script redirige todas las llamadas relativas del backend hacia la API.
//
// La base se lee de <meta name="bm-api-base" content="https://api...">,
// que el build estatico inyecta. En LOCAL ese meta no existe -> base
// vacia -> no se parchea nada y todo sigue funcionando relativo.
// Debe cargarse ANTES de common.js en cada vista.
// ============================================================
(function () {
  'use strict';

  var meta = document.querySelector('meta[name="bm-api-base"]');
  var BASE = ((meta && meta.content) || '').replace(/\/+$/, '');

  window.BM_API_BASE = BASE;

  // Prefija una ruta del backend (API o asset como /imageFirma) con la base.
  // Sin base configurada devuelve la ruta tal cual (modo local).
  window.BM_apiUrl = function (path) {
    if (!BASE || !path) return path;
    if (/^https?:\/\//i.test(path)) return path;       // ya es absoluta
    return BASE + (path.charAt(0) === '/' ? '' : '/') + path;
  };

  if (!BASE) return; // Local: no hay nada que parchear.

  // --- Parche de fetch ---
  // Toda llamada a una ruta absoluta del mismo sitio ("/auth/...", "/admin/...")
  // se reenvia a la API con las cookies incluidas. Los assets estaticos
  // (css/js/img) se cargan via <link>/<script>, no por fetch, asi que no se tocan.
  var origFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    init = init || {};
    try {
      if (typeof input === 'string') {
        if (input.charAt(0) === '/' && input.charAt(1) !== '/') {
          input = BASE + input;
          if (init.credentials === undefined) init.credentials = 'include';
        }
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        var u = input.url || '';
        // Request.url ya viene absoluta (incluye el origin actual): la
        // reescribimos solo si apunta al mismo origin + ruta del backend.
        if (u.indexOf(window.location.origin + '/') === 0) {
          var ruta = u.slice(window.location.origin.length);
          input = new Request(BASE + ruta, input);
        }
      }
    } catch (e) { /* si algo falla, dejamos la llamada original */ }
    return origFetch(input, init);
  };
})();
