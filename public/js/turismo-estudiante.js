// Dashboard alumno Turismo
(function () {
  'use strict';
  const { api, flash, clearFlash, setLoading, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc, makePagedList } = window.BM;

  let usuario = null;
  let sesionActivaId = null;
  let prestamosCtl = null;
  let historialCtl = null;
  let adeudosCtl = null;
  let notifCtl = null;

  const cargar = async () => {
    clearFlash('flash');
    const r = await api('GET', '/turismo/estudiantes/mi-panel');
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
      : 'Aún no tienes grupo asignado por el administrador.';

    sesionActivaId = null;
    const sesEnInicio = document.getElementById('sesion');
    const sesDetalle = document.getElementById('sesionDetalle');

    const renderSesionInicio = () => {
      if (data.sesionActiva) {
        const s = data.sesionActiva;
        sesionActivaId = s.id;
        const enCurso = s.estado === 'EN_CURSO';
        sesEnInicio.innerHTML = `
          <div class="banner banner--${enCurso ? 'ok' : 'info'}">${enCurso ? 'Sesión en curso' : 'Sesión programada'}</div>
          <dl class="kv">
            <div><dt>Práctica</dt><dd>${esc(s.practica)}</dd></div>
            <div><dt>Inicia</dt><dd>${esc(formatFecha(s.fecha_inicio))}</dd></div>
            <div><dt>Termina</dt><dd>${esc(formatFecha(s.fecha_fin))}</dd></div>
          </dl>
        `;
      } else {
        sesEnInicio.innerHTML = '<div class="empty-state">No hay sesión activa para tu grupo en este momento.</div>';
      }
    };

    const renderSesionDetalle = () => {
      if (data.sesionActiva) {
        const s = data.sesionActiva;
        const enCurso = s.estado === 'EN_CURSO';
        sesDetalle.innerHTML = `
          <div class="banner banner--${enCurso ? 'ok' : 'info'}">${enCurso ? 'Sesión en curso' : 'Sesión programada'}</div>
          <dl class="kv">
            <div><dt>Práctica</dt><dd>${esc(s.practica)}</dd></div>
            ${s.practica_descripcion ? `<div><dt>Descripción</dt><dd>${esc(s.practica_descripcion)}</dd></div>` : ''}
            <div><dt>Inicia</dt><dd>${esc(formatFecha(s.fecha_inicio))}</dd></div>
            <div><dt>Termina</dt><dd>${esc(formatFecha(s.fecha_fin))}</dd></div>
            ${s.duracion_minutos ? `<div><dt>Duración</dt><dd>${s.duracion_minutos} min</dd></div>` : ''}
            <div><dt>Estado</dt><dd><span class="badge badge--${enCurso ? 'ok' : 'info'}">${esc(s.estado)}</span></dd></div>
          </dl>
        `;
      } else {
        sesDetalle.innerHTML = '<div class="empty-state">No hay sesión activa para tu grupo en este momento.</div>';
      }
    };

    renderSesionInicio();
    renderSesionDetalle();

    // Sugerencias y form de solicitud (solo en tab Sesión)
    const sugCard = document.getElementById('cardSugerencias');
    const sugList = document.getElementById('sugerenciasList');
    if (data.sesionActiva && data.materialesSugeridos && data.materialesSugeridos.length) {
      sugCard.hidden = false;
      sugList.innerHTML = data.materialesSugeridos.map((m) => `
        <li class="card-row">
          <div class="card-row__main">
            <div class="card-row__title">${esc(m.material)}</div>
            <div class="card-row__sub">Sugerido: ${m.cantidad_sugerida} · Stock: ${m.stock} · ${esc(m.material_estado)}</div>
          </div>
          ${m.material_activo && m.material_estado === 'DISPONIBLE' && m.stock > 0
            ? `<button class="btn btn-mini btn-secondary" data-mat="${m.material_id}" data-cant="${m.cantidad_sugerida}">Enviar solicitud</button>`
            : `<span class="badge badge--neutral">No disponible</span>`}
        </li>
      `).join('');

      sugList.querySelectorAll('button[data-mat]').forEach((b) => {
        b.addEventListener('click', () => solicitar(Number(b.dataset.mat), Number(b.dataset.cant)));
      });
    } else {
      sugCard.hidden = true;
    }

    const cardSol = document.getElementById('cardSolicitar');
    const select = document.getElementById('materialSel');
    if (data.sesionActiva && data.materialesDisponibles && data.materialesDisponibles.length) {
      cardSol.hidden = false;
      select.innerHTML = '<option value="">Selecciona un material...</option>' +
        data.materialesDisponibles.map((m) =>
          `<option value="${m.id}">${esc(m.nombre)} (stock ${m.stock})</option>`
        ).join('');
    } else {
      cardSol.hidden = true;
    }

    // Préstamos: separar activos (no DEVUELTO) vs historial (DEVUELTO)
    const todos = data.misPrestamos || [];
    const activos = todos.filter((p) => p.estado !== 'DEVUELTO');
    const historial = todos.filter((p) => p.estado === 'DEVUELTO');
    if (prestamosCtl) prestamosCtl.setData(activos);
    if (historialCtl) historialCtl.setData(historial);
    if (adeudosCtl) adeudosCtl.setData(data.misAdeudos || []);
    if (notifCtl) notifCtl.setData(data.notificaciones || []);
  };

  const renderPrestamoItem = (p) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(p.material)} × ${p.cantidad}</div>
        <div class="card-row__sub">${esc(p.practica)} · ${esc(formatFecha(p.fecha_prestamo))}</div>
        ${p.estado === 'PENDIENTE' ? '<div class="card-row__sub" style="color:var(--c-orange-700)">En espera de aprobación del administrador.</div>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="badge badge--${badgeForPrestamo(p.estado)}">${esc(p.estado)}</span>
      </div>
    </li>`;

  const renderHistorialItem = (p) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(p.material)} × ${p.cantidad}</div>
        <div class="card-row__sub">${esc(p.practica)} · ${esc(formatFecha(p.fecha_prestamo))}${p.fecha_devolucion ? ' → ' + esc(formatFecha(p.fecha_devolucion)) : ''}</div>
      </div>
      <span class="badge badge--ok">DEVUELTO</span>
    </li>`;

  const renderAdeudoItem = (a) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(a.material)} × ${a.cantidad}</div>
        <div class="card-row__sub">${esc(formatFecha(a.fecha_prestamo))}${a.incidencia_tipo ? ' · Incidencia: ' + esc(a.incidencia_tipo) : ''}</div>
        ${a.incidencia_descripcion ? `<div class="card-row__sub">"${esc(a.incidencia_descripcion)}"</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="badge badge--${badgeForPrestamo(a.prestamo_estado)}">${esc(a.prestamo_estado)}</span>
        ${a.incidencia_estado ? `<span class="badge badge--${a.incidencia_estado === 'PENDIENTE' ? 'warn' : 'ok'}">${esc(a.incidencia_estado)}</span>` : ''}
      </div>
    </li>`;

  const renderNotifItem = (n) => `
    <li>
      <div class="card-row__title">${esc(n.mensaje)}</div>
      <div class="card-row__sub">${esc(formatFecha(n.created_at))}${!n.leido ? ' · <span class="badge badge--info">NUEVA</span>' : ''}</div>
    </li>`;

  const badgeForPrestamo = (estado) => {
    switch (estado) {
      case 'PRESTADO': return 'info';
      case 'DEVUELTO': return 'ok';
      case 'PENDIENTE': return 'warn';
      case 'ADEUDO': return 'danger';
      default: return 'neutral';
    }
  };

  const submitPrestamo = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    if (!sesionActivaId) {
      flash('flash', 'No hay sesión activa.', 'error');
      return;
    }
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const materialId = Number(fd.get('material_id'));
    const cantidad = Number(fd.get('cantidad'));
    if (!materialId || !cantidad) {
      flash('flash', 'Selecciona material y cantidad.', 'error');
      return;
    }
    await solicitar(materialId, cantidad);
    form.reset();
  };

  const solicitar = async (materialId, cantidad) => {
    if (!sesionActivaId) {
      flash('flash', 'No hay sesión activa.', 'error');
      return;
    }
    const btn = document.getElementById('btnSolicitar');
    setLoading(btn, true);
    const r = await api('POST', '/turismo/estudiantes/prestamos', {
      sesion_id: sesionActivaId,
      material_id: materialId,
      cantidad
    });
    setLoading(btn, false);
    if (!r.ok) {
      flash('flash', (r.data && r.data.error) || 'No se pudo registrar el préstamo.', 'error');
      return;
    }
    flash('flash', (r.data && r.data.message) || 'Préstamo registrado.', 'ok');
    cargar();
  };

  const wireSubtabs = () => {
    document.querySelectorAll('.subtabs').forEach((bar) => {
      const buttons = bar.querySelectorAll('button[data-subtab]');
      buttons.forEach((b) => {
        b.addEventListener('click', () => {
          const key = b.dataset.subtab;
          buttons.forEach((x) => x.classList.toggle('is-active', x === b));
          const seccion = bar.closest('[data-tab]');
          seccion.querySelectorAll('[data-subtab-panel]').forEach((p) => {
            p.hidden = p.getAttribute('data-subtab-panel') !== key;
          });
        });
      });
    });
  };

  const initListas = () => {
    prestamosCtl = makePagedList(document.getElementById('prestamosBox'), {
      render: renderPrestamoItem,
      search: (p, q) =>
        (p.material || '').toLowerCase().includes(q) ||
        (p.practica || '').toLowerCase().includes(q),
      filters: { estado: (p, v) => p.estado === v },
      emptyHtml: '<li class="empty-state">Sin préstamos activos.</li>'
    });

    historialCtl = makePagedList(document.getElementById('historialBox'), {
      render: renderHistorialItem,
      search: (p, q) =>
        (p.material || '').toLowerCase().includes(q) ||
        (p.practica || '').toLowerCase().includes(q),
      emptyHtml: '<li class="empty-state">Sin historial todavía.</li>'
    });

    adeudosCtl = makePagedList(document.getElementById('adeudosBox'), {
      render: renderAdeudoItem,
      search: (a, q) =>
        (a.material || '').toLowerCase().includes(q) ||
        (a.incidencia_descripcion || '').toLowerCase().includes(q),
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
    usuario = await requireAuth({ fuente: 'TURISMO', roles: ['ALUMNO'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSubtabs();
    initListas();
    document.getElementById('formPrestamo').addEventListener('submit', submitPrestamo);
    cargar();
  });
})();
