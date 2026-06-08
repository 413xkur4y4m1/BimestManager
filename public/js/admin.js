// Dashboard Admin Quimica
(function () {
  'use strict';
  const { api, flash, clearFlash, requireAuth, wireHeader, wireTabs, formatFecha, formatFechaCorta, escapeHtml: esc, makePagedList } = window.BM;

  let usuario = null;
  let materialesCache = [];
  let practicasCache = [];
  let kitsAbiertosPorPractica = {};
  let practicaSeleccionada = null;

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
    const [resumen, usuarios, materiales, practicas, prestamos, adeudos, incidencias, responsivas, sesiones] = await Promise.all([
      api('GET', '/admin/resumen'),
      api('GET', '/admin/usuarios'),
      api('GET', '/admin/materiales?incluir_inactivos=true'),
      api('GET', '/admin/practicas?tipo=QUIMICA'),
      api('GET', '/admin/prestamos'),
      api('GET', '/admin/adeudos'),
      api('GET', '/admin/incidencias'),
      api('GET', '/admin/responsivas' + (responsivasFiltro ? '?estado=' + responsivasFiltro : '')),
      api('GET', '/admin/sesiones')
    ]);

    if (resumen.ok) renderResumen(resumen.data);
    if (usuarios.ok && usuariosCtl) usuariosCtl.setData(usuarios.data || []);
    if (materiales.ok) { materialesCache = materiales.data || []; renderMateriales(); }
    if (practicas.ok) { practicasCache = practicas.data || []; renderPracticas(practicasCache); }
    if (prestamos.ok && prestamosCtl) prestamosCtl.setData(prestamos.data || []);
    if (adeudos.ok && adeudosCtl) adeudosCtl.setData(adeudos.data || []);
    if (incidencias.ok && incidenciasCtl) incidenciasCtl.setData(incidencias.data || []);
    if (responsivas.ok && responsivasCtl) responsivasCtl.setData(responsivas.data || []);
    if (sesiones.ok && sesionesCtl) sesionesCtl.setData(sesiones.data || []);

    // Si hay una practica seleccionada, refrescar sus kits
    if (practicaSeleccionada) cargarKits(practicaSeleccionada);
  };

  const renderResponsivaItem = (r) => {
    const ints = (r.integrantes || []).map((i) => {
      const tieneFirma = Boolean(i.firma_imagen);
      const badge = tieneFirma
        ? '<span class="badge badge--ok">Firmado</span>'
        : '<span class="badge badge--warn">Pendiente</span>';
      const fecha = i.firmado_at ? formatFecha(i.firmado_at) : '';
      const img = tieneFirma
        ? `<img class="signature-thumb" src="${esc(i.firma_imagen)}" alt="Firma de ${esc(i.nombre)}" loading="lazy">`
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
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-mini btn-secondary" data-stock="${m.id}" data-delta="1">+1</button>
          <button class="btn btn-mini btn-secondary" data-stock="${m.id}" data-delta="-1">-1</button>
          <button class="btn btn-mini btn-primary" data-editar="${m.id}">Editar</button>
          <button class="btn btn-mini btn-danger" data-eliminar="${m.id}">Eliminar</button>
        </div>
      </li>`).join('');

    list.querySelectorAll('button[data-stock]').forEach((b) => {
      b.addEventListener('click', () => ajustarStock(Number(b.dataset.stock), Number(b.dataset.delta)));
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

  const ajustarStock = async (id, delta) => {
    const r = await api('PATCH', '/admin/materiales/' + id + '/stock', { delta });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
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

  const renderPracticas = (ps) => {
    const list = document.getElementById('practicasList');
    if (!ps.length) { list.innerHTML = '<li class="empty-state">Sin prácticas.</li>'; return; }
    list.innerHTML = ps.map((p) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(p.nombre)} <span class="badge badge--info">${esc(p.tipo)}</span></div>
          <div class="card-row__sub">${esc(p.descripcion || '')}</div>
        </div>
        <button class="btn btn-mini btn-primary" data-kits="${p.id}">Kits</button>
      </li>`).join('');
    list.querySelectorAll('button[data-kits]').forEach((b) => {
      b.addEventListener('click', () => abrirKits(Number(b.dataset.kits)));
    });
  };

  const abrirKits = (practicaId) => {
    practicaSeleccionada = practicaId;
    document.getElementById('kitsCard').hidden = false;
    document.getElementById('kitsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    cargarKits(practicaId);
  };

  const cargarKits = async (practicaId) => {
    const r = await api('GET', '/admin/practicas/' + practicaId + '/kits');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error cargando kits', 'error'); return; }
    renderKits(r.data);
  };

  const renderKits = (data) => {
    document.getElementById('kitsPracticaNombre').textContent = (data.practica && data.practica.nombre) || '—';
    document.getElementById('kitsHint').textContent = 'Cada kit es la lista de materiales que se necesita para esta práctica.';
    const cont = document.getElementById('kitsContainer');

    if (!data.kits || !data.kits.length) {
      cont.innerHTML = '<div class="empty-state">Esta práctica aún no tiene kits.</div>';
      return;
    }

    const opcionesMaterial = materialesCache
      .filter((m) => m.is_active)
      .map((m) => `<option value="${m.id}">${esc(m.nombre)} (stock ${m.stock})</option>`)
      .join('');

    cont.innerHTML = data.kits.map((kit) => {
      const items = (kit.materiales || []).map((it) => `
        <li class="card-row">
          <div class="card-row__main">
            <div class="card-row__title">${esc(it.material)} ${it.material_activo ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
            <div class="card-row__sub">Cantidad: ${it.cantidad} · Stock: ${it.stock}</div>
          </div>
          <button class="btn btn-mini btn-danger" data-quitar-mat="${kit.id}" data-mat-id="${it.material_id}" data-mat-nombre="${esc(it.material)}">Quitar</button>
        </li>
      `).join('');

      return `
        <div class="kit-block">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <h5 style="margin:0">${esc(kit.nombre || ('Kit #' + kit.id))}</h5>
            <button class="btn btn-mini btn-danger" data-eliminar-kit="${kit.id}" data-kit-nombre="${esc(kit.nombre || ('Kit #' + kit.id))}">Eliminar kit</button>
          </div>
          <ul class="list">
            ${items || '<li class="empty-state">Sin materiales en este kit.</li>'}
          </ul>
          <form class="form-card" data-kit-mat="${kit.id}" style="margin-top:8px">
            <div class="field-tight"><select name="material_id" required><option value="">Material...</option>${opcionesMaterial}</select></div>
            <div class="field-tight"><input name="cantidad" type="number" min="1" placeholder="Cantidad" required></div>
            <button class="btn btn-mini btn-primary" type="submit">+ Agregar material al kit</button>
          </form>
        </div>
      `;
    }).join('');

    cont.querySelectorAll('form[data-kit-mat]').forEach((form) => {
      form.addEventListener('submit', (ev) => agregarMaterialAKit(ev, Number(form.dataset.kitMat)));
    });

    cont.querySelectorAll('button[data-eliminar-kit]').forEach((b) => {
      b.addEventListener('click', () => eliminarKit(Number(b.dataset.eliminarKit), b.dataset.kitNombre));
    });

    cont.querySelectorAll('button[data-quitar-mat]').forEach((b) => {
      b.addEventListener('click', () => quitarMaterialDeKit(
        Number(b.dataset.quitarMat),
        Number(b.dataset.matId),
        b.dataset.matNombre
      ));
    });
  };

  const eliminarKit = async (kitId, nombre) => {
    if (!confirm(`¿Eliminar el kit "${nombre}"? Tambien se quitaran todos sus materiales asociados.`)) return;
    const r = await api('DELETE', '/admin/kits/' + kitId);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo eliminar el kit', 'error'); return; }
    flash('flash', 'Kit eliminado.', 'ok');
    cargarKits(practicaSeleccionada);
  };

  const quitarMaterialDeKit = async (kitId, materialId, nombre) => {
    if (!confirm(`¿Quitar "${nombre}" de este kit?`)) return;
    const r = await api('DELETE', '/admin/kits/' + kitId + '/materiales/' + materialId);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo quitar el material', 'error'); return; }
    flash('flash', 'Material quitado del kit.', 'ok');
    cargarKits(practicaSeleccionada);
  };

  const agregarMaterialAKit = async (ev, kitId) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      material_id: Number(fd.get('material_id')),
      cantidad: Number(fd.get('cantidad'))
    };
    const r = await api('POST', '/admin/kits/' + kitId + '/materiales', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo agregar', 'error'); return; }
    flash('flash', 'Material agregado al kit.', 'ok');
    ev.target.reset();
    cargarKits(practicaSeleccionada);
  };

  const submitKit = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    if (!practicaSeleccionada) {
      flash('flash', 'Selecciona primero una práctica para crear el kit.', 'error');
      return;
    }
    const fd = new FormData(ev.currentTarget);
    const body = { nombre: String(fd.get('nombre') || '').trim() || null };
    const r = await api('POST', '/admin/practicas/' + practicaSeleccionada + '/kits', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear el kit', 'error'); return; }
    flash('flash', 'Kit creado.', 'ok');
    ev.target.reset();
    cargarKits(practicaSeleccionada);
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

    return `
      <li class="card-row">
        <div class="card-row__main" style="width:100%">
          <div class="card-row__title">${esc(s.practica)} ${estadoBadge}</div>
          <div class="card-row__sub"><strong>Fecha:</strong> ${fechaTxt}${horaTxt}${duracionTxt}</div>
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

  // Forzar tipo QUIMICA para todas las practicas creadas desde el admin de quimica.
  const submitPractica = async (ev) => {
    ev.preventDefault();
    clearFlash('flash');
    const fd = new FormData(ev.currentTarget);
    const body = {
      nombre: fd.get('nombre'),
      descripcion: fd.get('descripcion'),
      tipo: 'QUIMICA'
    };
    const r = await api('POST', '/admin/practicas', body);
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'No se pudo crear', 'error'); return; }
    flash('flash', 'Práctica creada.', 'ok');
    ev.target.reset();
    cargar();
  };

  const wireSubtabs = () => {
    document.querySelectorAll('[data-tab="mats"] .subtabs button').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.subtab;
        document.querySelectorAll('[data-tab="mats"] .subtabs button').forEach((x) => x.classList.toggle('is-active', x === b));
        document.querySelectorAll('[data-tab="mats"] [data-subtab-panel]').forEach((p) => {
          p.hidden = p.getAttribute('data-subtab-panel') !== key;
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
    document.getElementById('formPractica').addEventListener('submit', submitPractica);
    document.getElementById('formKit').addEventListener('submit', submitKit);
    cargar();
  });
})();
