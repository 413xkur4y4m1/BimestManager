// Dashboard Admin Turismo
(function () {
  'use strict';
  const { api, flash, clearFlash, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc } = window.BM;

  let usuario = null;
  let materialesCache = [];
  let practicasCache = [];
  let sesionesCache = [];
  let practicaSeleccionada = null;
  let alumnosPorSesionCache = {};

  const cargar = async () => {
    clearFlash('flash');
    const [resumen, pendientes, usuarios, materiales, practicas, sesiones, prestamos, incidencias] = await Promise.all([
      api('GET', '/turismo/admin/resumen'),
      api('GET', '/turismo/estudiantes/pendientes'),
      api('GET', '/turismo/admin/usuarios'),
      api('GET', '/turismo/admin/materiales?incluir_inactivos=true'),
      api('GET', '/turismo/admin/practicas?incluir_inactivas=true'),
      api('GET', '/turismo/admin/sesiones'),
      api('GET', '/turismo/admin/prestamos'),
      api('GET', '/turismo/admin/incidencias')
    ]);

    if (resumen.ok) renderResumen(resumen.data);
    if (pendientes.ok) renderPendientes(pendientes.data || []);
    if (usuarios.ok) renderUsuarios(usuarios.data || []);
    if (materiales.ok) { materialesCache = materiales.data || []; renderMateriales(materialesCache); }
    if (practicas.ok) { practicasCache = practicas.data || []; renderPracticas(practicasCache); }
    if (sesiones.ok) { sesionesCache = sesiones.data || []; renderSesiones(sesionesCache); }
    if (prestamos.ok) renderPrestamos(prestamos.data || []);
    if (incidencias.ok) renderIncidencias(incidencias.data || []);

    if (practicaSeleccionada) cargarSugerencias(practicaSeleccionada);
  };

  const renderResumen = (d) => {
    document.getElementById('welcomeSub').textContent = (usuario.nombre || '') + ' · ADMIN · TURISMO';
    const u = d.usuarios || {}, m = d.materiales || {}, s = d.sesiones || {}, p = d.prestamos || {}, i = d.incidencias || {};
    document.getElementById('resumenKv').innerHTML = `
      <div><dt>Admins</dt><dd>${u.admins ?? 0}</dd></div>
      <div><dt>Alumnos activos</dt><dd>${u.alumnos_activos ?? 0}</dd></div>
      <div><dt>Alumnos pendientes</dt><dd>${u.alumnos_pendientes ?? 0}</dd></div>
      <div><dt>Materiales disponibles</dt><dd>${m.disponibles ?? 0}</dd></div>
      <div><dt>Materiales dañados</dt><dd>${m.daniados ?? 0}</dd></div>
      <div><dt>Stock total</dt><dd>${m.stock_total ?? 0}</dd></div>
      <div><dt>Sesiones programadas</dt><dd>${s.programadas ?? 0}</dd></div>
      <div><dt>Sesiones en curso</dt><dd>${s.en_curso ?? 0}</dd></div>
      <div><dt>Préstamos activos</dt><dd>${p.prestados ?? 0}</dd></div>
      <div><dt>Adeudos</dt><dd>${p.adeudos ?? 0}</dd></div>
      <div><dt>Incidencias pendientes</dt><dd>${i.pendientes ?? 0}</dd></div>
    `;
  };

  // ===== Pendientes con select de grupo en lugar de prompt =====
  const renderPendientes = (ps) => {
    const list = document.getElementById('pendientesList');
    if (!ps.length) { list.innerHTML = '<li class="empty-state">Sin alumnos pendientes.</li>'; return; }
    list.innerHTML = ps.map((p) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(p.nombre)}</div>
          <div class="card-row__sub">${esc(p.email)}${p.grupo ? ' · ' + esc(p.grupo) : ' · sin grupo'}</div>
          <input type="text" class="field-sel" data-grupo-pend="${p.id}" placeholder="Grupo (opcional, ej. GTU-1)" value="${esc(p.grupo || '')}" maxlength="50" style="margin-top:6px;font-size:12px;padding:6px 10px;border-radius:10px;width:100%">
        </div>
        <button class="btn btn-mini btn-secondary" data-activar="${p.id}">Autorizar</button>
      </li>`).join('');

    list.querySelectorAll('button[data-activar]').forEach((b) => {
      b.addEventListener('click', () => {
        const inp = list.querySelector(`input[data-grupo-pend="${b.dataset.activar}"]`);
        const grupo = (inp && inp.value || '').trim();
        activar(Number(b.dataset.activar), grupo);
      });
    });
  };

  const activar = async (id, grupo) => {
    const body = grupo ? { grupo } : {};
    const r = await api('PATCH', '/turismo/estudiantes/' + id + '/activar', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error al autorizar', 'error'); return; }
    flash('flash', 'Alumno autorizado.', 'ok');
    cargar();
  };

  // ===== Usuarios activos: cambiar grupo + activar/desactivar =====
  const renderUsuarios = (us) => {
    const list = document.getElementById('usuariosList');
    if (!us.length) { list.innerHTML = '<li class="empty-state">Sin usuarios.</li>'; return; }
    list.innerHTML = us.map((u) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(u.nombre)} <span class="badge badge--neutral">${esc(u.rol)}</span></div>
          <div class="card-row__sub">${esc(u.email)}${u.grupo ? ' · ' + esc(u.grupo) : ''}</div>
          ${u.rol === 'ALUMNO' ? `
            <div style="display:flex;gap:6px;margin-top:6px">
              <input type="text" class="field-sel" data-grupo-asig="${u.id}" placeholder="Grupo" value="${esc(u.grupo || '')}" maxlength="50" style="font-size:12px;padding:6px 10px;border-radius:10px;flex:1">
              <button class="btn btn-mini btn-primary" data-asignar="${u.id}">Guardar</button>
            </div>` : ''}
        </div>
        <button class="btn btn-mini ${u.is_active ? 'btn-ghost' : 'btn-secondary'}" data-toggle="${u.id}" data-active="${u.is_active ? 1 : 0}">${u.is_active ? 'Desactivar' : 'Activar'}</button>
      </li>`).join('');

    list.querySelectorAll('button[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => toggleUsuario(Number(b.dataset.toggle), b.dataset.active === '0'));
    });
    list.querySelectorAll('button[data-asignar]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.asignar);
        const inp = list.querySelector(`input[data-grupo-asig="${id}"]`);
        const grupo = (inp && inp.value || '').trim();
        asignarGrupo(id, grupo);
      });
    });
  };

  const toggleUsuario = async (id, activar) => {
    const r = await api('PATCH', '/turismo/admin/usuarios/' + id + '/estado', { activo: activar });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  const asignarGrupo = async (id, grupo) => {
    if (!grupo) {
      flash('flash', 'Escribe el nombre del grupo.', 'error');
      return;
    }
    const r = await api('PATCH', '/turismo/admin/usuarios/' + id + '/grupo', { grupo });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Grupo actualizado.', 'ok');
    cargar();
  };

  // ===== Materiales =====
  const renderMateriales = (ms) => {
    const list = document.getElementById('materialesList');

    // Llenar select de materiales en sugerencias y préstamo manual
    const opcionesActivas = ms
      .filter((m) => m.is_active)
      .map((m) => `<option value="${m.id}">${esc(m.nombre)} (${esc(m.estado)} · stock ${m.stock})</option>`)
      .join('');
    const sugMatSel = document.getElementById('sugMatSel');
    if (sugMatSel) sugMatSel.innerHTML = '<option value="">Material...</option>' + opcionesActivas;
    const matPrestSel = document.getElementById('matPrestSel');
    if (matPrestSel) matPrestSel.innerHTML = '<option value="">Material...</option>' + ms
      .filter((m) => m.is_active && m.estado === 'DISPONIBLE' && m.stock > 0)
      .map((m) => `<option value="${m.id}">${esc(m.nombre)} (stock ${m.stock})</option>`)
      .join('');

    if (!ms.length) { list.innerHTML = '<li class="empty-state">Sin materiales.</li>'; return; }
    list.innerHTML = ms.map((m) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(m.nombre)} <span class="badge badge--${m.estado === 'DAÑADO' ? 'danger' : 'ok'}">${esc(m.estado)}</span> ${m.is_active ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
          <div class="card-row__sub">Stock: ${m.stock}</div>
          ${m.is_active ? `
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="btn btn-mini btn-secondary" data-stock="${m.id}" data-delta="1">+1</button>
              <button class="btn btn-mini btn-secondary" data-stock="${m.id}" data-delta="-1">-1</button>
              <button class="btn btn-mini btn-ghost" data-estado="${m.id}" data-target="${m.estado === 'DAÑADO' ? 'DISPONIBLE' : 'DAÑADO'}">→ ${m.estado === 'DAÑADO' ? 'DISPONIBLE' : 'DAÑADO'}</button>
              <button class="btn btn-mini btn-danger" data-baja="${m.id}">Baja</button>
            </div>
          ` : ''}
        </div>
      </li>`).join('');

    list.querySelectorAll('button[data-stock]').forEach((b) => {
      b.addEventListener('click', () => ajustarStock(Number(b.dataset.stock), Number(b.dataset.delta)));
    });
    list.querySelectorAll('button[data-estado]').forEach((b) => {
      b.addEventListener('click', () => cambiarEstadoMaterial(Number(b.dataset.estado), b.dataset.target));
    });
    list.querySelectorAll('button[data-baja]').forEach((b) => {
      b.addEventListener('click', () => darBajaMaterial(Number(b.dataset.baja)));
    });
  };

  const ajustarStock = async (id, delta) => {
    const r = await api('PATCH', '/turismo/admin/materiales/' + id + '/stock', { delta });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  const cambiarEstadoMaterial = async (id, estado) => {
    const r = await api('PATCH', '/turismo/admin/materiales/' + id + '/estado', { estado });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Estado actualizado.', 'ok');
    cargar();
  };

  const darBajaMaterial = async (id) => {
    if (!window.confirm('¿Dar de baja este material?')) return;
    const r = await api('DELETE', '/turismo/admin/materiales/' + id);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Material dado de baja.', 'ok');
    cargar();
  };

  // ===== Prácticas + sugerencias =====
  const renderPracticas = (ps) => {
    const list = document.getElementById('practicasList');
    const sel = document.getElementById('practicaSel');
    if (sel) sel.innerHTML = '<option value="">Práctica...</option>' +
      ps.filter((p) => p.is_active).map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');

    if (!ps.length) { list.innerHTML = '<li class="empty-state">Sin prácticas.</li>'; return; }
    list.innerHTML = ps.map((p) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(p.nombre)} ${p.is_active ? '' : '<span class="badge badge--neutral">INACTIVA</span>'}</div>
          <div class="card-row__sub">${esc(p.descripcion || '')}${p.duracion_minutos ? ' · ' + p.duracion_minutos + ' min' : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <button class="btn btn-mini btn-primary" data-sug="${p.id}">Sugerencias</button>
          ${p.is_active ? `<button class="btn btn-mini btn-ghost" data-baja-pr="${p.id}">Baja</button>` : ''}
        </div>
      </li>`).join('');

    list.querySelectorAll('button[data-sug]').forEach((b) => {
      b.addEventListener('click', () => abrirSugerencias(Number(b.dataset.sug)));
    });
    list.querySelectorAll('button[data-baja-pr]').forEach((b) => {
      b.addEventListener('click', () => darBajaPractica(Number(b.dataset.bajaPr)));
    });
  };

  const abrirSugerencias = (practicaId) => {
    practicaSeleccionada = practicaId;
    document.getElementById('sugerenciasCard').hidden = false;
    document.getElementById('sugerenciasCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    cargarSugerencias(practicaId);
  };

  const cargarSugerencias = async (practicaId) => {
    const r = await api('GET', '/turismo/admin/practicas/' + practicaId + '/sugerencias');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    renderSugerencias(r.data);
  };

  const renderSugerencias = (data) => {
    document.getElementById('sugerenciasPracticaNombre').textContent = (data.practica && data.practica.nombre) || '—';
    const cont = document.getElementById('sugerenciasContainer');
    if (!data.sugerencias || !data.sugerencias.length) {
      cont.innerHTML = '<div class="empty-state">Esta práctica aún no tiene materiales sugeridos.</div>';
      return;
    }
    cont.innerHTML = '<ul class="list">' + data.sugerencias.map((s) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(s.material)} ${s.material_activo ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
          <div class="card-row__sub">Sugerido: ${s.cantidad_sugerida} · Stock: ${s.stock} · ${esc(s.material_estado)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <input type="number" min="1" value="${s.cantidad_sugerida}" data-cant-sug="${s.id}" style="width:60px;padding:6px;border-radius:8px;border:1px solid var(--c-line);font-size:13px">
          <button class="btn btn-mini btn-secondary" data-actu-sug="${s.id}">✓</button>
          <button class="btn btn-mini btn-danger" data-elim-sug="${s.id}">×</button>
        </div>
      </li>
    `).join('') + '</ul>';

    cont.querySelectorAll('button[data-actu-sug]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.actuSug);
        const inp = cont.querySelector(`input[data-cant-sug="${id}"]`);
        const cant = Number(inp && inp.value);
        actualizarSugerencia(id, cant);
      });
    });
    cont.querySelectorAll('button[data-elim-sug]').forEach((b) => {
      b.addEventListener('click', () => eliminarSugerencia(Number(b.dataset.elimSug)));
    });
  };

  const actualizarSugerencia = async (id, cantidad) => {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      flash('flash', 'Cantidad inválida.', 'error');
      return;
    }
    const r = await api('PATCH', '/turismo/admin/sugerencias/' + id, { cantidad_sugerida: cantidad });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Sugerencia actualizada.', 'ok');
    if (practicaSeleccionada) cargarSugerencias(practicaSeleccionada);
  };

  const eliminarSugerencia = async (id) => {
    if (!window.confirm('¿Eliminar esta sugerencia?')) return;
    const r = await api('DELETE', '/turismo/admin/sugerencias/' + id);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Sugerencia eliminada.', 'ok');
    if (practicaSeleccionada) cargarSugerencias(practicaSeleccionada);
  };

  const submitSugerencia = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    if (!practicaSeleccionada) {
      flash('flash', 'Selecciona una práctica primero.', 'error');
      return;
    }
    const fd = new FormData(ev.currentTarget);
    const body = {
      material_id: Number(fd.get('material_id')),
      cantidad_sugerida: Number(fd.get('cantidad_sugerida'))
    };
    const r = await api('POST', '/turismo/admin/practicas/' + practicaSeleccionada + '/sugerencias', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo agregar', 'error'); return; }
    flash('flash', 'Sugerencia agregada.', 'ok');
    ev.target.reset();
    cargarSugerencias(practicaSeleccionada);
  };

  const darBajaPractica = async (id) => {
    if (!window.confirm('¿Dar de baja esta práctica?')) return;
    const r = await api('DELETE', '/turismo/admin/practicas/' + id);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Práctica dada de baja.', 'ok');
    cargar();
  };

  // ===== Sesiones =====
  const renderSesiones = (ss) => {
    const list = document.getElementById('sesionesList');
    const sel = document.getElementById('sesionPrestSel');
    if (sel) {
      sel.innerHTML = '<option value="">Sesión...</option>' +
        ss.filter((s) => s.estado !== 'FINALIZADA').map((s) =>
          `<option value="${s.id}">${esc(s.practica)} · ${esc(s.grupo)} · ${esc(formatFecha(s.fecha_inicio))}</option>`
        ).join('');
    }

    if (!ss.length) { list.innerHTML = '<li class="empty-state">Sin sesiones.</li>'; return; }
    list.innerHTML = ss.map((s) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(s.practica)} · ${esc(s.grupo)}</div>
          <div class="card-row__sub">${esc(formatFecha(s.fecha_inicio))} → ${esc(formatFecha(s.fecha_fin))}</div>
          <div class="card-row__sub">Préstamos: ${s.total_prestamos ?? 0}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="badge badge--${s.estado === 'EN_CURSO' ? 'ok' : s.estado === 'FINALIZADA' ? 'neutral' : 'info'}">${esc(s.estado)}</span>
          ${s.estado !== 'FINALIZADA' ? `
            <select data-cambiar="${s.id}" style="font-size:12px;padding:4px 8px;border-radius:8px">
              <option value="">Cambiar a...</option>
              ${s.estado !== 'EN_CURSO' ? '<option value="EN_CURSO">EN_CURSO</option>' : ''}
              <option value="FINALIZADA">FINALIZADA</option>
            </select>` : ''}
        </div>
      </li>`).join('');

    list.querySelectorAll('select[data-cambiar]').forEach((sel) => {
      sel.addEventListener('change', () => cambiarEstadoSesion(Number(sel.dataset.cambiar), sel.value));
    });
  };

  const cambiarEstadoSesion = async (id, estado) => {
    if (!estado) return;
    const r = await api('PATCH', '/turismo/admin/sesiones/' + id + '/estado', { estado });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  // Cuando el admin elige una sesión en el form de préstamo manual, traer los alumnos del grupo
  const cargarAlumnosDeSesion = async (sesionId) => {
    const sel = document.getElementById('alumnoPrestSel');
    if (!sel || !sesionId) {
      if (sel) sel.innerHTML = '<option value="">Alumno (selecciona sesión primero)...</option>';
      return;
    }
    if (alumnosPorSesionCache[sesionId]) {
      llenarSelectAlumnos(alumnosPorSesionCache[sesionId]);
      return;
    }
    const r = await api('GET', '/turismo/admin/sesiones/' + sesionId);
    if (!r.ok) { sel.innerHTML = '<option value="">No se pudieron cargar alumnos</option>'; return; }
    alumnosPorSesionCache[sesionId] = r.data.alumnos || [];
    llenarSelectAlumnos(alumnosPorSesionCache[sesionId]);
  };

  const llenarSelectAlumnos = (alumnos) => {
    const sel = document.getElementById('alumnoPrestSel');
    if (!sel) return;
    if (!alumnos.length) {
      sel.innerHTML = '<option value="">No hay alumnos activos en el grupo</option>';
      return;
    }
    sel.innerHTML = '<option value="">Alumno...</option>' +
      alumnos.filter((a) => a.is_active).map((a) =>
        `<option value="${a.id}">${esc(a.nombre)} · ${esc(a.email)}</option>`
      ).join('');
  };

  // ===== Préstamos =====
  const renderPrestamos = (ps) => {
    const list = document.getElementById('prestamosList');
    if (!ps.length) { list.innerHTML = '<li class="empty-state">Sin préstamos.</li>'; return; }
    list.innerHTML = ps.slice(0, 50).map((p) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(p.alumno)} → ${esc(p.material)} × ${p.cantidad}</div>
          <div class="card-row__sub">${esc(p.grupo)} · ${esc(formatFecha(p.fecha_prestamo))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="badge badge--${p.estado === 'PRESTADO' ? 'info' : p.estado === 'DEVUELTO' ? 'ok' : p.estado === 'ADEUDO' ? 'danger' : 'warn'}">${esc(p.estado)}</span>
          ${p.estado === 'PRESTADO' || p.estado === 'PENDIENTE' ? `
            <div style="display:flex;gap:6px">
              <button class="btn btn-mini btn-secondary" data-devolver="${p.id}">Devolver</button>
              <button class="btn btn-mini btn-ghost" data-adeudo="${p.id}">Adeudo</button>
            </div>` : ''}
        </div>
      </li>`).join('');

    list.querySelectorAll('button[data-devolver]').forEach((b) => {
      b.addEventListener('click', () => devolverPrestamo(Number(b.dataset.devolver)));
    });
    list.querySelectorAll('button[data-adeudo]').forEach((b) => {
      b.addEventListener('click', () => marcarAdeudo(Number(b.dataset.adeudo)));
    });
  };

  const devolverPrestamo = async (id) => {
    const r = await api('PATCH', '/turismo/admin/prestamos/' + id + '/devolucion');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  const marcarAdeudo = async (id) => {
    if (!window.confirm('¿Marcar este préstamo como adeudo?')) return;
    const r = await api('PATCH', '/turismo/admin/prestamos/' + id + '/adeudo');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  // ===== Incidencias =====
  const renderIncidencias = (xs) => {
    const list = document.getElementById('incidenciasList');
    if (!xs.length) { list.innerHTML = '<li class="empty-state">Sin incidencias.</li>'; return; }
    list.innerHTML = xs.slice(0, 50).map((x) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(x.material)} <span class="badge badge--danger">${esc(x.tipo)}</span></div>
          <div class="card-row__sub">${esc(x.alumno)} · ${esc(x.grupo)} · ${esc(formatFecha(x.created_at))}</div>
          ${x.descripcion ? `<div class="card-row__sub">"${esc(x.descripcion)}"</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          ${x.estado === 'PENDIENTE'
            ? `<button class="btn btn-mini btn-secondary" data-resolver="${x.id}">Resolver</button>
               <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--c-ink-soft)">
                 <input type="checkbox" data-marcar-dev="${x.id}" style="width:14px;height:14px"> dev. material
               </label>`
            : `<span class="badge badge--ok">${esc(x.estado)}</span>`
          }
        </div>
      </li>`).join('');

    list.querySelectorAll('button[data-resolver]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.resolver);
        const chk = list.querySelector(`input[data-marcar-dev="${id}"]`);
        const dev = chk && chk.checked;
        resolverIncidencia(id, dev);
      });
    });
  };

  const resolverIncidencia = async (id, marcarDevuelto) => {
    const r = await api('PATCH', '/turismo/admin/incidencias/' + id + '/resolver', {
      marcar_prestamo_devuelto: marcarDevuelto
    });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Incidencia resuelta.', 'ok');
    cargar();
  };

  // ===== Submits =====
  const submitUsuario = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const body = Object.fromEntries(new FormData(ev.currentTarget));
    const r = await api('POST', '/turismo/admin/usuarios', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Admin creado.', 'ok');
    ev.target.reset();
    cargar();
  };

  const submitMaterial = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      nombre: fd.get('nombre'),
      stock: Number(fd.get('stock')),
      estado: fd.get('estado') || 'DISPONIBLE'
    };
    const r = await api('POST', '/turismo/admin/materiales', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Material creado.', 'ok');
    ev.target.reset();
    cargar();
  };

  const submitPractica = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      nombre: fd.get('nombre'),
      descripcion: fd.get('descripcion') || null,
      duracion_minutos: fd.get('duracion_minutos') ? Number(fd.get('duracion_minutos')) : null
    };
    const r = await api('POST', '/turismo/admin/practicas', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Práctica creada.', 'ok');
    ev.target.reset();
    cargar();
  };

  const submitSesion = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      practica_id: Number(fd.get('practica_id')),
      grupo: fd.get('grupo'),
      fecha_inicio: fd.get('fecha_inicio'),
      fecha_fin: fd.get('fecha_fin')
    };
    const r = await api('POST', '/turismo/admin/sesiones', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Sesión creada.', 'ok');
    ev.target.reset();
    cargar();
  };

  const submitPrestamo = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      sesion_id: Number(fd.get('sesion_id')),
      alumno_id: Number(fd.get('alumno_id')),
      material_id: Number(fd.get('material_id')),
      cantidad: Number(fd.get('cantidad'))
    };
    const r = await api('POST', '/turismo/admin/prestamos', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo registrar', 'error'); return; }
    flash('flash', 'Préstamo registrado.', 'ok');
    ev.target.reset();
    alumnosPorSesionCache = {};
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
    usuario = await requireAuth({ fuente: 'TURISMO', roles: ['ADMIN'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSubtabs();
    document.getElementById('formUsuario').addEventListener('submit', submitUsuario);
    document.getElementById('formMaterial').addEventListener('submit', submitMaterial);
    document.getElementById('formPractica').addEventListener('submit', submitPractica);
    document.getElementById('formSesion').addEventListener('submit', submitSesion);
    document.getElementById('formSugerencia').addEventListener('submit', submitSugerencia);
    document.getElementById('formPrestamo').addEventListener('submit', submitPrestamo);
    document.getElementById('sesionPrestSel').addEventListener('change', (ev) => {
      cargarAlumnosDeSesion(Number(ev.target.value));
    });
    cargar();
  });
})();
