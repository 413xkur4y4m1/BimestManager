// Dashboard alumno Quimica
(function () {
  'use strict';
  const { api, flash, clearFlash, setLoading, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc, makePagedList } = window.BM;

  let usuario = null;
  let adeudosCtl = null;
  let notifCtl = null;

  const cargar = async () => {
    clearFlash('flash');
    const r = await api('GET', '/estudiantes/mi-panel');
    if (!r.ok) {
      flash('flash', (r.data && r.data.error) || 'No se pudo cargar el panel.', 'error');
      return;
    }
    render(r.data);
  };

  const render = (data) => {
    const u = data.usuario || {};
    const nombrePila = (u.nombre || '').split(' ')[0] || '';
    document.getElementById('welcomeTitle').textContent = 'Hola, ' + nombrePila;
    document.getElementById('welcomeSub').textContent = u.grupo
      ? 'Grupo: ' + u.grupo
      : 'Aún no tienes grupo asignado.';

    const sesEl = document.getElementById('sesion');
    if (data.sesionActiva) {
      const s = data.sesionActiva;
      const enCurso = s.estado === 'EN_CURSO';
      sesEl.innerHTML = `
        <div class="banner banner--${enCurso ? 'ok' : 'info'}">${enCurso ? 'Sesión en curso' : 'Sesión programada para hoy'}</div>
        <dl class="kv">
          <div><dt>Práctica</dt><dd>${esc(s.practica)}</dd></div>
          <div><dt>Fecha</dt><dd>${esc(formatFecha(s.fecha))}</dd></div>
          <div><dt>Hora inicio</dt><dd>${esc(s.hora_inicio || '—')}</dd></div>
          <div><dt>Estado</dt><dd><span class="badge badge--${enCurso ? 'ok' : 'info'}">${esc(s.estado)}</span></dd></div>
          <div><dt>Equipos</dt><dd>${s.equipos_creados}/${s.num_equipos != null ? s.num_equipos : '—'}</dd></div>
        </dl>
      `;
    } else {
      sesEl.innerHTML = '<div class="empty-state">No hay sesión activa para tu grupo en este momento.</div>';
    }

    const equipoEl = document.getElementById('equipoActual');
    if (data.equipoActual) {
      const e = data.equipoActual;
      const ints = (e.integrantes || []).map((i) => {
        const esTu = u.id && i.id === u.id;
        return `<li>
          <div class="card-row__title">${esc(i.nombre)}${esTu ? ' <span class="badge badge--info">Tú</span>' : ''}${i.firmado ? ' <span class="badge badge--ok">Firmado</span>' : ''}</div>
          <div class="card-row__sub">${esc(i.email)}</div>
        </li>`;
      }).join('');
      equipoEl.innerHTML = `
        <div class="banner banner--ok">Perteneces al equipo <strong>${esc(e.nombre)}</strong></div>
        <div class="card-row__sub">${e.integrantes_actuales} integrante(s)</div>
        <ul class="list">${ints || '<li class="empty-state">Sin integrantes registrados.</li>'}</ul>
      `;
    } else if (data.sesionActiva) {
      equipoEl.innerHTML = '<div class="empty-state">El maestro aún no te ha asignado a un equipo en esta sesión.</div>';
    } else {
      equipoEl.innerHTML = '<div class="empty-state">No hay sesión activa.</div>';
    }

    renderFirma(data);

    if (adeudosCtl) adeudosCtl.setData(data.adeudos || []);
    if (notifCtl) notifCtl.setData(data.notificaciones || []);
  };

  const renderAdeudoItem = (a) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(a.material)}</div>
        <div class="card-row__sub">${esc(formatFecha(a.created_at))}</div>
      </div>
      <span class="badge badge--${a.estado === 'PENDIENTE' ? 'warn' : 'ok'}">${esc(a.estado)}</span>
    </li>`;

  const renderNotifItem = (n) => `
    <li>
      <div class="card-row__title">${esc(n.mensaje)}</div>
      <div class="card-row__sub">${esc(formatFecha(n.created_at))}${n.leido === false ? ' · <span class="badge badge--info">NUEVA</span>' : ''}</div>
    </li>`;

  // ============================================================
  // Firma digital (canvas)
  // ============================================================
  let firmaPadCtx = null;
  let firmaDibujando = false;
  let firmaTieneTrazos = false;

  const renderFirma = (data) => {
    const card = document.getElementById('firmaCard');
    if (!card) return;

    const sesion = data.sesionActiva;
    const equipo = data.equipoActual;
    const enCurso = sesion && sesion.estado === 'EN_CURSO';

    // Solo mostramos la card si hay sesion EN_CURSO y el alumno esta en un equipo
    if (!enCurso || !equipo) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const yaFirmo = Boolean(equipo.mi_firma_imagen);
    document.getElementById('firmaPendiente').hidden = yaFirmo;
    document.getElementById('firmaHecha').hidden = !yaFirmo;

    if (yaFirmo) {
      const img = document.getElementById('firmaPreview');
      img.src = equipo.mi_firma_imagen + '?t=' + Date.now(); // cache-bust
      const fechaEl = document.getElementById('firmaFecha');
      fechaEl.textContent = equipo.mi_firmado_at
        ? 'Firmada el ' + formatFecha(equipo.mi_firmado_at)
        : '';
    } else {
      resetSignaturePad();
    }
  };

  const getCanvasCtx = () => {
    if (firmaPadCtx) return firmaPadCtx;
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return null;

    // Ajuste de resolucion para pantallas retina/movil
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#122027';
    firmaPadCtx = ctx;
    return ctx;
  };

  const resetSignaturePad = () => {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;
    firmaPadCtx = null; // forzar recalculo al volver a dibujar
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    firmaTieneTrazos = false;
  };

  const obtenerPunto = (canvas, ev) => {
    const rect = canvas.getBoundingClientRect();
    const touch = ev.touches && ev.touches[0];
    const x = (touch ? touch.clientX : ev.clientX) - rect.left;
    const y = (touch ? touch.clientY : ev.clientY) - rect.top;
    return { x, y };
  };

  const wireSignaturePad = () => {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;

    const empezar = (ev) => {
      ev.preventDefault();
      const ctx = getCanvasCtx();
      if (!ctx) return;
      firmaDibujando = true;
      firmaTieneTrazos = true;
      const { x, y } = obtenerPunto(canvas, ev);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const dibujar = (ev) => {
      if (!firmaDibujando) return;
      ev.preventDefault();
      const ctx = getCanvasCtx();
      if (!ctx) return;
      const { x, y } = obtenerPunto(canvas, ev);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const terminar = () => { firmaDibujando = false; };

    canvas.addEventListener('mousedown',  empezar);
    canvas.addEventListener('mousemove',  dibujar);
    canvas.addEventListener('mouseup',    terminar);
    canvas.addEventListener('mouseleave', terminar);
    canvas.addEventListener('touchstart', empezar,  { passive: false });
    canvas.addEventListener('touchmove',  dibujar,  { passive: false });
    canvas.addEventListener('touchend',   terminar);

    document.getElementById('btnLimpiarFirma').addEventListener('click', resetSignaturePad);
    document.getElementById('btnGuardarFirma').addEventListener('click', enviarFirma);
  };

  const enviarFirma = async () => {
    const btn = document.getElementById('btnGuardarFirma');
    if (!firmaTieneTrazos) {
      flash('flash', 'Dibuja tu firma antes de continuar.', 'warn');
      return;
    }
    const canvas = document.getElementById('signaturePad');
    const dataUrl = canvas.toDataURL('image/png');

    setLoading(btn, true);
    const r = await api('POST', '/estudiantes/firmar', { firma: dataUrl });
    setLoading(btn, false);

    if (!r.ok) {
      flash('flash', (r.data && r.data.error) || 'No se pudo registrar la firma.', 'error');
      return;
    }
    flash('flash', 'Firma registrada.', 'ok');
    cargar();
  };

  const initListas = () => {
    adeudosCtl = makePagedList(document.getElementById('adeudosBox'), {
      render: renderAdeudoItem,
      search: (a, q) => (a.material || '').toLowerCase().includes(q),
      emptyHtml: '<li class="empty-state">Sin adeudos.</li>'
    });

    notifCtl = makePagedList(document.getElementById('notifBox'), {
      pageSize: 15,
      render: renderNotifItem,
      search: (n, q) => (n.mensaje || '').toLowerCase().includes(q),
      filters: { leido: (n, v) => (v === 'si' ? !!n.leido : !n.leido) },
      emptyHtml: '<li class="empty-state">Sin notificaciones.</li>'
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    usuario = await requireAuth({ fuente: 'QUIMICA', roles: ['ALUMNO'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSignaturePad();
    initListas();
    cargar();
  });
})();
