// Auth: maneja login y registro (con tabs Quimica/Turismo)
(function () {
  'use strict';
  const { api, flash, clearFlash, setLoading, redirectFor } = window.BM;

  // Si ya hay sesion activa, ir directamente al dashboard correspondiente.
  const yaLogueado = async () => {
    const r = await api('GET', '/auth/yo');
    if (r.ok && r.data && r.data.usuario) {
      window.location.replace(redirectFor(r.data.usuario));
      return true;
    }
    return false;
  };

  const initLogin = (form) => {
    yaLogueado();

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearFlash('flash');

      const data = Object.fromEntries(new FormData(form));
      const email = String(data.email || '').trim().toLowerCase();
      const password = String(data.password || '');

      if (!email || !password) {
        flash('flash', 'Email y contraseña son obligatorios.', 'error');
        return;
      }

      const btn = document.getElementById('submitBtn');
      setLoading(btn, true);

      const r = await api('POST', '/auth/login', { email, password });
      setLoading(btn, false);

      if (!r.ok) {
        flash('flash', (r.data && r.data.error) || 'No se pudo iniciar sesión.', 'error');
        return;
      }

      const target = (r.data && r.data.redirectTo) || redirectFor(r.data && r.data.usuario);
      window.location.replace(target);
    });

    const forgot = document.getElementById('forgot');
    if (forgot) {
      forgot.addEventListener('click', (ev) => {
        ev.preventDefault();
        flash('flash', 'Esta función aún no está disponible. Contacta a tu administrador.', 'info');
      });
    }
  };

  const initRegistro = (form) => {
    yaLogueado();

    const tabs = document.querySelectorAll('.auth-tabs button');
    const fuenteInput = form.querySelector('input[name="fuente"]');
    const onlyTurismo = form.querySelectorAll('[data-only="TURISMO"]');

    const setFuente = (f) => {
      fuenteInput.value = f;
      tabs.forEach((t) => {
        const on = t.dataset.fuente === f;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      onlyTurismo.forEach((el) => { el.hidden = f !== 'TURISMO'; });
    };

    tabs.forEach((t) => t.addEventListener('click', () => setFuente(t.dataset.fuente)));

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearFlash('flash');

      const data = Object.fromEntries(new FormData(form));
      const nombre = String(data.nombre || '').trim();
      const email = String(data.email || '').trim().toLowerCase();
      const password = String(data.password || '');
      const password2 = String(data.password2 || '');
      const fuente = String(data.fuente || 'QUIMICA');
      const grupo = String(data.grupo || '').trim();

      if (!nombre || !email || !password) {
        flash('flash', 'Nombre, email y contraseña son obligatorios.', 'error');
        return;
      }
      if (nombre.length < 3) {
        flash('flash', 'El nombre debe tener al menos 3 caracteres.', 'error');
        return;
      }
      if (password.length < 8) {
        flash('flash', 'La contraseña debe tener al menos 8 caracteres.', 'error');
        return;
      }
      if (password !== password2) {
        flash('flash', 'Las contraseñas no coinciden.', 'error');
        return;
      }

      const btn = document.getElementById('submitBtn');
      setLoading(btn, true);

      const url = fuente === 'TURISMO' ? '/auth/registro-alumno-turismo' : '/auth/registro-alumno';
      const body = { nombre, email, password };
      if (fuente === 'TURISMO' && grupo) body.grupo = grupo;

      const r = await api('POST', url, body);
      setLoading(btn, false);

      if (!r.ok) {
        flash('flash', (r.data && r.data.error) || 'No se pudo crear la cuenta.', 'error');
        return;
      }

      flash('flash', (r.data && r.data.message) || 'Registro completado. Tu cuenta queda pendiente de autorización.', 'ok');
      form.reset();
      setFuente(fuente); // mantener tab elegida
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const login = document.getElementById('loginForm');
    if (login) initLogin(login);
    const registro = document.getElementById('registroForm');
    if (registro) initRegistro(registro);
  });
})();
