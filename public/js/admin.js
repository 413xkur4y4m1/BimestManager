// Dashboard Admin Quimica
(function () {
  'use strict';
  const { api, flash, clearFlash, requireAuth, wireHeader, wireTabs, formatFecha, formatFechaCorta, escapeHtml: esc, makePagedList } = window.BM;

  let usuario = null;
  let materialesCache = [];
  let laboratoriosCache = [];

  let responsivasFiltro = '';

  const MATS_PAGE_SIZE = 20;
  let matsBusqueda = '';
  let matsPagina = 1;

  // Controladores de listas paginadas (se inicializan en DOMContentLoaded)
  let responsivasCtl = null;
  let usuariosCtl = null;
  let prestamosCtl = null;
  let adeudosCtl = null;
  let incidenciasCtl = null;
  let sesionesCtl = null;

  const cargar = async () => {
    clearFlash('flash');
    const [resumen, usuarios, materiales, laboratorios, prestamos, adeudos, incidencias, responsivas, sesiones] = await Promise.all([
      api('GET', '/admin/resumen'),
      api('GET', '/admin/usuarios'),
      api('GET', '/admin/materiales?incluir_inactivos=true'),
      api('GET', '/admin/laboratorios?incluir_inactivos=true'),
      api('GET', '/admin/prestamos'),
      api('GET', '/admin/adeudos'),
      api('GET', '/admin/incidencias'),
      api('GET', '/admin/responsivas' + (responsivasFiltro ? '?estado=' + responsivasFiltro : '')),
      api('GET', '/admin/sesiones')
    ]);

    if (resumen.ok) renderResumen(resumen.data);
    if (usuarios.ok && usuariosCtl) usuariosCtl.setData(usuarios.data || []);
    if (materiales.ok) { materialesCache = materiales.data || []; renderMateriales(); }
    if (laboratorios.ok) { laboratoriosCache = laboratorios.data || []; renderLaboratorios(laboratoriosCache); }
    if (prestamos.ok && prestamosCtl) prestamosCtl.setData(prestamos.data || []);
    if (adeudos.ok && adeudosCtl) adeudosCtl.setData(adeudos.data || []);
    if (incidencias.ok && incidenciasCtl) incidenciasCtl.setData(incidencias.data || []);
    if (responsivas.ok && responsivasCtl) responsivasCtl.setData(responsivas.data || []);
    if (sesiones.ok && sesionesCtl) sesionesCtl.setData(sesiones.data || []);
  };

  const renderResponsivaItem = (r) => {
    const ints = (r.integrantes || []).map((i) => {
      const tieneFirma = Boolean(i.firma_imagen);
      const badge = tieneFirma
        ? '<span class="badge badge--ok">Firmado</span>'
        : '<span class="badge badge--warn">Pendiente</span>';
      const fecha = i.firmado_at ? formatFecha(i.firmado_at) : '';
      const img = tieneFirma
        ? `<img class="signature-thumb" src="${esc(window.BM_apiUrl(i.firma_imagen))}" alt="Firma de ${esc(i.nombre)}" loading="lazy">`
        : '';
      return `
        <li>
          <div class="card-row">
            <div class="card-row__main">
              <div class="card-row__title">${esc(i.nombre)} ${badge}</div>
              <div class="card-row__sub">${esc(i.email)}${fecha ? ' · firmó ' + esc(fecha) : ''}</div>
            </div>
          </div>
          ${img}
        </li>`;
    }).join('');

    const sesionEstadoBadge = `<span class="badge badge--${r.sesion_estado === 'EN_CURSO' ? 'ok' : (r.sesion_estado === 'FINALIZADA' ? 'neutral' : 'info')}">${esc(r.sesion_estado)}</span>`;
    const respEstadoBadge = `<span class="badge badge--${r.estado === 'ACTIVA' ? 'info' : 'neutral'}">${esc(r.estado)}</span>`;

    return `
      <li class="card-row">
        <div class="card-row__main" style="width:100%">
          <div class="card-row__title">${esc(r.practica)} · Equipo ${esc(r.equipo)} ${respEstadoBadge}</div>
          <div class="card-row__sub">${esc(r.grupo)} · ${esc(formatFecha(r.fecha))}${r.hora_inicio ? ' ' + esc(r.hora_inicio) : ''} · sesión ${sesionEstadoBadge}</div>
          <div class="card-row__sub"><strong>Firmas:</strong> ${r.total_firmados}/${r.total_integrantes}</div>
          <ul class="list responsiva-integrantes">${ints}</ul>
        </div>
      </li>`;
  };

  const wireResponsivasFiltros = () => {
    const wrap = document.getElementById('respsFiltros');
    if (!wrap) return;
    wrap.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-resp-filtro]');
      if (!btn) return;
      responsivasFiltro = btn.dataset.respFiltro || '';
      wrap.querySelectorAll('button[data-resp-filtro]').forEach((b) => {
        const activo = (b.dataset.respFiltro || '') === responsivasFiltro;
        b.classList.toggle('btn-primary', activo);
        b.classList.toggle('btn-ghost', !activo);
      });
      cargar();
    });
  };

  const renderResumen = (d) => {
    document.getElementById('welcomeSub').textContent = (usuario.nombre || '') + ' · ADMIN · QUIMICA';
    const u = d.usuarios || {}, m = d.materiales || {}, p = d.prestamos || {}, a = d.adeudos || {};
    document.getElementById('resumenKv').innerHTML = `
      <div><dt>Admins</dt><dd>${u.admins ?? 0}</dd></div>
      <div><dt>Maestros</dt><dd>${u.maestros ?? 0}</dd></div>
      <div><dt>Alumnos activos</dt><dd>${u.alumnos_activos ?? 0}</dd></div>
      <div><dt>Alumnos pendientes</dt><dd>${u.alumnos_pendientes ?? 0}</dd></div>
      <div><dt>Materiales activos</dt><dd>${m.activos ?? 0}</dd></div>
      <div><dt>Stock total</dt><dd>${m.stock_total ?? 0}</dd></div>
      <div><dt>Préstamos activos</dt><dd>${p.activos ?? 0}</dd></div>
      <div><dt>Adeudos pendientes</dt><dd>${a.pendientes ?? 0}</dd></div>
    `;
  };

  const renderUsuarioItem = (u) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(u.nombre)} <span class="badge badge--neutral">${esc(u.rol)}</span>${u.is_active ? '' : ' <span class="badge badge--warn">INACTIVO</span>'}</div>
        <div class="card-row__sub">${esc(u.email)}${u.grupo ? ' · ' + esc(u.grupo) : ''}</div>
      </div>
      <button class="btn btn-mini ${u.is_active ? 'btn-ghost' : 'btn-secondary'}" data-toggle="${u.id}" data-active="${u.is_active ? 1 : 0}">${u.is_active ? 'Desactivar' : 'Activar'}</button>
    </li>`;

  const wireUsuariosBotones = (slice, listEl) => {
    listEl.querySelectorAll('button[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => toggleUsuario(Number(b.dataset.toggle), b.dataset.active === '0'));
    });
  };

  const toggleUsuario = async (id, activar) => {
    const r = await api('PATCH', '/admin/usuarios/' + id + '/estado', { activo: activar });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', activar ? 'Usuario activado.' : 'Usuario desactivado.', 'ok');
    cargar();
  };

  const renderMateriales = () => {
    const list = document.getElementById('materialesList');
    const totalEl = document.getElementById('materialesTotal');
    const shownEl = document.getElementById('materialesShown');
    const pag = document.getElementById('materialesPag');
    const pagInfo = document.getElementById('materialesPagInfo');

    const query = matsBusqueda.trim().toLowerCase();
    const filtrados = query
      ? materialesCache.filter((m) => (m.nombre || '').toLowerCase().includes(query))
      : materialesCache.slice();

    if (totalEl) totalEl.textContent = String(materialesCache.length);

    if (!filtrados.length) {
      list.innerHTML = query
        ? `<li class="empty-state">Sin coincidencias para "${esc(query)}".</li>`
        : '<li class="empty-state">Sin materiales.</li>';
      if (shownEl) shownEl.textContent = '0';
      if (pag) pag.hidden = true;
      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / MATS_PAGE_SIZE));
    if (matsPagina > totalPaginas) matsPagina = totalPaginas;
    if (matsPagina < 1) matsPagina = 1;

    const inicio = (matsPagina - 1) * MATS_PAGE_SIZE;
    const pagina = filtrados.slice(inicio, inicio + MATS_PAGE_SIZE);

    if (shownEl) shownEl.textContent = String(pagina.length);

    list.innerHTML = pagina.map((m) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(m.nombre)} ${m.is_active ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
          <div class="card-row__sub">Stock: ${m.stock}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center">
          <input type="number" min="0" inputmode="numeric" value="${m.stock}" data-stock-input="${m.id}" aria-label="Stock de ${esc(m.nombre)}" title="Escribe el stock exacto y guarda" style="width:78px;padding:7px 10px;border-radius:10px;border:1px solid var(--c-line);font-size:13px;background:var(--c-cream-input);color:var(--c-teal-900)">
          <button class="btn btn-mini btn-secondary" data-set-stock="${m.id}">Guardar</button>
          <button class="btn btn-mini btn-primary" data-editar="${m.id}">Editar</button>
          <button class="btn btn-mini btn-danger" data-eliminar="${m.id}">Eliminar</button>
        </div>
      </li>`).join('');

    list.querySelectorAll('button[data-set-stock]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.setStock);
        const input = list.querySelector(`input[data-stock-input="${id}"]`);
        fijarStock(id, input ? input.value : '');
      });
    });

    // Enter dentro del campo de stock también guarda
    list.querySelectorAll('input[data-stock-input]').forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); fijarStock(Number(inp.dataset.stockInput), inp.value); }
      });
    });

    list.querySelectorAll('button[data-editar]').forEach((b) => {
      b.addEventListener('click', () => editarMaterial(Number(b.dataset.editar)));
    });

    list.querySelectorAll('button[data-eliminar]').forEach((b) => {
      b.addEventListener('click', () => eliminarMaterial(Number(b.dataset.eliminar)));
    });

    if (pag) {
      const muchas = totalPaginas > 1;
      pag.hidden = !muchas;
      if (muchas) {
        if (pagInfo) pagInfo.textContent = `Página ${matsPagina} / ${totalPaginas}`;
        document.getElementById('materialesPrev').disabled = matsPagina <= 1;
        document.getElementById('materialesNext').disabled = matsPagina >= totalPaginas;
      }
    }
  };

  const wireMaterialesBuscador = () => {
    const input = document.getElementById('materialesBuscar');
    if (input) {
      input.addEventListener('input', () => {
        matsBusqueda = input.value || '';
        matsPagina = 1;
        renderMateriales();
      });
    }
    const prev = document.getElementById('materialesPrev');
    const next = document.getElementById('materialesNext');
    if (prev) prev.addEventListener('click', () => { matsPagina--; renderMateriales(); });
    if (next) next.addEventListener('click', () => { matsPagina++; renderMateriales(); });
  };

  // Fija el stock al valor exacto escrito (reemplaza los antiguos +1 / -1)
  const fijarStock = async (id, valor) => {
    const stock = Number(valor);
    if (!Number.isInteger(stock) || stock < 0) {
      flash('flash', 'El stock debe ser un entero mayor o igual a 0.', 'error');
      return;
    }
    const r = await api('PATCH', '/admin/materiales/' + id, { stock });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Stock actualizado.', 'ok');
    cargar();
  };

  let editandoMaterialId = null;

  const cerrarModalEditarMaterial = () => {
    const modal = document.getElementById('editarMaterialModal');
    if (modal) modal.hidden = true;
    editandoMaterialId = null;
  };

  const guardarEdicionMaterial = async () => {
    if (editandoMaterialId === null) return;
    const id = editandoMaterialId;
    const nombre = String(document.getElementById('editarMaterialNombre').value || '').trim();
    const stockStr = String(document.getElementById('editarMaterialStock').value || '').trim();

    if (!nombre) { flash('flash', 'El nombre no puede estar vacio.', 'error'); return; }

    const body = { nombre };
    if (stockStr !== '') {
      const stock = Number(stockStr);
      if (!Number.isInteger(stock) || stock < 0) {
        flash('flash', 'Stock invalido (entero >= 0).', 'error');
        return;
      }
      body.stock = stock;
    }

    const r = await api('PATCH', '/admin/materiales/' + id, body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cerrarModalEditarMaterial();
    flash('flash', 'Material actualizado.', 'ok');
    cargar();
  };

  const editarMaterial = (id) => {
    const material = materialesCache.find((m) => m.id === id);
    if (!material) return;
    const modal = document.getElementById('editarMaterialModal');
    if (!modal) { flash('flash', 'Modal de edicion no encontrado en la pagina.', 'error'); return; }

    document.getElementById('editarMaterialNombre').value = material.nombre || '';
    document.getElementById('editarMaterialStock').value = material.stock != null ? material.stock : '';
    editandoMaterialId = id;
    modal.hidden = false;
    setTimeout(() => document.getElementById('editarMaterialNombre').focus(), 30);
  };

  const wireModalEditarMaterial = () => {
    const modal = document.getElementById('editarMaterialModal');
    if (!modal) return;
    const btnCancel = document.getElementById('editarMaterialCancel');
    const btnSave = document.getElementById('editarMaterialSave');
    if (btnCancel) btnCancel.addEventListener('click', cerrarModalEditarMaterial);
    if (btnSave) btnSave.addEventListener('click', guardarEdicionMaterial);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModalEditarMaterial();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) cerrarModalEditarMaterial();
    });
  };

  const eliminarMaterial = async (id) => {
    const material = materialesCache.find((m) => m.id === id);
    if (!material) return;
    if (!confirm(`¿Eliminar el material "${material.nombre}"? Quedara inactivo en el inventario.`)) return;

    const r = await api('DELETE', '/admin/materiales/' + id);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', 'Material eliminado.', 'ok');
    cargar();
  };

  // ===== Aulas / laboratorios =====
  const renderLaboratorios = (labs) => {
    const list = document.getElementById('laboratoriosList');
    if (!list) return;
    if (!labs.length) { list.innerHTML = '<li class="empty-state">Sin laboratorios. Crea el primero abajo.</li>'; return; }
    list.innerHTML = labs.map((l) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(l.nombre)}${l.is_active ? '' : ' <span class="badge badge--neutral">INACTIVO</span>'}</div>
          <div class="card-row__sub">${esc(l.ubicacion || 'Sin ubicación')}${l.capacidad ? ' · cap. ' + l.capacidad : ''} · ${l.sesiones_activas} sesión(es) activa(s)</div>
        </div>
        <button class="btn btn-mini ${l.is_active ? 'btn-ghost' : 'btn-secondary'}" data-lab-toggle="${l.id}" data-active="${l.is_active ? 1 : 0}">${l.is_active ? 'Desactivar' : 'Activar'}</button>
      </li>`).join('');
    list.querySelectorAll('button[data-lab-toggle]').forEach((b) => {
      b.addEventListener('click', () => toggleLaboratorio(Number(b.dataset.labToggle), b.dataset.active === '0'));
    });
  };

  const toggleLaboratorio = async (id, activar) => {
    const r = await api('PATCH', '/admin/laboratorios/' + id + '/estado', { activo: activar });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', activar ? 'Laboratorio activado.' : 'Laboratorio desactivado.', 'ok');
    cargar();
  };

  const submitLaboratorio = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = { nombre: fd.get('nombre') };
    const ubic = String(fd.get('ubicacion') || '').trim();
    const cap = String(fd.get('capacidad') || '').trim();
    if (ubic) body.ubicacion = ubic;
    if (cap) body.capacidad = Number(cap);
    const r = await api('POST', '/admin/laboratorios', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear el laboratorio', 'error'); return; }
    flash('flash', 'Laboratorio creado.', 'ok');
    ev.target.reset();
    cargar();
  };

  // ===== Hoja de ruta del laboratorista =====
  const cargarHojaRuta = async () => {
    const input = document.getElementById('rutaFecha');
    const cont = document.getElementById('rutaContainer');
    if (!input || !cont) return;
    const fecha = input.value;
    if (!fecha) { cont.innerHTML = '<div class="empty-state">Elige una fecha para ver la hoja de ruta.</div>'; return; }

    const r = await api('GET', '/admin/hoja-ruta?fecha=' + encodeURIComponent(fecha));
    if (!r.ok) { cont.innerHTML = `<div class="empty-state">${esc((r.data && r.data.error) || 'No se pudo cargar la hoja de ruta.')}</div>`; return; }

    const sesiones = (r.data && r.data.sesiones) || [];
    if (!sesiones.length) { cont.innerHTML = '<div class="empty-state">No hay sesiones programadas para este día.</div>'; return; }

    cont.innerHTML = sesiones.map((s) => {
      const ini = s.hora_inicio ? String(s.hora_inicio).slice(0, 5) : 'Sin hora';
      const dur = s.duracion_min ? ' · ' + s.duracion_min + ' min' : '';
      const lab = s.laboratorio ? esc(s.laboratorio) : '<span class="muted">Sin laboratorio</span>';
      const estadoClass = s.estado === 'EN_CURSO' ? 'ok' : 'info';

      const kitsHtml = (s.kits || []).map((kit) => {
        const mats = (kit.materiales || []).map((m) => `
          <li class="card-row">
            <div class="card-row__main">
              <div class="card-row__title" style="font-size:13px">${esc(m.material)} ${m.material_activo ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
              <div class="card-row__sub">Preparar: <strong>${m.cantidad}</strong> · Stock: ${m.stock}</div>
            </div>
          </li>`).join('');
        return `
          <div class="kit-block" style="margin-top:6px">
            <strong style="font-size:13px;color:var(--c-teal-900)">${esc(kit.nombre || ('Kit #' + kit.id))} ${kit.solicitado ? '<span class="badge badge--info">solicitado</span>' : ''}</strong>
            <ul class="list">${mats || '<li class="empty-state" style="font-size:12px">Kit sin materiales.</li>'}</ul>
          </div>`;
      }).join('') || '<div class="empty-state" style="font-size:12px">La práctica no tiene kits registrados.</div>';

      return `
        <article class="card" style="margin-bottom:10px">
          <h3 style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
            <span>${ini}${dur} · ${esc(s.practica)}</span>
            <span class="badge badge--${estadoClass}">${esc(s.estado)}</span>
          </h3>
          <div class="card-row__sub" style="margin-bottom:4px"><strong>Laboratorio:</strong> ${lab}</div>
          <div class="card-row__sub" style="margin-bottom:6px"><strong>Grupo:</strong> ${esc(s.grupo)} · <strong>Maestro:</strong> ${esc(s.maestro)}</div>
          <details>
            <summary style="cursor:pointer;font-size:13px;color:var(--c-teal-900)"><strong>Materiales a preparar</strong></summary>
            ${kitsHtml}
          </details>
        </article>`;
    }).join('');
  };

  const renderPrestamoItem = (p) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(p.usuario)} → ${esc(p.material)} × ${p.cantidad}</div>
        <div class="card-row__sub">${esc(formatFecha(p.fecha_prestamo))}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="badge badge--${p.estado === 'ACTIVO' ? 'warn' : 'ok'}">${esc(p.estado)}</span>
        ${p.estado === 'ACTIVO' ? `<button class="btn btn-mini btn-secondary" data-devolver="${p.id}">Devolver</button>` : ''}
      </div>
    </li>`;

  const wirePrestamosBotones = (slice, listEl) => {
    listEl.querySelectorAll('button[data-devolver]').forEach((b) => {
      b.addEventListener('click', () => devolverPrestamo(Number(b.dataset.devolver)));
    });
  };

  const devolverPrestamo = async (id) => {
    const r = await api('PATCH', '/admin/prestamos/' + id + '/devolucion');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  const renderAdeudoItem = (a) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(a.usuario)} → ${esc(a.material)}</div>
        <div class="card-row__sub">${esc(formatFecha(a.created_at))}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="badge badge--${a.estado === 'PENDIENTE' ? 'warn' : 'ok'}">${esc(a.estado)}</span>
        ${a.estado === 'PENDIENTE'
          ? `<button class="btn btn-mini btn-primary" data-resolver="${a.id}" data-usuario="${esc(a.usuario)}" data-material="${esc(a.material)}">Marcar resuelto</button>`
          : ''}
      </div>
    </li>`;

  const wireAdeudosBotones = (slice, listEl) => {
    listEl.querySelectorAll('button[data-resolver]').forEach((b) => {
      b.addEventListener('click', () => resolverAdeudo(
        Number(b.dataset.resolver),
        b.dataset.usuario,
        b.dataset.material
      ));
    });
  };

  const resolverAdeudo = async (id, usuario, material) => {
    if (!confirm(`¿Marcar como resuelto el adeudo de "${usuario}" sobre "${material}"?`)) return;
    const r = await api('PATCH', '/admin/adeudos/' + id + '/resolver');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo resolver el adeudo', 'error'); return; }
    flash('flash', 'Adeudo marcado como resuelto.', 'ok');
    cargar();
  };

  const ESTADO_BADGE = {
    PROGRAMADA: 'info',
    EN_CURSO: 'ok',
    FINALIZADA: 'neutral'
  };

  const renderSesionItem = (s) => {
    const estadoBadge = `<span class="badge badge--${ESTADO_BADGE[s.estado] || 'neutral'}">${esc(s.estado)}</span>`;
    const fechaTxt = s.fecha ? esc(formatFechaCorta(s.fecha)) : '—';
    const horaTxt = s.hora_inicio ? ' · ' + esc(String(s.hora_inicio).slice(0, 5)) : '';
    const duracionTxt = s.duracion_min ? ' · ' + s.duracion_min + ' min' : '';

    const kits = Array.isArray(s.kits) ? s.kits : [];
    let kitsHtml;
    if (!kits.length) {
      kitsHtml = '<div class="empty-state" style="font-size:12px">La practica no tiene kits registrados.</div>';
    } else {
      kitsHtml = kits.map((kit) => {
        const mats = (kit.materiales || []).map((m) => `
          <li class="card-row">
            <div class="card-row__main">
              <div class="card-row__title" style="font-size:13px">${esc(m.material)} ${m.material_activo ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
              <div class="card-row__sub">Cantidad requerida: <strong>${m.cantidad}</strong> · Stock actual: ${m.stock}</div>
            </div>
          </li>`).join('');
        return `
          <div class="kit-block" style="margin-top:8px">
            <strong style="font-size:13px;color:var(--c-teal-900)">${esc(kit.nombre || ('Kit #' + kit.id))}</strong>
            <ul class="list">
              ${mats || '<li class="empty-state" style="font-size:12px">Kit sin materiales.</li>'}
            </ul>
          </div>`;
      }).join('');
    }

    const labTxt = s.laboratorio
      ? esc(s.laboratorio)
      : '<span class="muted">Sin laboratorio</span>';
    const kitTxt = s.kit_solicitado
      ? ` · <strong>Kit solicitado:</strong> ${esc(s.kit_solicitado)}`
      : '';

    return `
      <li class="card-row">
        <div class="card-row__main" style="width:100%">
          <div class="card-row__title">${esc(s.practica)} ${estadoBadge}</div>
          <div class="card-row__sub"><strong>Fecha:</strong> ${fechaTxt}${horaTxt}${duracionTxt}</div>
          <div class="card-row__sub"><strong>Laboratorio:</strong> ${labTxt}${kitTxt}</div>
          <div class="card-row__sub"><strong>Grupo:</strong> ${esc(s.grupo)} · <strong>Maestro:</strong> ${esc(s.maestro)}</div>
          <div class="card-row__sub">Equipos creados: ${s.equipos_creados} ${s.num_equipos ? '/ ' + s.num_equipos + ' planeados' : ''}</div>
          <details style="margin-top:6px">
            <summary style="cursor:pointer;font-size:13px;color:var(--c-teal-900)"><strong>Kits y materiales de la practica</strong></summary>
            ${kitsHtml}
          </details>
        </div>
      </li>`;
  };

  const renderIncidenciaItem = (x) => `
    <li class="card-row">
      <div class="card-row__main">
        <div class="card-row__title">${esc(x.material)} <span class="badge badge--danger">${esc(x.tipo)}</span></div>
        <div class="card-row__sub">${esc(x.equipo || '')} · ${esc(formatFecha(x.created_at))}</div>
        ${x.descripcion ? `<div class="card-row__sub">"${esc(x.descripcion)}"</div>` : ''}
      </div>
    </li>`;

  const submitUsuario = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const body = Object.fromEntries(new FormData(ev.currentTarget));
    const r = await api('POST', '/admin/usuarios', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Usuario creado.', 'ok');
    ev.target.reset();
    cargar();
  };

  const submitMaterial = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = { nombre: fd.get('nombre'), stock: Number(fd.get('stock')) };
    const r = await api('POST', '/admin/materiales', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Material creado.', 'ok');
    ev.target.reset();
    cargar();
  };

  // Subtabs genéricos: funcionan para cualquier sección que tenga .subtabs.
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
    usuariosCtl = makePagedList(document.getElementById('usuariosBox'), {
      render: renderUsuarioItem,
      search: (u, q) => (u.nombre || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q),
      filters: {
        rol: (u, v) => u.rol === v,
        estado: (u, v) => (v === 'activo' ? !!u.is_active : !u.is_active)
      },
      emptyHtml: '<li class="empty-state">Sin usuarios.</li>',
      afterRender: wireUsuariosBotones
    });

    responsivasCtl = makePagedList(document.getElementById('respsBox'), {
      render: renderResponsivaItem,
      search: (r, q) =>
        (r.practica || '').toLowerCase().includes(q) ||
        (r.grupo || '').toLowerCase().includes(q) ||
        String(r.equipo || '').toLowerCase().includes(q),
      emptyHtml: '<li class="empty-state">Sin responsivas registradas.</li>'
    });

    prestamosCtl = makePagedList(document.getElementById('prestamosBox'), {
      render: renderPrestamoItem,
      search: (p, q) =>
        (p.usuario || '').toLowerCase().includes(q) ||
        (p.material || '').toLowerCase().includes(q),
      filters: { estado: (p, v) => p.estado === v },
      emptyHtml: '<li class="empty-state">Sin préstamos.</li>',
      afterRender: wirePrestamosBotones
    });

    adeudosCtl = makePagedList(document.getElementById('adeudosBox'), {
      render: renderAdeudoItem,
      search: (a, q) =>
        (a.usuario || '').toLowerCase().includes(q) ||
        (a.material || '').toLowerCase().includes(q),
      filters: { estado: (a, v) => a.estado === v },
      emptyHtml: '<li class="empty-state">Sin adeudos.</li>',
      afterRender: wireAdeudosBotones
    });

    incidenciasCtl = makePagedList(document.getElementById('incidenciasBox'), {
      render: renderIncidenciaItem,
      search: (x, q) =>
        (x.material || '').toLowerCase().includes(q) ||
        (x.equipo || '').toLowerCase().includes(q) ||
        (x.descripcion || '').toLowerCase().includes(q),
      filters: { tipo: (x, v) => x.tipo === v },
      emptyHtml: '<li class="empty-state">Sin incidencias.</li>'
    });

    sesionesCtl = makePagedList(document.getElementById('sesionesBox'), {
      render: renderSesionItem,
      search: (s, q) =>
        (s.practica || '').toLowerCase().includes(q) ||
        (s.grupo || '').toLowerCase().includes(q) ||
        (s.maestro || '').toLowerCase().includes(q),
      filters: { estado: (s, v) => s.estado === v },
      emptyHtml: '<li class="empty-state">Sin sesiones programadas.</li>'
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    usuario = await requireAuth({ fuente: 'QUIMICA', roles: ['ADMIN'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSubtabs();
    wireResponsivasFiltros();
    wireMaterialesBuscador();
    wireModalEditarMaterial();
    initListas();
    document.getElementById('formUsuario').addEventListener('submit', submitUsuario);
    document.getElementById('formMaterial').addEventListener('submit', submitMaterial);

    const formLab = document.getElementById('formLaboratorio');
    if (formLab) formLab.addEventListener('submit', submitLaboratorio);

    // Hoja de ruta: fecha inicial = hoy + recarga al abrir la subpestaña.
    const rutaFecha = document.getElementById('rutaFecha');
    if (rutaFecha) {
      rutaFecha.value = new Date().toISOString().slice(0, 10);
      rutaFecha.addEventListener('change', cargarHojaRuta);
      cargarHojaRuta();
    }
    const rutaBtn = document.querySelector('[data-tab="labs"] button[data-subtab="labs-ruta"]');
    if (rutaBtn) rutaBtn.addEventListener('click', cargarHojaRuta);

    cargar();
  });
})();
