// Dashboard Admin Quimica
(function () {
  'use strict';
  const { api, flash, clearFlash, requireAuth, wireHeader, wireTabs, formatFecha, escapeHtml: esc } = window.BM;

  let usuario = null;
  let materialesCache = [];
  let practicasCache = [];
  let kitsAbiertosPorPractica = {};
  let practicaSeleccionada = null;

  const cargar = async () => {
    clearFlash('flash');
    const [resumen, usuarios, materiales, practicas, prestamos, adeudos, incidencias] = await Promise.all([
      api('GET', '/admin/resumen'),
      api('GET', '/admin/usuarios'),
      api('GET', '/admin/materiales?incluir_inactivos=true'),
      api('GET', '/admin/practicas?tipo=QUIMICA'),
      api('GET', '/admin/prestamos'),
      api('GET', '/admin/adeudos'),
      api('GET', '/admin/incidencias')
    ]);

    if (resumen.ok) renderResumen(resumen.data);
    if (usuarios.ok) renderUsuarios(usuarios.data || []);
    if (materiales.ok) { materialesCache = materiales.data || []; renderMateriales(materialesCache); }
    if (practicas.ok) { practicasCache = practicas.data || []; renderPracticas(practicasCache); }
    if (prestamos.ok) renderPrestamos(prestamos.data || []);
    if (adeudos.ok) renderAdeudos(adeudos.data || []);
    if (incidencias.ok) renderIncidencias(incidencias.data || []);

    // Si hay una practica seleccionada, refrescar sus kits
    if (practicaSeleccionada) cargarKits(practicaSeleccionada);
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

  const renderUsuarios = (us) => {
    const list = document.getElementById('usuariosList');
    if (!us.length) { list.innerHTML = '<li class="empty-state">Sin usuarios.</li>'; return; }
    list.innerHTML = us.map((u) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(u.nombre)} <span class="badge badge--neutral">${esc(u.rol)}</span></div>
          <div class="card-row__sub">${esc(u.email)}${u.grupo ? ' · ' + esc(u.grupo) : ''}</div>
        </div>
        <button class="btn btn-mini ${u.is_active ? 'btn-ghost' : 'btn-secondary'}" data-toggle="${u.id}" data-active="${u.is_active ? 1 : 0}">${u.is_active ? 'Desactivar' : 'Activar'}</button>
      </li>`).join('');
    list.querySelectorAll('button[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => toggleUsuario(Number(b.dataset.toggle), b.dataset.active === '0'));
    });
  };

  const toggleUsuario = async (id, activar) => {
    const r = await api('PATCH', '/admin/usuarios/' + id + '/estado', { activo: activar });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    flash('flash', activar ? 'Usuario activado.' : 'Usuario desactivado.', 'ok');
    cargar();
  };

  const renderMateriales = (ms) => {
    const list = document.getElementById('materialesList');
    if (!ms.length) { list.innerHTML = '<li class="empty-state">Sin materiales.</li>'; return; }
    list.innerHTML = ms.map((m) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(m.nombre)} ${m.is_active ? '' : '<span class="badge badge--neutral">INACTIVO</span>'}</div>
          <div class="card-row__sub">Stock: ${m.stock}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-mini btn-secondary" data-stock="${m.id}" data-delta="1">+1</button>
          <button class="btn btn-mini btn-secondary" data-stock="${m.id}" data-delta="-1">-1</button>
        </div>
      </li>`).join('');
    list.querySelectorAll('button[data-stock]').forEach((b) => {
      b.addEventListener('click', () => ajustarStock(Number(b.dataset.stock), Number(b.dataset.delta)));
    });
  };

  const ajustarStock = async (id, delta) => {
    const r = await api('PATCH', '/admin/materiales/' + id + '/stock', { delta });
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
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
        </li>
      `).join('');

      return `
        <div class="kit-block">
          <h5>${esc(kit.nombre || ('Kit #' + kit.id))}</h5>
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

  const renderPrestamos = (ps) => {
    const list = document.getElementById('prestamosList');
    if (!ps.length) { list.innerHTML = '<li class="empty-state">Sin préstamos.</li>'; return; }
    list.innerHTML = ps.slice(0, 30).map((p) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(p.usuario)} → ${esc(p.material)} × ${p.cantidad}</div>
          <div class="card-row__sub">${esc(formatFecha(p.fecha_prestamo))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="badge badge--${p.estado === 'ACTIVO' ? 'warn' : 'ok'}">${esc(p.estado)}</span>
          ${p.estado === 'ACTIVO' ? `<button class="btn btn-mini btn-secondary" data-devolver="${p.id}">Devolver</button>` : ''}
        </div>
      </li>`).join('');
    list.querySelectorAll('button[data-devolver]').forEach((b) => {
      b.addEventListener('click', () => devolverPrestamo(Number(b.dataset.devolver)));
    });
  };

  const devolverPrestamo = async (id) => {
    const r = await api('PATCH', '/admin/prestamos/' + id + '/devolucion');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  const renderAdeudos = (as) => {
    const list = document.getElementById('adeudosList');
    if (!as.length) { list.innerHTML = '<li class="empty-state">Sin adeudos.</li>'; return; }
    list.innerHTML = as.slice(0, 30).map((a) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(a.usuario)} → ${esc(a.material)}</div>
          <div class="card-row__sub">${esc(formatFecha(a.created_at))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="badge badge--${a.estado === 'PENDIENTE' ? 'warn' : 'ok'}">${esc(a.estado)}</span>
          ${a.estado === 'PENDIENTE' ? `<button class="btn btn-mini btn-secondary" data-resolver="${a.id}">Resolver</button>` : ''}
        </div>
      </li>`).join('');
    list.querySelectorAll('button[data-resolver]').forEach((b) => {
      b.addEventListener('click', () => resolverAdeudo(Number(b.dataset.resolver)));
    });
  };

  const resolverAdeudo = async (id) => {
    const r = await api('PATCH', '/admin/adeudos/' + id + '/resolver');
    if (!r.ok) { flash('flash', (r.data && r.data.error) || 'Error', 'error'); return; }
    cargar();
  };

  const renderIncidencias = (xs) => {
    const list = document.getElementById('incidenciasList');
    if (!xs.length) { list.innerHTML = '<li class="empty-state">Sin incidencias.</li>'; return; }
    list.innerHTML = xs.slice(0, 30).map((x) => `
      <li class="card-row">
        <div class="card-row__main">
          <div class="card-row__title">${esc(x.material)} <span class="badge badge--danger">${esc(x.tipo)}</span></div>
          <div class="card-row__sub">${esc(x.equipo || '')} · ${esc(formatFecha(x.created_at))}</div>
          ${x.descripcion ? `<div class="card-row__sub">"${esc(x.descripcion)}"</div>` : ''}
        </div>
      </li>`).join('');
  };

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

  document.addEventListener('DOMContentLoaded', async () => {
    usuario = await requireAuth({ fuente: 'QUIMICA', roles: ['ADMIN'] });
    if (!usuario) return;
    wireHeader(usuario, { onRefresh: cargar });
    wireTabs('home');
    wireSubtabs();
    document.getElementById('formUsuario').addEventListener('submit', submitUsuario);
    document.getElementById('formMaterial').addEventListener('submit', submitMaterial);
    document.getElementById('formPractica').addEventListener('submit', submitPractica);
    document.getElementById('formKit').addEventListener('submit', submitKit);
    cargar();
  });
})();
