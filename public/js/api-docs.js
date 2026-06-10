// ============================================================
// api-docs.js — Render de la pagina de documentacion de la API
// ============================================================
// Externo (no inline) para cumplir el CSP (script-src 'self').
// ============================================================
(function () {
  'use strict';

  const API_BASE = location.origin;
  const baseEl = document.getElementById('baseUrl');
  if (baseEl) baseEl.textContent = API_BASE;

  // L = requiere login (JWT) · F = publico
  const groups = [
    { id:'auth', name:'Autenticación', base:'/auth',
      desc:'Registro, inicio/cierre de sesión y usuario actual.',
      eps:[
        { m:'POST', p:'/auth/login', d:'Inicia sesión. Devuelve cookie de sesión y a dónde redirigir.', f:true, body:'{ "email": "...", "password": "..." }' },
        { m:'POST', p:'/auth/registro-alumno', d:'Registra un alumno de Química (queda pendiente de autorización).', f:true, body:'{ "nombre": "...", "email": "...", "password": "..." }' },
        { m:'POST', p:'/auth/registro-alumno-turismo', d:'Registra un alumno de Turismo.', f:true, body:'{ "nombre":"...", "email":"...", "password":"...", "grupo":"..." }' },
        { m:'POST', p:'/auth/logout', d:'Cierra la sesión actual.', f:true },
        { m:'GET',  p:'/auth/yo', d:'Devuelve el usuario autenticado (según la cookie/token).' }
      ]},
    { id:'estudiantes', name:'Estudiantes · Química', base:'/estudiantes',
      desc:'Panel del alumno y gestión de pendientes (admin/maestro).',
      eps:[
        { m:'GET',  p:'/estudiantes/mi-panel', d:'Panel del alumno: su sesión, equipo y responsiva.' },
        { m:'POST', p:'/estudiantes/firmar', d:'Firma la responsiva del equipo.' },
        { m:'GET',  p:'/estudiantes/pendientes', d:'Alumnos pendientes de autorizar.' },
        { m:'PATCH',p:'/estudiantes/:id/grupo', d:'Asigna un grupo al alumno.' },
        { m:'PATCH',p:'/estudiantes/:id/activar', d:'Activa (autoriza) al alumno.' }
      ]},
    { id:'maestro', name:'Maestro · Química', base:'/maestro',
      desc:'Grupos, prácticas, kits, laboratorios, sesiones e incidencias.',
      eps:[
        { m:'GET', p:'/maestro/resumen', d:'Resumen general del maestro.' },
        { m:'GET', p:'/maestro/grupos', d:'Lista grupos.' },
        { m:'POST',p:'/maestro/grupos', d:'Crea un grupo.' },
        { m:'GET', p:'/maestro/grupos/:id/alumnos', d:'Alumnos de un grupo.' },
        { m:'GET', p:'/maestro/alumnos', d:'Alumnos activos.' },
        { m:'GET', p:'/maestro/materiales', d:'Materiales activos.' },
        { m:'GET', p:'/maestro/equipos', d:'Todos los equipos.' },
        { m:'GET', p:'/maestro/practicas', d:'Lista prácticas.' },
        { m:'POST',p:'/maestro/practicas', d:'Crea una práctica.' },
        { m:'GET', p:'/maestro/practicas/:id/kits', d:'Kits de una práctica.' },
        { m:'POST',p:'/maestro/practicas/:id/kits', d:'Crea un kit en la práctica.' },
        { m:'DELETE',p:'/maestro/kits/:id', d:'Elimina un kit.' },
        { m:'POST',p:'/maestro/kits/:id/materiales', d:'Agrega material a un kit.' },
        { m:'DELETE',p:'/maestro/kits/:kitId/materiales/:materialId', d:'Quita material de un kit.' },
        { m:'GET', p:'/maestro/laboratorios', d:'Laboratorios disponibles.' },
        { m:'GET', p:'/maestro/agenda', d:'Agenda (detección de choques de horario).' },
        { m:'GET', p:'/maestro/sesiones', d:'Mis sesiones.' },
        { m:'POST',p:'/maestro/sesiones', d:'Crea una sesión.' },
        { m:'GET', p:'/maestro/sesiones/:id', d:'Detalle de una sesión.' },
        { m:'PATCH',p:'/maestro/sesiones/:id/estado', d:'Cambia el estado de la sesión.' },
        { m:'GET', p:'/maestro/sesiones/:id/alumnos', d:'Alumnos de la sesión.' },
        { m:'POST',p:'/maestro/sesiones/:id/equipos', d:'Crea un equipo en la sesión.' },
        { m:'DELETE',p:'/maestro/equipos/:id', d:'Elimina un equipo.' },
        { m:'GET', p:'/maestro/sesiones/:id/incidencias', d:'Incidencias de la sesión.' },
        { m:'POST',p:'/maestro/sesiones/:id/incidencias', d:'Registra una incidencia.' }
      ]},
    { id:'admin', name:'Admin · Química', base:'/admin',
      desc:'Usuarios, materiales, laboratorios, préstamos, adeudos y reportes.',
      eps:[
        { m:'GET', p:'/admin/resumen', d:'Indicadores generales.' },
        { m:'GET', p:'/admin/usuarios', d:'Lista usuarios.' },
        { m:'POST',p:'/admin/usuarios', d:'Crea un usuario.' },
        { m:'PATCH',p:'/admin/usuarios/:id/estado', d:'Activa/desactiva un usuario.' },
        { m:'GET', p:'/admin/materiales', d:'Lista materiales.' },
        { m:'POST',p:'/admin/materiales', d:'Crea material.' },
        { m:'PATCH',p:'/admin/materiales/:id/stock', d:'Ajusta stock.' },
        { m:'PATCH',p:'/admin/materiales/:id', d:'Edita material.' },
        { m:'DELETE',p:'/admin/materiales/:id', d:'Desactiva material.' },
        { m:'GET', p:'/admin/laboratorios', d:'Lista laboratorios.' },
        { m:'POST',p:'/admin/laboratorios', d:'Crea laboratorio.' },
        { m:'PATCH',p:'/admin/laboratorios/:id/estado', d:'Activa/desactiva laboratorio.' },
        { m:'GET', p:'/admin/hoja-ruta', d:'Hoja de ruta diaria del laboratorista.' },
        { m:'GET', p:'/admin/prestamos', d:'Lista préstamos.' },
        { m:'POST',p:'/admin/prestamos', d:'Registra préstamo.' },
        { m:'PATCH',p:'/admin/prestamos/:id/devolucion', d:'Marca préstamo devuelto.' },
        { m:'GET', p:'/admin/adeudos', d:'Lista adeudos.' },
        { m:'PATCH',p:'/admin/adeudos/:id/resolver', d:'Resuelve un adeudo.' },
        { m:'GET', p:'/admin/incidencias', d:'Lista incidencias.' },
        { m:'GET', p:'/admin/responsivas', d:'Lista responsivas (con firmas).' },
        { m:'GET', p:'/admin/sesiones', d:'Lista sesiones.' }
      ]},
    { id:'turismo', name:'Turismo · Estudiante', base:'/turismo/estudiantes',
      desc:'Panel, préstamos, adeudos, notificaciones y sugerencias del alumno de turismo.',
      eps:[
        { m:'GET', p:'/turismo/estudiantes/mi-panel', d:'Panel del alumno de turismo.' },
        { m:'GET', p:'/turismo/estudiantes/mis-prestamos', d:'Mis préstamos.' },
        { m:'GET', p:'/turismo/estudiantes/mis-adeudos', d:'Mis adeudos.' },
        { m:'GET', p:'/turismo/estudiantes/mis-notificaciones', d:'Mis notificaciones.' },
        { m:'PATCH',p:'/turismo/estudiantes/notificaciones/:id/leer', d:'Marca notificación como leída.' },
        { m:'GET', p:'/turismo/estudiantes/sesion-activa', d:'Sesión activa.' },
        { m:'GET', p:'/turismo/estudiantes/mis-sesiones', d:'Mis sesiones.' },
        { m:'GET', p:'/turismo/estudiantes/materiales-disponibles', d:'Materiales disponibles.' },
        { m:'GET', p:'/turismo/estudiantes/practicas/:practicaId/sugerencias', d:'Sugerencias de material por práctica.' },
        { m:'POST',p:'/turismo/estudiantes/prestamos', d:'Solicita un préstamo.' },
        { m:'GET', p:'/turismo/estudiantes/pendientes', d:'Alumnos pendientes (admin).' },
        { m:'PATCH',p:'/turismo/estudiantes/:id/grupo', d:'Asigna grupo (admin).' },
        { m:'PATCH',p:'/turismo/estudiantes/:id/activar', d:'Activa alumno (admin).' }
      ]},
    { id:'turismo-admin', name:'Turismo · Admin', base:'/turismo/admin',
      desc:'Usuarios, materiales, prácticas, sugerencias, sesiones, préstamos e incidencias de turismo.',
      eps:[
        { m:'GET', p:'/turismo/admin/resumen', d:'Indicadores de turismo.' },
        { m:'GET', p:'/turismo/admin/usuarios', d:'Lista usuarios.' },
        { m:'POST',p:'/turismo/admin/usuarios', d:'Crea usuario.' },
        { m:'PATCH',p:'/turismo/admin/usuarios/:id/estado', d:'Activa/desactiva usuario.' },
        { m:'PATCH',p:'/turismo/admin/usuarios/:id/grupo', d:'Asigna grupo.' },
        { m:'GET', p:'/turismo/admin/materiales', d:'Lista materiales.' },
        { m:'POST',p:'/turismo/admin/materiales', d:'Crea material.' },
        { m:'PATCH',p:'/turismo/admin/materiales/:id/stock', d:'Ajusta stock.' },
        { m:'PATCH',p:'/turismo/admin/materiales/:id/estado', d:'Cambia estado del material.' },
        { m:'PATCH',p:'/turismo/admin/materiales/:id', d:'Edita material.' },
        { m:'DELETE',p:'/turismo/admin/materiales/:id', d:'Desactiva material.' },
        { m:'GET', p:'/turismo/admin/practicas', d:'Lista prácticas.' },
        { m:'POST',p:'/turismo/admin/practicas', d:'Crea práctica.' },
        { m:'PATCH',p:'/turismo/admin/practicas/:id', d:'Actualiza práctica.' },
        { m:'DELETE',p:'/turismo/admin/practicas/:id', d:'Desactiva práctica.' },
        { m:'GET', p:'/turismo/admin/practicas/:id/sugerencias', d:'Sugerencias de la práctica.' },
        { m:'POST',p:'/turismo/admin/practicas/:id/sugerencias', d:'Agrega sugerencia.' },
        { m:'PATCH',p:'/turismo/admin/sugerencias/:id', d:'Actualiza sugerencia.' },
        { m:'DELETE',p:'/turismo/admin/sugerencias/:id', d:'Elimina sugerencia.' },
        { m:'GET', p:'/turismo/admin/sesiones', d:'Lista sesiones.' },
        { m:'POST',p:'/turismo/admin/sesiones', d:'Crea sesión.' },
        { m:'GET', p:'/turismo/admin/sesiones/:id', d:'Detalle de sesión.' },
        { m:'PATCH',p:'/turismo/admin/sesiones/:id/estado', d:'Cambia estado de sesión.' },
        { m:'GET', p:'/turismo/admin/prestamos', d:'Lista préstamos.' },
        { m:'POST',p:'/turismo/admin/prestamos', d:'Registra préstamo.' },
        { m:'PATCH',p:'/turismo/admin/prestamos/:id/aprobar', d:'Aprueba solicitud.' },
        { m:'PATCH',p:'/turismo/admin/prestamos/:id/rechazar', d:'Rechaza solicitud.' },
        { m:'PATCH',p:'/turismo/admin/prestamos/:id/devolucion', d:'Marca devuelto.' },
        { m:'PATCH',p:'/turismo/admin/prestamos/:id/adeudo', d:'Marca como adeudo.' },
        { m:'GET', p:'/turismo/admin/incidencias', d:'Lista incidencias.' },
        { m:'PATCH',p:'/turismo/admin/incidencias/:id/resolver', d:'Resuelve incidencia.' }
      ]},
    { id:'monitor', name:'Monitoreo', base:'/monitor',
      desc:'Salud y métricas del servicio.',
      eps:[
        { m:'GET', p:'/salud', d:'Health check del servicio.', f:true },
        { m:'GET', p:'/monitor/metricas', d:'Métricas del sistema (CPU, RAM, disco, latencia DB).', f:true }
      ]}
  ];

  const respuestas = {
    '/auth/login': '{\n  "message": "Inicio de sesion correcto.",\n  "redirectTo": "/admin",\n  "usuario": { "id": 1, "nombre": "Ana Vega", "email": "ana@ulsa.mx",\n               "rol": "ADMIN", "fuente": "QUIMICA", "grupo_id": null }\n}',
    '/auth/registro-alumno': '{ "message": "Registro completado. Tu cuenta queda pendiente de autorizacion por un maestro.", "id": 42 }',
    '/auth/registro-alumno-turismo': '{ "message": "Registro completado. Tu cuenta queda pendiente de autorizacion por un administrador.", "id": 18 }',
    '/auth/logout': '{ "message": "Sesion cerrada correctamente." }',
    '/auth/yo': '{ "usuario": { "id": 1, "nombre": "Ana Vega", "email": "ana@ulsa.mx", "rol": "MAESTRO", "fuente": "QUIMICA" } }',
    '/salud': '{ "ok": true, "ts": "2026-06-10T07:30:00.000Z" }',
    '/monitor/metricas': '{\n  "cpu": 12.4, "ramUsadaMB": 318, "ramTotalMB": 2048,\n  "discoLibreGB": 38.2, "dbLatenciaMs": 12, "uptimeSeg": 84213\n}',
    '/estudiantes/mi-panel': '{\n  "sesion": { "id": 12, "practica": "Titulacion acido-base", "estado": "EN_CURSO" },\n  "equipo": { "id": 3, "nombre": "Equipo 03" },\n  "mi_firma_imagen": "/imageFirma/firma_u1_s1.png", "mi_firmado_at": "2026-06-10T16:05:00Z"\n}',
    '/estudiantes/firmar': '{ "message": "Responsiva firmada.", "firma_imagen": "/imageFirma/firma_u1_s1.png" }',
    '/estudiantes/pendientes': '[ { "id": 42, "nombre": "Luis Mora", "email": "luis@ulsa.mx", "is_active": 0 } ]',
    '/maestro/resumen': '{ "sesionesHoy": 3, "alumnos": 128, "incidenciasAbiertas": 2 }',
    '/maestro/materiales': '[ { "id": 1, "nombre": "Acido clorhidrico 100 mL", "stock": 42, "is_active": 1 } ]',
    '/maestro/sesiones': '[ { "id": 12, "practica_id": 5, "grupo_id": 2, "fecha": "2026-06-12", "estado": "PROGRAMADA" } ]',
    '/maestro/sesiones/:id': '{\n  "id": 12, "practica": "Titulacion acido-base", "laboratorio": "Lab Quimica A",\n  "estado": "PROGRAMADA", "equipos": [ { "id": 3, "nombre": "Equipo 03" } ]\n}',
    '/maestro/practicas': '[ { "id": 5, "nombre": "Titulacion", "tipo": "QUIMICA", "creado_por": 1 } ]',
    '/admin/resumen': '{ "usuarios": 134, "materiales": 512, "prestamosActivos": 9, "adeudosPendientes": 4 }',
    '/admin/usuarios': '[ { "id": 1, "nombre": "Ana Vega", "email": "ana@ulsa.mx", "rol": "MAESTRO", "is_active": 1 } ]',
    '/admin/materiales': '[ { "id": 1, "nombre": "Matraz Erlenmeyer 250 mL", "stock": 30, "is_active": 1 } ]',
    '/admin/laboratorios': '[ { "id": 1, "nombre": "Laboratorio de Quimica A", "ubicacion": "Edificio C", "capacidad": 30, "is_active": 1 } ]',
    '/admin/prestamos': '[ { "id": 7, "usuario_id": 42, "material_id": 1, "cantidad": 2, "estado": "ACTIVO" } ]',
    '/admin/adeudos': '[ { "id": 3, "usuario_id": 42, "material_id": 1, "estado": "PENDIENTE" } ]',
    '/turismo/estudiantes/mi-panel': '{ "sesion_activa": { "id": 8, "practica": "Salida de campo" }, "adeudos": 0 }',
    '/turismo/admin/resumen': '{ "alumnos": 64, "materiales": 80, "solicitudesPendientes": 3 }',
    '/turismo/admin/prestamos': '[ { "id": 5, "alumno_id": 18, "material_id": 2, "estado": "PRESTADO" } ]'
  };

  const RES_GENERICA = {
    POST:   '{ "message": "Creado correctamente.", "id": 123 }',
    PATCH:  '{ "message": "Actualizado correctamente." }',
    DELETE: '{ "message": "Eliminado correctamente." }'
  };
  const RES_ERRORES = '// 401  { "error": "Debes iniciar sesion." }\n// 403  { "error": "No tienes permisos para esta accion." }\n// 400  { "error": "Datos invalidos." }';

  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // Ejecuta un GET y pinta el resultado. Si da 401/403 ofrece iniciar sesion.
  async function probar(path, outId){
    const box = document.getElementById(outId);
    if (!box) return;
    box.style.display = 'flex';
    box.innerHTML = '<pre>Cargando…</pre>';
    try{
      const res = await fetch(API_BASE + path, { method:'GET', headers:{Accept:'application/json'}, credentials:'include' });
      const txt = await res.text();
      let body; try { body = JSON.stringify(JSON.parse(txt), null, 2); } catch (_) { body = txt; }
      let html = '<pre>' + esc(res.status + ' ' + res.statusText + '\n\n' + body) + '</pre>';
      if (res.status === 401){
        html += '<div class="needauth">' +
          '<span>🔒 Necesitas iniciar sesión para ver datos reales.</span>' +
          '<button class="goLogin" type="button">Iniciar sesión ↑</button>' +
          '<span class="muted">Si no, revisa la “Respuesta de ejemplo”.</span>' +
        '</div>';
      } else if (res.status === 403){
        html += '<div class="needauth">' +
          '<span>⛔ Tu rol no tiene acceso a esta ruta. Inicia sesión con una cuenta del rol adecuado.</span>' +
          '<button class="goLogin" type="button">Cambiar de cuenta ↑</button>' +
        '</div>';
      }
      box.innerHTML = html;
    }catch(e){
      box.innerHTML = '<pre>Error de red: ' + esc(e.message) + '</pre>';
    }
  }

  // ---- Render de las tarjetas ----
  const cont = document.getElementById('docs');
  groups.forEach((g) => {
    const sec = document.createElement('section');
    sec.className = 'section';
    sec.id = g.id;
    let cards = '';
    g.eps.forEach((e, i) => {
      const outId = g.id + '-' + i;
      const tag = e.f ? '<span class="free">público</span>' : '<span class="lock">JWT</span>';
      // Solo los GET (lectura) son ejecutables. Los que MODIFICAN datos
      // (POST/PATCH/DELETE) no se pueden probar aqui, a proposito.
      const tryBtn = (e.m === 'GET')
        ? '<button class="try" data-p="' + esc(e.p) + '" data-out="' + outId + '">Probar ▶</button>'
        : '<span class="noexec">🔒 No ejecutable aquí · modifica datos</span>';
      const bodyEx = e.body ? '<div class="body-ex"><b>body</b> ' + esc(e.body) + '</div>' : '';
      const ejemplo = respuestas[e.p] || (e.m !== 'GET' ? RES_GENERICA[e.m] : '');
      const resEx = ejemplo
        ? '<details class="resp"><summary>Respuesta de ejemplo</summary><pre class="resp-pre">' + esc(ejemplo) + '\n\n' + esc(RES_ERRORES) + '</pre></details>'
        : '';
      cards +=
        '<article class="card">' +
          '<div class="card__row">' +
            '<span class="m ' + e.m + '">' + e.m + '</span>' +
            '<span class="path">' + esc(e.p) + '</span>' + tag +
          '</div>' +
          '<p class="card__desc">' + esc(e.d) + '</p>' +
          bodyEx + resEx +
          '<div class="card__spacer"></div>' +
          tryBtn +
          '<div id="' + outId + '" class="out" style="display:none"></div>' +
        '</article>';
    });
    sec.innerHTML =
      '<div class="section__head">' +
        '<h2 class="section__title">' + esc(g.name) + '</h2>' +
        '<span class="section__base">' + esc(g.base) + '</span>' +
        '<span class="nav__spacer"></span>' +
        '<p class="section__desc">' + esc(g.desc) + '</p>' +
      '</div>' +
      '<div class="grid">' + cards + '</div>';
    cont.appendChild(sec);
  });

  // ---- Login real para probar con datos reales ----
  const elForm = document.getElementById('loginForm');
  const elStatus = document.getElementById('liStatus');
  const elWho = document.getElementById('liWho');
  const elMsg = document.getElementById('liMsg');

  function mostrarSesion(u){
    if (elForm) elForm.style.display = 'none';
    if (elMsg) { elMsg.textContent = ''; elMsg.className = 'authbar__msg'; }
    if (elWho) elWho.innerHTML = 'Sesión activa: <b>' + esc(u.nombre || u.email || 'usuario') + '</b> · ' + esc(u.rol || '') + (u.fuente ? ' · ' + esc(u.fuente) : '');
    if (elStatus) elStatus.style.display = 'flex';
  }
  function limpiarSesion(){
    if (elStatus) elStatus.style.display = 'none';
    if (elForm) elForm.style.display = 'flex';
  }

  if (elForm){
    elForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = (document.getElementById('liEmail').value || '').trim();
      const password = document.getElementById('liPass').value || '';
      elMsg.className = 'authbar__msg';
      elMsg.textContent = 'Entrando…';
      try{
        const res = await fetch(API_BASE + '/auth/login', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Accept:'application/json' },
          credentials:'include',
          body: JSON.stringify({ email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.usuario){
          mostrarSesion(data.usuario);
        } else {
          elMsg.className = 'authbar__msg err';
          elMsg.textContent = (data && data.error) || ('No se pudo entrar (' + res.status + ')');
        }
      }catch(_){
        elMsg.className = 'authbar__msg err';
        elMsg.textContent = 'Error de red al iniciar sesión.';
      }
    });
  }

  const elLogout = document.getElementById('liLogout');
  if (elLogout){
    elLogout.addEventListener('click', async () => {
      try { await fetch(API_BASE + '/auth/logout', { method:'POST', credentials:'include' }); } catch (_) {}
      limpiarSesion();
    });
  }

  // ¿Ya hay sesion al cargar? (cookie existente)
  (async () => {
    try{
      const r = await fetch(API_BASE + '/auth/yo', { headers:{Accept:'application/json'}, credentials:'include' });
      if (r.ok){ const d = await r.json(); if (d && d.usuario) mostrarSesion(d.usuario); }
    }catch(_){}
  })();

  // ---- Delegacion de clicks: Probar y "Iniciar sesion" ----
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.try');
    if (btn){ probar(btn.getAttribute('data-p'), btn.getAttribute('data-out')); return; }

    if (ev.target.closest('.goLogin')){
      const bar = document.getElementById('authbar');
      if (bar) bar.scrollIntoView({ behavior:'smooth', block:'start' });
      const em = document.getElementById('liEmail');
      if (em) setTimeout(() => em.focus(), 300);
    }
  });

  // Auto-probar /salud al cargar
  probar('/salud', 'saludOut');
})();
