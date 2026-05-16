// Dashboard alumno Turismo
(function () {
  'use strict';
  const { api, flash, clearFlash, setLoading, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc } = window.BM;

  let usuario = null;
  let sesionActivaId = null;

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
            ? `<button class="btn btn-mini btn-secondary" data-mat="${m.material_id}" data-cant="${m.cantidad_sugerida}">Solicitar</button>`
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

    // Préstamos (separar activos vs historial)
    const todos = data.misPrestamos || [];
    const activos = todos.filter((p) => p.estado !== 'DEVUELTO');
    const historial = todos.filter((p) => p.estado === 'DEVUELTO');

    const prEl = document.getElementById('prestamosList');
    if (!activos.length) {
      prEl.innerHTML = '<li class="empty-state">Sin préstamos activos.</li>';
    } else {
      prEl.innerHTML = activos.map((p) => `
        <li class="card-row">
          <div class="card-row__main">
            <div class="card-row__title">${esc(p.material)} × ${p.cantidad}</div>
            <div class="card-row__sub">${esc(p.practica)} · ${esc(formatFecha(p.fecha_prestamo))}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <span class="badge badge--${badgeForPrestamo(p.estado)}">${esc(p.estado)}</span>
            ${p.estado === 'PRESTADO' ? `
              <details style="margin-top:4px">
                <summary style="color:var(--c-orange-700);font-weight:600;cursor:pointer;font-size:12px">Reportar incidencia</summary>
                <form class="form-card" data-incidencia="${p.id}" style="margin-top:6px">
                  <div class="field-tight">
                    <select name="tipo" required>
                      <option value="">Tipo...</option>
                      <option value="ROTO">ROTO</option>
                      <option value="PERDIDO">PERDIDO</option>
                    </select>
                  </div>
                  <div class="field-tight">
                    <input name="descripcion" placeholder="Describe lo ocurrido (opcional)" maxlength="255">
                  </div>
                  <button class="btn btn-mini btn-danger" type="submit">Reportar</button>
                </form>
              </details>
            ` : ''}
          </div>
        </li>
      `).join('');

      prEl.querySelectorAll('form[data-incidencia]').forEach((f) => {
        f.addEventListener('submit', (ev) => submitIncidencia(ev, Number(f.dataset.incidencia)));
      });
    }

    const histEl = document.getElementById('historialList');
    if (!historial.length) {
      histEl.innerHTML = '<li class="empty-state">Sin historial todavía.</li>';
    } else {
      histEl.innerHTML = historial.slice(0, 50).map((p) => `
        <li class="card-row">
          <div class="card-row__main">
            <div class="card-row__title">${esc(p.material)} × ${p.cantidad}</div>
            <div class="card-row__sub">${esc(p.practica)} · ${esc(formatFecha(p.fecha_prestamo))}${p.fecha_devolucion ? ' → ' + esc(formatFecha(p.fecha_devolucion)) : ''}</div>
          </div>
          <span class="badge badge--ok">DEVUELTO</span>
        </li>
      `).join('');
    }

    // Adeudos
    const adEl = document.getElementById('adeudosList');
    if (!data.misAdeudos || data.misAdeudos.length === 0) {
      adEl.innerHTML = '<li class="empty-state">Sin adeudos.</li>';
    } else {
      adEl.innerHTML = data.misAdeudos.map((a) => `
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
        </li>
      `).join('');
    }

    // Notificaciones
    const noEl = document.getElementById('notifList');
    if (!data.notificaciones || data.notificaciones.length === 0) {
      noEl.innerHTML = '<li class="empty-state">Sin notificaciones.</li>';
    } else {
      noEl.innerHTML = data.notificaciones.slice(0, 30).map((n) => `
        <li>
          <div class="card-row__title">${esc(n.mensaje)}</div>
          <div class="card-row__sub">${esc(formatFecha(n.created_at))}${!n.leido ? ' · <span class="badge badge--info">NUEVA</span>' : ''}</div>
        </li>
      `).join('');
    }
  };

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

  const submitIncidencia = async (ev, prestamoId) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const tipo = String(fd.get('tipo') || '').toUpperCase();
    const descripcion = String(fd.get('descripcion') || '').trim();
    if (!tipo) {
      flash('flash', 'Selecciona un tipo de incidencia.', 'error');
      return;
    }
    const r = await api('POST', '/turismo/estudiantes/prestamos/' + prestamoId + '/incidencia', {
      tipo, descripcion
    });
    if (!r.ok) {
      flash('flash', (r.data && r.data.error) || 'No se pudo reportar la incidencia.', 'error');
      return;
    }
    flash('flash', (r.data && r.data.message) || 'Incidencia reportada.', 'ok');
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

  document.addEventListener('DOMContentLoaded', async () => {
    usuario = await requireAuth({ fuente: 'TURISMO', roles: ['ALUMNO'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSubtabs();
    document.getElementById('formPrestamo').addEventListener('submit', submitPrestamo);
    cargar();
  });
})();
