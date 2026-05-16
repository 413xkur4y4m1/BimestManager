// Dashboard alumno Quimica
(function () {
  'use strict';
  const { api, flash, clearFlash, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc } = window.BM;

  let usuario = null;

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
          <div class="card-row__title">${esc(i.nombre)}${esTu ? ' <span class="badge badge--info">Tú</span>' : ''}</div>
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

    const adEl = document.getElementById('adeudosList');
    if (!data.adeudos || data.adeudos.length === 0) {
      adEl.innerHTML = '<li class="empty-state">Sin adeudos.</li>';
    } else {
      adEl.innerHTML = data.adeudos.map((a) => `
        <li class="card-row">
          <div class="card-row__main">
            <div class="card-row__title">${esc(a.material)}</div>
            <div class="card-row__sub">${esc(formatFecha(a.created_at))}</div>
          </div>
          <span class="badge badge--${a.estado === 'PENDIENTE' ? 'warn' : 'ok'}">${esc(a.estado)}</span>
        </li>
      `).join('');
    }

    const noEl = document.getElementById('notifList');
    if (!data.notificaciones || data.notificaciones.length === 0) {
      noEl.innerHTML = '<li class="empty-state">Sin notificaciones.</li>';
    } else {
      noEl.innerHTML = data.notificaciones.map((n) => `
        <li>
          <div class="card-row__title">${esc(n.mensaje)}</div>
          <div class="card-row__sub">${esc(formatFecha(n.created_at))}</div>
        </li>
      `).join('');
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    usuario = await requireAuth({ fuente: 'QUIMICA', roles: ['ALUMNO'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    cargar();
  });
})();
