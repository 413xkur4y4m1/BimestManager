// Dashboard Maestro
(function () {
  'use strict';
  const { api, flash, clearFlash, setLoading, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc, makePagedList } = window.BM;

  let usuario = null;
  let grupos = [];
  let sesionesCache = [];
  let pendientesCache = [];
  let sesionEquiposActiva = null;
  let alumnosSesion = [];
  let materialesCache = [];

  let sesionesCtl = null;
  let pendientesCtl = null;
  let alumnosActivosCtl = null;
  let gruposCtl = null;
  let equiposCtl = null;

  const cargar = async () => {
    clearFlash('flash');
    const [resumen, sesiones, gruposRes, practicas, pendientes, materiales] = await Promise.all([
      api('GET', '/maestro/resumen'),
      api('GET', '/maestro/sesiones'),
      api('GET', '/maestro/grupos'),
      api('GET', '/maestro/practicas?tipo=QUIMICA'),
      api('GET', '/estudiantes/pendientes'),
      api('GET', '/maestro/materiales')
    ]);

    if (resumen.ok) renderResumen(resumen.data);
    if (gruposRes.ok) { grupos = gruposRes.data || []; renderGrupos(grupos); }
    if (practicas.ok) renderPracticas(practicas.data || []);
    if (sesiones.ok) { sesionesCache = sesiones.data || []; renderSesiones(sesionesCache); }
    if (pendientes.ok) { pendientesCache = pendientes.data || []; renderPendientes(pendientesCache); }
    if (materiales.ok) { materialesCache = materiales.data || []; }

    // Refrescar el bloque de armar equipos si hay sesion seleccionada
    if (sesionEquiposActiva) cargarAlumnosSesion(sesionEquiposActiva);

    // Refrescar lista de alumnos activos
    cargarAlumnosActivos();

    // Refrescar tab Equipos
    cargarEquiposGlobal();
  };

  // ===== Tab Equipos (lista plana) =====
  const cargarEquiposGlobal = async () => {
    const incluirFin = !!document.getElementById('chkIncluirFinalizadas')?.checked;
    const url = incluirFin ? '/maestro/equipos?incluir_finalizadas=1' : '/maestro/equipos';
    const r = await api('GET', url);
    if (!r.ok) {
      if (equiposCtl) equiposCtl.setData([]);
      return;
    }
    if (equiposCtl) equiposCtl.setData(r.data || []);
  };

  const renderEquipoItem = (eq) => {
    const opcionesMaterial = materialesCache
      .map((m) => `<option value="${m.id}">${esc(m.nombre)} (stock ${m.stock})</option>`)
      .join('');
    const opcionesResp = (eq.integrantes || [])
      .map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`)
      .join('');
    const fechaCorta = eq.fecha ? formatFecha(eq.fecha) : '';
    const estadoClass = eq.sesion_estado === 'EN_CURSO' ? 'ok' : eq.sesion_estado === 'FINALIZADA' ? 'neutral' : 'info';
    return `
      <article class="card">
        <h3 style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <span>${esc(eq.nombre)}</span>
          <span class="badge badge--${estadoClass}">${esc(eq.sesion_estado)}</span>
        </h3>
        <div class="card-row__sub" style="margin-bottom:6px">
          ${esc(eq.practica)} · ${esc(eq.grupo)} · ${esc(fechaCorta)}${eq.hora_inicio ? ' ' + esc(eq.hora_inicio) : ''}
        </div>
        ${eq.incidencias_total ? `<div class="card-row__sub" style="margin-bottom:6px"><span class="badge badge--danger">${eq.incidencias_total} incidencia${eq.incidencias_total === 1 ? '' : 's'}</span></div>` : ''}

        <ul class="list" style="margin-bottom:6px">
          ${(eq.integrantes || []).map((i) => `
            <li><div class="card-row__title" style="font-size:13px">${esc(i.nombre)}</div><div class="card-row__sub">${esc(i.email)}</div></li>
          `).join('') || '<li class="empty-state">Sin integrantes.</li>'}
        </ul>

        ${eq.sesion_estado === 'FINALIZADA' ? `
          <div class="muted" style="font-size:12px">Sesión finalizada — no puedes registrar nuevas incidencias.</div>
        ` : `
          <details>
            <summary style="color:var(--c-teal-700);font-weight:600;cursor:pointer;font-size:13px;padding:6px 0">+ Reportar incidencia</summary>
            <form class="form-card" data-incidencia-global="${eq.id}" data-sesion="${eq.sesion_id}" style="margin-top:8px">
              <div class="field-tight">
                <select name="material_id" required>
                  <option value="">Material...</option>
                  ${opcionesMaterial}
                </select>
              </div>
              <div class="field-tight">
                <select name="tipo" required>
                  <option value="">Tipo...</option>
                  <option value="ROTO">ROTO</option>
                  <option value="PERDIDO">PERDIDO</option>
                </select>
              </div>
              <div class="field-tight">
                <select name="responsable_usuario_id">
                  <option value="">Sin responsable individual</option>
                  ${opcionesResp}
                </select>
              </div>
              <div class="field-tight">
                <input name="descripcion" placeholder="Descripción (opcional)" maxlength="255">
              </div>
              <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--c-ink-soft);margin:6px 0">
                <input type="checkbox" name="generar_adeudo" style="width:18px;height:18px;accent-color:var(--c-orange-600)">
                Generar adeudo al responsable
              </label>
              <button class="btn btn-primary" type="submit">Registrar incidencia</button>
            </form>
          </details>
        `}
      </article>
    `;
  };

  const wireEquiposBotones = (slice, listEl) => {
    listEl.querySelectorAll('form[data-incidencia-global]').forEach((f) => {
      f.addEventListener('submit', (ev) => {
        const sesionId = Number(f.dataset.sesion);
        const equipoId = Number(f.dataset.incidenciaGlobal);
        submitIncidenciaGlobal(ev, sesionId, equipoId);
      });
    });
  };

  const submitIncidenciaGlobal = async (ev, sesionId, equipoId) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      equipo_id: equipoId,
      material_id: Number(fd.get('material_id')),
      tipo: String(fd.get('tipo') || '').toUpperCase(),
      responsable_usuario_id: fd.get('responsable_usuario_id') || null,
      descripcion: String(fd.get('descripcion') || '').trim() || null,
      generar_adeudo: fd.get('generar_adeudo') === 'on'
    };
    const r = await api('POST', '/maestro/sesiones/' + sesionId + '/incidencias', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo registrar la incidencia', 'error'); return; }
    flash('flash', (r.data && r.data.message) || 'Incidencia registrada.', 'ok');
    ev.target.reset();
    cargarEquiposGlobal();
    if (sesionEquiposActiva === sesionId) cargarAlumnosSesion(sesionId);
  };

  const renderResumen = (data) => {
    document.getElementById('welcomeTitle').textContent = 'Panel ' + (usuario.rol === 'ADMIN' ? 'Admin' : 'Maestro');
    document.getElementById('welcomeSub').textContent = usuario.nombre + ' · QUIMICA';
    const kv = document.getElementById('resumenKv');
    const e = data.sesiones_por_estado || {};
    kv.innerHTML = `
      <div><dt>Alumnos pendientes</dt><dd>${data.alumnos_pendientes ?? 0}</dd></div>
      <div><dt>Sesiones programadas</dt><dd>${e.PROGRAMADA ?? 0}</dd></div>
      <div><dt>Sesiones en curso</dt><dd>${e.EN_CURSO ?? 0}</dd></div>
      <div><dt>Sesiones finalizadas</dt><dd>${e.FINALIZADA ?? 0}</dd></div>
    `;
    const px = document.getElementById('proximaSesion');
    if (data.proxima_sesion) {
      const p = data.proxima_sesion;
      px.innerHTML = `
        <dl class="kv">
          <div><dt>Práctica</dt><dd>${esc(p.practica)}</dd></div>
          <div><dt>Grupo</dt><dd>${esc(p.grupo)}</dd></div>
          <div><dt>Fecha</dt><dd>${esc(formatFecha(p.fecha))}${p.hora_inicio ? ' ' + esc(p.hora_inicio) : ''}</dd></div>
          <div><dt>Estado</dt><dd><span class="badge badge--${p.estado === 'EN_CURSO' ? 'ok' : 'info'}">${esc(p.estado)}</span></dd></div>
        </dl>
      `;
    } else {
      px.innerHTML = '<div class="empty-state">No tienes sesiones próximas.</div>';
    }
  };

  const renderGrupos = (gs) => {
    const sel = document.getElementById('grupoSel');
    sel.innerHTML = '<option value="">Selecciona...</option>' +
      gs.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');

    const filtroSel = document.getElementById('grupoFiltroSel');
    if (filtroSel) {
      const valorActual = filtroSel.value;
      filtroSel.innerHTML = '<option value="">Mostrar todos los grupos</option>' +
        gs.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');
      filtroSel.value = valorActual;
    }

    if (gruposCtl) gruposCtl.setData(gs);
  };

  const renderGrupoItem = (g) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(g.nombre)}</div>
        <div class="card-row__sub">${g.alumnos_activos} activos · ${g.alumnos_pendientes} pendientes</div>
      </div>
    </li>`;

  const renderPracticas = (ps) => {
    const sel = document.getElementById('practicaSel');
    sel.innerHTML = '<option value="">Selecciona...</option>' +
      ps.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
  };

  const renderSesiones = (ss) => {
    const sel = document.getElementById('sesionEquiposSel');

    // dropdown del armado de equipos
    const opcionesSes = ss
      .filter((s) => s.estado !== 'FINALIZADA')
      .map((s) => `<option value="${s.id}">${esc(s.practica)} · ${esc(s.grupo)} · ${esc(formatFecha(s.fecha))}</option>`)
      .join('');
    if (sel) {
      const valorActual = sel.value;
      sel.innerHTML = '<option value="">Selecciona una sesión...</option>' + opcionesSes;
      sel.value = valorActual;
    }

    if (sesionesCtl) sesionesCtl.setData(ss);
  };

  const renderSesionItem = (s) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(s.practica)} · ${esc(s.grupo)}</div>
        <div class="card-row__sub">${esc(formatFecha(s.fecha))} ${s.hora_inicio ? esc(s.hora_inicio) : ''} · ${s.equipos_creados ?? 0}/${s.num_equipos ?? '—'} eq.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="badge badge--${s.estado === 'EN_CURSO' ? 'ok' : s.estado === 'FINALIZADA' ? 'neutral' : 'info'}">${esc(s.estado)}</span>
        ${s.estado !== 'FINALIZADA' ? `
          <select class="field-sel" data-cambiar="${s.id}" style="font-size:12px;padding:4px 8px;border-radius:8px">
            <option value="">Cambiar a...</option>
            ${s.estado !== 'EN_CURSO' ? '<option value="EN_CURSO">EN_CURSO</option>' : ''}
            <option value="FINALIZADA">FINALIZADA</option>
          </select>
        ` : ''}
        ${s.estado !== 'FINALIZADA' ? `<button class="btn btn-mini btn-ghost" data-armar="${s.id}">Armar equipos</button>` : ''}
      </div>
    </li>`;

  const wireSesionesBotones = (slice, listEl) => {
    listEl.querySelectorAll('select[data-cambiar]').forEach((sel) => {
      sel.addEventListener('change', () => cambiarEstado(Number(sel.dataset.cambiar), sel.value));
    });
    listEl.querySelectorAll('button[data-armar]').forEach((b) => {
      b.addEventListener('click', () => {
        sesionEquiposActiva = Number(b.dataset.armar);
        const dropdown = document.getElementById('sesionEquiposSel');
        if (dropdown) dropdown.value = String(sesionEquiposActiva);
        document.querySelectorAll('[data-tab="sesiones"] .subtabs button').forEach((x) => x.classList.toggle('is-active', x.dataset.subtab === 'ses-teams'));
        document.querySelectorAll('[data-tab="sesiones"] [data-subtab-panel]').forEach((p) => {
          p.hidden = p.getAttribute('data-subtab-panel') !== 'ses-teams';
        });
        cargarAlumnosSesion(sesionEquiposActiva);
      });
    });
  };

  const renderPendientes = (ps) => {
    if (pendientesCtl) pendientesCtl.setData(ps);
  };

  const renderPendienteItem = (p) => {
    const opcionesGrupo = '<option value="">Sin grupo</option>' +
      grupos.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');
    return `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(p.nombre)}</div>
          <div class="card-row__sub">${esc(p.email)} · ${esc(p.grupo || 'sin grupo')}</div>
          <select class="field-sel" data-grupo-pend="${p.id}" style="margin-top:6px;font-size:12px;padding:6px 10px;border-radius:10px;width:100%">${opcionesGrupo}</select>
        </div>
        <button class="btn btn-mini btn-secondary" data-activar="${p.id}">Autorizar</button>
      </li>`;
  };

  const wirePendientesBotones = (slice, listEl) => {
    listEl.querySelectorAll('button[data-activar]').forEach((b) => {
      b.addEventListener('click', () => {
        const sel = listEl.querySelector(`select[data-grupo-pend="${b.dataset.activar}"]`);
        const grupoId = sel && sel.value ? Number(sel.value) : null;
        activar(Number(b.dataset.activar), grupoId);
      });
    });
  };

  const cargarAlumnosActivos = async () => {
    if (!alumnosActivosCtl) return;
    const filtro = (document.getElementById('grupoFiltroSel') || {}).value || '';
    const url = filtro ? `/maestro/alumnos?grupo_id=${filtro}` : '/maestro/alumnos';
    const r = await api('GET', url);
    if (!r.ok) {
      alumnosActivosCtl.setData([]);
      return;
    }
    alumnosActivosCtl.setData(r.data || []);
  };

  const renderAlumnoActivoItem = (u) => {
    const opcionesGrupo = '<option value="">Sin grupo</option>' +
      grupos.map((g) => `<option value="${g.id}"${u.grupo_id === g.id ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('');
    return `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(u.nombre)}</div>
          <div class="card-row__sub">${esc(u.email)} · ${esc(u.grupo || 'sin grupo')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <select class="field-sel" data-grupo-asig="${u.id}" style="font-size:12px;padding:6px 10px;border-radius:10px">${opcionesGrupo}</select>
          <button class="btn btn-mini btn-primary" data-asignar="${u.id}">Asignar</button>
        </div>
      </li>`;
  };

  const wireAlumnosActivosBotones = (slice, listEl) => {
    listEl.querySelectorAll('button[data-asignar]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.asignar);
        const sel = listEl.querySelector(`select[data-grupo-asig="${id}"]`);
        const grupoId = sel && sel.value ? Number(sel.value) : null;
        asignarGrupo(id, grupoId);
      });
    });
  };

  // Como falla si grupo_id es null, exigimos seleccion no vacia para asignar; para "quitar grupo" no hay endpoint.
  const asignarGrupo = async (alumnoId, grupoId) => {
    if (!grupoId) {
      flash('flash', 'Selecciona un grupo del menú antes de asignar.', 'error');
      return;
    }
    const r = await api('PATCH', '/estudiantes/' + alumnoId + '/grupo', { grupo_id: grupoId });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error al asignar grupo', 'error'); return; }
    flash('flash', 'Grupo asignado.', 'ok');
    cargar();
  };

  const cambiarEstado = async (id, estado) => {
    if (!estado) return;
    const r = await api('PATCH', '/maestro/sesiones/' + id + '/estado', { estado });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Estado actualizado.', 'ok');
    cargar();
  };

  const activar = async (id, grupoId) => {
    const body = grupoId ? { grupo_id: grupoId } : {};
    const r = await api('PATCH', '/estudiantes/' + id + '/activar', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error al autorizar', 'error'); return; }
    flash('flash', 'Alumno autorizado.', 'ok');
    cargar();
  };

  const submitSesion = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {};
    fd.forEach((v, k) => { if (v !== '' && v != null) body[k] = v; });
    const btn = document.getElementById('btnCrearSesion');
    setLoading(btn, true);
    const r = await api('POST', '/maestro/sesiones', body);
    setLoading(btn, false);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Sesión creada.', 'ok');
    ev.target.reset();
    cargar();
  };

  const submitGrupo = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const nombre = String(new FormData(ev.currentTarget).get('nombre') || '').trim();
    if (!nombre) return;
    const r = await api('POST', '/maestro/grupos', { nombre });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Grupo creado.', 'ok');
    ev.target.reset();
    cargar();
  };

  // ===== Armar equipos =====
  const cargarAlumnosSesion = async (sesionId) => {
    const bloque = document.getElementById('equiposBloque');
    bloque.hidden = false;

    const [alumnosRes, detalleRes, incidenciasRes] = await Promise.all([
      api('GET', '/maestro/sesiones/' + sesionId + '/alumnos'),
      api('GET', '/maestro/sesiones/' + sesionId),
      api('GET', '/maestro/sesiones/' + sesionId + '/incidencias')
    ]);

    if (!alumnosRes.ok) {
      flash('flash', (alumnosRes.data && alumnosRes.data.error) || 'Error cargando alumnos', 'error');
      return;
    }
    if (!detalleRes.ok) {
      flash('flash', (detalleRes.data && detalleRes.data.error) || 'Error cargando sesión', 'error');
      return;
    }

    alumnosSesion = alumnosRes.data || [];
    renderAlumnosPicker(alumnosSesion, detalleRes.data);
    renderEquiposExistentes(detalleRes.data);
    if (incidenciasRes.ok) renderIncidenciasSesion(incidenciasRes.data || []);
  };

  const renderAlumnosPicker = (alumnos, detalle) => {
    const hint = document.getElementById('hintAlumnos');
    const sesion = detalle.sesion || {};
    hint.textContent = `${alumnos.length} alumnos del grupo ${esc(sesion.grupo_nombre || '')} · máx ${sesion.integrantes_por_equipo ?? '∞'} por equipo`;

    const ul = document.getElementById('alumnosPicker');
    if (!alumnos.length) {
      ul.innerHTML = '<li><div class="picker-row"><div class="picker-row__main"><div class="picker-row__sub">Sin alumnos activos en este grupo.</div></div></div></li>';
      return;
    }
    ul.innerHTML = alumnos.map((a) => {
      const yaEnEquipo = !!a.equipo_actual;
      return `
        <li>
          <label class="picker-row ${yaEnEquipo ? 'is-disabled' : ''}">
            <input type="checkbox" data-alumno="${a.id}" ${yaEnEquipo ? 'disabled' : ''}>
            <div class="picker-row__main">
              <div class="picker-row__title">${esc(a.nombre)}</div>
              <div class="picker-row__sub">${esc(a.email)}${yaEnEquipo ? ' · en equipo: ' + esc(a.equipo_actual) : ''}</div>
            </div>
          </label>
        </li>
      `;
    }).join('');
  };

  const renderEquiposExistentes = (detalle) => {
    const cont = document.getElementById('equiposExistentes');
    const equipos = detalle.equipos || [];
    if (!equipos.length) {
      cont.innerHTML = '<div class="empty-state">Sin equipos.</div>';
      return;
    }
    const opcionesMaterial = materialesCache
      .map((m) => `<option value="${m.id}">${esc(m.nombre)} (stock ${m.stock})</option>`)
      .join('');

    cont.innerHTML = equipos.map((eq) => {
      const opcionesResp = (eq.integrantes || [])
        .map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`)
        .join('');
      return `
      <div class="team-card">
        <h4>
          <span>${esc(eq.nombre)} <span class="badge badge--info">RESPONSIVA</span></span>
          <button class="btn btn-mini btn-danger" data-borrar="${eq.id}">Eliminar</button>
        </h4>
        <ul>
          ${(eq.integrantes || []).map((i) => `<li>${esc(i.nombre)} · ${esc(i.email)}</li>`).join('') || '<li class="muted-mini">Sin integrantes.</li>'}
        </ul>
        <details style="margin-top:8px">
          <summary style="color:var(--c-teal-700);font-weight:600;cursor:pointer;font-size:13px">+ Reportar incidencia</summary>
          <form class="form-card" data-incidencia="${eq.id}" style="margin-top:8px">
            <div class="field-tight">
              <select name="material_id" required>
                <option value="">Material...</option>
                ${opcionesMaterial}
              </select>
            </div>
            <div class="field-tight">
              <select name="tipo" required>
                <option value="">Tipo...</option>
                <option value="ROTO">ROTO</option>
                <option value="PERDIDO">PERDIDO</option>
              </select>
            </div>
            <div class="field-tight">
              <select name="responsable_usuario_id">
                <option value="">Sin responsable individual</option>
                ${opcionesResp}
              </select>
            </div>
            <div class="field-tight">
              <input name="descripcion" placeholder="Descripción (opcional)" maxlength="255">
            </div>
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--c-ink-soft);margin:6px 0">
              <input type="checkbox" name="generar_adeudo" style="width:18px;height:18px;accent-color:var(--c-orange-600)">
              Generar adeudo al responsable
            </label>
            <button class="btn btn-mini btn-primary" type="submit">Registrar incidencia</button>
          </form>
        </details>
      </div>
    `;
    }).join('');

    cont.querySelectorAll('button[data-borrar]').forEach((b) => {
      b.addEventListener('click', () => borrarEquipo(Number(b.dataset.borrar)));
    });
    cont.querySelectorAll('form[data-incidencia]').forEach((f) => {
      f.addEventListener('submit', (ev) => submitIncidencia(ev, Number(f.dataset.incidencia)));
    });
  };

  const renderIncidenciasSesion = (rows) => {
    const cont = document.getElementById('incidenciasSesion');
    if (!cont) return;
    if (!rows || !rows.length) {
      cont.innerHTML = '<div class="empty-state">Sin incidencias registradas.</div>';
      return;
    }
    cont.innerHTML = rows.map((i) => `
      <li class="card-row" style="list-style:none">
        <div class="card-row__main">
          <div class="card-row__title">${esc(i.material)} <span class="badge badge--danger">${esc(i.tipo)}</span></div>
          <div class="card-row__sub">${esc(i.equipo || '')}${i.responsable ? ' · ' + esc(i.responsable) : ''} · ${esc(formatFecha(i.created_at))}</div>
          ${i.descripcion ? `<div class="card-row__sub">"${esc(i.descripcion)}"</div>` : ''}
          ${i.adeudo_id ? `<div class="card-row__sub">Adeudo #${i.adeudo_id} · <span class="badge badge--${i.adeudo_estado === 'PENDIENTE' ? 'warn' : 'ok'}">${esc(i.adeudo_estado)}</span></div>` : ''}
        </div>
      </li>
    `).join('');
  };

  const submitIncidencia = async (ev, equipoId) => {
    ev.preventDefault();
    clearFlash('flash');
    if (!sesionEquiposActiva) {
      flash('flash', 'Selecciona una sesión.', 'error');
      return;
    }
    const fd = new FormData(ev.currentTarget);
    const body = {
      equipo_id: equipoId,
      material_id: Number(fd.get('material_id')),
      tipo: String(fd.get('tipo') || '').toUpperCase(),
      responsable_usuario_id: fd.get('responsable_usuario_id') || null,
      descripcion: String(fd.get('descripcion') || '').trim() || null,
      generar_adeudo: fd.get('generar_adeudo') === 'on'
    };
    const r = await api('POST', '/maestro/sesiones/' + sesionEquiposActiva + '/incidencias', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo registrar la incidencia', 'error'); return; }
    flash('flash', (r.data && r.data.message) || 'Incidencia registrada.', 'ok');
    ev.target.reset();
    cargarAlumnosSesion(sesionEquiposActiva);
  };

  const submitEquipo = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    if (!sesionEquiposActiva) {
      flash('flash', 'Selecciona una sesión primero.', 'error');
      return;
    }
    const ids = Array.from(document.querySelectorAll('#alumnosPicker input[data-alumno]:checked'))
      .map((cb) => Number(cb.dataset.alumno));
    if (!ids.length) {
      flash('flash', 'Selecciona al menos un alumno para el equipo.', 'error');
      return;
    }
    const fd = new FormData(ev.currentTarget);
    const body = {
      nombre: String(fd.get('nombre') || '').trim() || null,
      integrantes: ids
    };
    const r = await api('POST', '/maestro/sesiones/' + sesionEquiposActiva + '/equipos', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear el equipo', 'error'); return; }
    flash('flash', 'Equipo creado.', 'ok');
    ev.target.reset();
    cargarAlumnosSesion(sesionEquiposActiva);
    cargar();
  };

  const borrarEquipo = async (equipoId) => {
    if (!window.confirm('¿Eliminar este equipo?')) return;
    const r = await api('DELETE', '/maestro/equipos/' + equipoId);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo eliminar', 'error'); return; }
    flash('flash', 'Equipo eliminado.', 'ok');
    cargarAlumnosSesion(sesionEquiposActiva);
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
    sesionesCtl = makePagedList(document.getElementById('sesionesBox'), {
      render: renderSesionItem,
      search: (s, q) =>
        (s.practica || '').toLowerCase().includes(q) ||
        (s.grupo || '').toLowerCase().includes(q),
      filters: { estado: (s, v) => s.estado === v },
      emptyHtml: '<li class="empty-state">Aún no tienes sesiones.</li>',
      afterRender: wireSesionesBotones
    });

    pendientesCtl = makePagedList(document.getElementById('pendientesBox'), {
      render: renderPendienteItem,
      search: (p, q) =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.grupo || '').toLowerCase().includes(q),
      emptyHtml: '<li class="empty-state">Sin alumnos pendientes.</li>',
      afterRender: wirePendientesBotones
    });

    alumnosActivosCtl = makePagedList(document.getElementById('alumnosActivosBox'), {
      render: renderAlumnoActivoItem,
      search: (u, q) =>
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q),
      emptyHtml: '<li class="empty-state">Sin alumnos.</li>',
      afterRender: wireAlumnosActivosBotones
    });

    gruposCtl = makePagedList(document.getElementById('gruposBox'), {
      render: renderGrupoItem,
      search: (g, q) => (g.nombre || '').toLowerCase().includes(q),
      emptyHtml: '<li class="empty-state">Sin grupos.</li>'
    });

    equiposCtl = makePagedList(document.getElementById('equiposBox'), {
      pageSize: 10,
      render: renderEquipoItem,
      search: (eq, q) =>
        (eq.nombre || '').toLowerCase().includes(q) ||
        (eq.practica || '').toLowerCase().includes(q) ||
        (eq.grupo || '').toLowerCase().includes(q),
      filters: { estado: (eq, v) => eq.sesion_estado === v },
      emptyHtml: '<article class="card"><div class="empty-state">Aún no hay equipos creados. Arma equipos desde Sesiones → Armar equipos.</div></article>',
      afterRender: wireEquiposBotones
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    usuario = await requireAuth({ fuente: 'QUIMICA', roles: ['MAESTRO', 'ADMIN'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSubtabs();
    initListas();
    document.getElementById('formSesion').addEventListener('submit', submitSesion);
    document.getElementById('formGrupo').addEventListener('submit', submitGrupo);
    document.getElementById('formEquipo').addEventListener('submit', submitEquipo);
    document.getElementById('sesionEquiposSel').addEventListener('change', (ev) => {
      const id = Number(ev.target.value);
      sesionEquiposActiva = Number.isInteger(id) && id > 0 ? id : null;
      if (sesionEquiposActiva) cargarAlumnosSesion(sesionEquiposActiva);
      else document.getElementById('equiposBloque').hidden = true;
    });
    const filtroSel = document.getElementById('grupoFiltroSel');
    if (filtroSel) filtroSel.addEventListener('change', cargarAlumnosActivos);
    const chkFin = document.getElementById('chkIncluirFinalizadas');
    if (chkFin) chkFin.addEventListener('change', cargarEquiposGlobal);
    cargar();
  });
})();
