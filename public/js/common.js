// Bimest Manager — helpers compartidos por todas las vistas
(function () {
  'use strict';

  const api = async (method, url, body) => {
    const opts = {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json' }
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { /* respuesta no-JSON */ }
    return { ok: res.ok, status: res.status, data };
  };

  const flash = (where, msg, kind) => {
    const el = typeof where === 'string' ? document.getElementById(where) : where;
    if (!el) return;
    el.className = 'flash flash--' + (kind || 'info');
    el.textContent = msg;
    el.hidden = false;
  };

  const clearFlash = (where) => {
    const el = typeof where === 'string' ? document.getElementById(where) : where;
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  };

  const setLoading = (btn, loading) => {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!loading);
    btn.disabled = !!loading;
  };

  const initials = (nombre) => {
    if (!nombre) return '--';
    const parts = String(nombre).trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join('').toUpperCase() || '--';
  };

  const formatFecha = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (_) { return String(iso); }
  };

  const formatFechaCorta = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    } catch (_) { return String(iso); }
  };

  // Verifica sesion y opcionalmente exige una fuente/rol especifico.
  // Si no hay sesion -> redirige a /login.
  // Si la fuente/rol no coincide -> redirige a redirectTo segun rol/fuente.
  const requireAuth = async (opts) => {
    const cfg = opts || {};
    const r = await api('GET', '/auth/yo');
    if (!r.ok) {
      window.location.replace('/login');
      return null;
    }
    const u = r.data && r.data.usuario;
    if (!u) {
      window.location.replace('/login');
      return null;
    }
    if (cfg.fuente && u.fuente !== cfg.fuente) {
      window.location.replace(redirectFor(u));
      return null;
    }
    if (cfg.roles && cfg.roles.length && cfg.roles.indexOf(u.rol) === -1) {
      window.location.replace(redirectFor(u));
      return null;
    }
    return u;
  };

  const redirectFor = (u) => {
    if (!u) return '/login';
    if (u.fuente === 'TURISMO') {
      return u.rol === 'ADMIN' ? '/turismo/admin' : '/turismo/estudiante';
    }
    if (u.rol === 'ADMIN') return '/admin';
    if (u.rol === 'MAESTRO') return '/maestro';
    return '/estudiante';
  };

  // Header avatar + logout buttons (para vistas que incluyen header.ejs)
  const wireHeader = (usuario, opts) => {
    const cfg = opts || {};
    const av = document.getElementById('appAvatar');
    if (av) av.textContent = initials(usuario && usuario.nombre);

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        await api('POST', '/auth/logout');
        window.location.replace('/login');
      });
    }
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh && typeof cfg.onRefresh === 'function') {
      btnRefresh.addEventListener('click', () => cfg.onRefresh());
    }
  };

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const wireCollapsibles = () => {
    document.querySelectorAll('.collapsible').forEach((el) => {
      const head = el.querySelector('.collapsible__head');
      if (!head) return;
      head.addEventListener('click', () => {
        const open = el.getAttribute('data-open') !== 'false';
        el.setAttribute('data-open', open ? 'false' : 'true');
      });
    });
  };

  // Tabs basados en el bottom-nav. Cada seccion de la pagina lleva data-tab="<key>".
  // Los items del bottom-nav apuntan a #<key>. Mostramos solo la activa.
  const wireTabs = (defaultKey) => {
    const navItems = Array.from(document.querySelectorAll('.bottom-nav__item[href^="#"]'));
    const sections = Array.from(document.querySelectorAll('[data-tab]'));
    const keys = new Set(sections.map((s) => s.getAttribute('data-tab')));
    if (!sections.length) return null;

    const activar = (rawKey) => {
      const key = keys.has(rawKey) ? rawKey : (defaultKey && keys.has(defaultKey) ? defaultKey : sections[0].getAttribute('data-tab'));
      sections.forEach((s) => {
        s.classList.toggle('is-active-tab', s.getAttribute('data-tab') === key);
      });
      navItems.forEach((a) => {
        const href = a.getAttribute('href') || '';
        a.classList.toggle('is-active', href === '#' + key);
      });
      try {
        window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      } catch (_) { window.scrollTo(0, 0); }
      return key;
    };

    const inicial = (window.location.hash || '').replace('#', '') || defaultKey;
    activar(inicial);

    window.addEventListener('hashchange', () => {
      const k = (window.location.hash || '').replace('#', '');
      activar(k);
    });

    // Bottom-nav items con href que NO sean #<key> de tab (ej. logo central que apunta a la URL principal)
    // se dejan como links normales.
    return { activar };
  };

  // ===== Listas con búsqueda, filtros y paginación =====
  // Devuelve un controlador con setData/refresh/setPredicate.
  // El contenedor `root` debe incluir, con data-attributes:
  //   - data-list (UL/OL donde van los items)
  //   - opcional: data-search (input de texto)
  //   - opcional: data-filters (contenedor con <select data-filter="key"> )
  //   - opcional: data-pagination (contenedor de paginación con data-prev / data-next / data-info)
  //   - opcional: data-total / data-shown (spans para contador)
  //
  // Config:
  //   - render(item, idx, listEl) -> string HTML por item
  //   - search(item, q) -> boolean  (q ya viene .toLowerCase().trim())
  //   - filters: { key: (item, value) => boolean }
  //   - pageSize: default 20
  //   - emptyHtml / emptyFilteredHtml: HTML del estado vacío
  //   - afterRender(slice, listEl): hook para wirear botones, etc.
  const makePagedList = (root, cfg) => {
    if (!root) return null;
    const listEl = root.querySelector('[data-list]');
    if (!listEl) return null;

    const searchEl = root.querySelector('[data-search]');
    const filtersEl = root.querySelector('[data-filters]');
    const pagEl = root.querySelector('[data-pagination]');
    const totalEl = root.querySelector('[data-total]');
    const shownEl = root.querySelector('[data-shown]');
    const prevEl = pagEl && pagEl.querySelector('[data-prev]');
    const nextEl = pagEl && pagEl.querySelector('[data-next]');
    const infoEl = pagEl && pagEl.querySelector('[data-info]');

    const pageSize = cfg.pageSize || 20;
    const filtersDef = cfg.filters || {};
    const renderItem = cfg.render || ((x) => '<li>' + escapeHtml(JSON.stringify(x)) + '</li>');
    const searchFn = cfg.search || (() => true);
    const emptyHtml = cfg.emptyHtml || '<li class="empty-state">Sin datos.</li>';
    const emptyFilteredHtml = cfg.emptyFilteredHtml || '<li class="empty-state">Sin coincidencias.</li>';

    let data = [];
    let externalPredicate = () => true;
    let page = 1;
    let query = '';
    const filterValues = {};

    const compute = () => {
      const q = (query || '').toLowerCase().trim();
      return data.filter((item) => {
        if (!externalPredicate(item)) return false;
        if (q && !searchFn(item, q)) return false;
        for (const key of Object.keys(filtersDef)) {
          const val = filterValues[key];
          if (val === undefined || val === '' || val === null) continue;
          if (!filtersDef[key](item, val)) return false;
        }
        return true;
      });
    };

    const render = () => {
      if (totalEl) totalEl.textContent = String(data.length);
      const filtered = compute();

      if (!filtered.length) {
        const tieneFiltro = Boolean(
          (query && query.trim()) ||
          Object.values(filterValues).some((v) => v !== undefined && v !== '' && v !== null)
        );
        listEl.innerHTML = (tieneFiltro && data.length) ? emptyFilteredHtml : emptyHtml;
        if (shownEl) shownEl.textContent = '0';
        if (pagEl) pagEl.hidden = true;
        if (typeof cfg.afterRender === 'function') cfg.afterRender([], listEl);
        return;
      }

      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (page > totalPages) page = totalPages;
      if (page < 1) page = 1;
      const start = (page - 1) * pageSize;
      const slice = filtered.slice(start, start + pageSize);

      if (shownEl) shownEl.textContent = String(slice.length);
      listEl.innerHTML = slice.map((item, i) => renderItem(item, i + start, listEl)).join('');

      if (pagEl) {
        const many = totalPages > 1;
        pagEl.hidden = !many;
        if (many) {
          if (infoEl) infoEl.textContent = 'Página ' + page + ' / ' + totalPages;
          if (prevEl) prevEl.disabled = page <= 1;
          if (nextEl) nextEl.disabled = page >= totalPages;
        }
      }

      if (typeof cfg.afterRender === 'function') cfg.afterRender(slice, listEl);
    };

    if (searchEl) {
      searchEl.addEventListener('input', () => {
        query = searchEl.value || '';
        page = 1;
        render();
      });
    }
    if (filtersEl) {
      filtersEl.querySelectorAll('[data-filter]').forEach((sel) => {
        const key = sel.getAttribute('data-filter');
        filterValues[key] = sel.value || '';
        sel.addEventListener('change', () => {
          filterValues[key] = sel.value || '';
          page = 1;
          render();
        });
      });
    }
    if (prevEl) prevEl.addEventListener('click', () => { page--; render(); });
    if (nextEl) nextEl.addEventListener('click', () => { page++; render(); });

    return {
      setData(arr) { data = Array.isArray(arr) ? arr : []; page = 1; render(); },
      setPredicate(fn) { externalPredicate = typeof fn === 'function' ? fn : () => true; page = 1; render(); },
      refresh: render,
      resetPage() { page = 1; render(); },
      getFilterValue(key) { return filterValues[key]; }
    };
  };

  window.BM = {
    api, flash, clearFlash, setLoading,
    initials, formatFecha, formatFechaCorta,
    requireAuth, redirectFor, wireHeader,
    escapeHtml, wireCollapsibles, wireTabs,
    makePagedList
  };
})();
