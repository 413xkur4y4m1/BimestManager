// ============================================================
// Bimest Manager — Toolkit de DEMO
// Menú de scripts para autollenar formularios con datos aleatorios.
// Abrir/cerrar con  Ctrl + 0  ·  luego presiona 1..9 para ejecutar.
// Pensado para presentaciones: ahorra escribir datos a mano.
// (No envía los formularios: deja todo lleno para que tú hagas clic en Crear.)
// ============================================================
(function () {
  'use strict';

  // ---------- utilidades aleatorias ----------
  const NOMBRES = ['Daniel', 'María', 'José', 'Ana', 'Luis', 'Sofía', 'Carlos', 'Valeria', 'Miguel', 'Fernanda', 'Diego', 'Paola', 'Andrés', 'Camila', 'Jorge', 'Regina', 'Emiliano', 'Ximena', 'Ricardo', 'Itzel'];
  const APELLIDOS = ['García', 'Hernández', 'López', 'Martínez', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Reyes', 'Cruz', 'Morales', 'Ortiz', 'Gutiérrez', 'Mendoza', 'Vázquez', 'Romero', 'Aguilar', 'Castillo'];
  const REACTIVOS = ['Ácido clorhídrico', 'Hidróxido de sodio', 'Etanol', 'Sulfato de cobre', 'Nitrato de plata', 'Permanganato de potasio', 'Fenolftaleína', 'Acetona', 'Bicarbonato de sodio', 'Yoduro de potasio', 'Peróxido de hidrógeno', 'Azul de metileno', 'Vaso de precipitados', 'Matraz Erlenmeyer', 'Pipeta graduada', 'Bureta', 'Tubo de ensayo', 'Probeta', 'Mechero Bunsen', 'Termómetro'];
  const PRESENT = ['50 mL', '100 mL', '250 mL', '500 mL', '1 L', '100 g', '250 g', 'grado reactivo'];
  const PRACTICAS = ['Titulación ácido-base', 'Síntesis de aspirina', 'Electrólisis del agua', 'Reacciones redox', 'Cristalización de sales', 'Identificación de cationes', 'Destilación simple', 'Saponificación', 'Cromatografía en papel', 'Determinación de pH'];
  const UBICACIONES = ['Edificio C · Planta baja', 'Edificio C · Primer piso', 'Edificio B · Aula 12', 'Edificio A · Sótano', 'Edificio D · Segundo piso'];

  const rint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

  const fullName = () => `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
  const emailFrom = (nombre) => {
    const p = nombre.split(' ');
    return `${slug(p[0])}.${slug(p[1] || 'demo')}${rint(1, 999)}@lasalle.demo`;
  };
  const materialName = () => `${pick(REACTIVOS)} ${pick(PRESENT)}`;
  const fechaFutura = () => {
    const d = new Date();
    d.setDate(d.getDate() + rint(1, 30));
    return d.toISOString().slice(0, 10);
  };
  const horaRandom = () => `${String(rint(7, 17)).padStart(2, '0')}:${pick(['00', '30'])}`;

  // ---------- helpers de formulario ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const setVal = (form, name, value) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Elige una opción aleatoria (no vacía) de un <select> y dispara change
  const pickOption = (select) => {
    if (!select) return '';
    const opts = Array.from(select.options).filter((o) => o.value !== '');
    if (!opts.length) return '';
    const o = pick(opts);
    select.value = o.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return o.value;
  };

  const goTab = (key) => { if (key) window.location.hash = '#' + key; };

  const clickSubtab = (tabKey, subKey) => {
    const btn = document.querySelector(`[data-tab="${tabKey}"] button[data-subtab="${subKey}"]`);
    if (btn) btn.click();
  };

  const finalizar = (form, mensaje) => {
    const submit = form && form.querySelector('button[type="submit"], .btn-primary, .btn-secondary');
    if (submit) submit.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (form) {
      form.style.transition = 'box-shadow .3s ease';
      form.style.boxShadow = '0 0 0 3px rgba(224,115,56,.55)';
      setTimeout(() => { form.style.boxShadow = ''; }, 1400);
    }
    toast(mensaje || 'Formulario rellenado · revisa y haz clic en crear');
  };

  // ---------- registro de scripts por rol ----------
  const buildScripts = () => {
    const lista = [];
    const esAdmin = !!document.getElementById('formUsuario');
    const esMaestro = !!document.getElementById('formSesion');
    const esEstudiante = !!document.getElementById('signaturePad');

    if (esAdmin) {
      lista.push({
        label: 'Crear usuario',
        run: async () => {
          goTab('users');
          await wait(120);
          const f = document.getElementById('formUsuario');
          const nombre = fullName();
          setVal(f, 'nombre', nombre);
          setVal(f, 'email', emailFrom(nombre));
          setVal(f, 'password', 'Demo1234!');
          setVal(f, 'rol', pick(['MAESTRO', 'ADMIN']));
          finalizar(f, 'Usuario de demo rellenado');
        }
      });
      lista.push({
        label: 'Crear material',
        run: async () => {
          goTab('mats');
          await wait(120);
          clickSubtab('mats', 'mats-new');
          await wait(80);
          const f = document.getElementById('formMaterial');
          setVal(f, 'nombre', materialName());
          setVal(f, 'stock', String(rint(5, 300)));
          finalizar(f, 'Material de demo rellenado');
        }
      });
      lista.push({
        label: 'Crear laboratorio',
        run: async () => {
          goTab('labs');
          await wait(120);
          clickSubtab('labs', 'labs-aulas');
          await wait(80);
          const f = document.getElementById('formLaboratorio');
          setVal(f, 'nombre', `Laboratorio de Química ${pick(['C', 'D', 'E', 'F', 'G'])}-${rint(1, 9)}`);
          setVal(f, 'ubicacion', pick(UBICACIONES));
          setVal(f, 'capacidad', String(rint(15, 40)));
          finalizar(f, 'Laboratorio de demo rellenado');
        }
      });
    }

    if (esMaestro) {
      lista.push({
        label: 'Crear grupo',
        run: async () => {
          goTab('alumnos');
          await wait(120);
          clickSubtab('alumnos', 'al-grps');
          await wait(80);
          const f = document.getElementById('formGrupo');
          setVal(f, 'nombre', `${rint(1, 6)}${pick(['QM', 'IS', 'BT'])}-${rint(1, 4)}`);
          finalizar(f, 'Grupo de demo rellenado');
        }
      });
      lista.push({
        label: 'Crear práctica',
        run: async () => {
          goTab('practs');
          await wait(120);
          const f = document.getElementById('formPractica');
          const p = pick(PRACTICAS);
          setVal(f, 'nombre', p);
          setVal(f, 'descripcion', `Práctica de laboratorio: ${p.toLowerCase()}. Generada para demostración.`);
          finalizar(f, 'Práctica de demo rellenada');
        }
      });
      lista.push({
        label: 'Crear kit (de la 1ª práctica)',
        run: async () => {
          goTab('practs');
          await wait(120);
          const kitBtn = document.querySelector('#practicasList button[data-kits]');
          if (!kitBtn) { toast('Primero crea una práctica (script anterior).'); return; }
          kitBtn.click();
          await wait(250);
          const f = document.getElementById('formKit');
          setVal(f, 'nombre', `Kit ${pick(['básico', 'avanzado', 'estándar', 'reactivos', 'vidriería'])} ${rint(1, 20)}`);
          finalizar(f, 'Kit de demo rellenado');
        }
      });
      lista.push({
        label: 'Crear sesión (completa)',
        run: async () => {
          goTab('sesiones');
          await wait(120);
          clickSubtab('sesiones', 'ses-new');
          await wait(80);
          const f = document.getElementById('formSesion');
          pickOption(f.querySelector('[name="practica_id"]'));
          await wait(400); // espera a que carguen los kits de esa práctica
          pickOption(f.querySelector('[name="kit_id"]'));
          pickOption(f.querySelector('[name="grupo_id"]'));
          pickOption(f.querySelector('[name="laboratorio_id"]'));
          setVal(f, 'fecha', fechaFutura());
          setVal(f, 'hora_inicio', horaRandom());
          setVal(f, 'duracion_min', String(pick([60, 90, 120])));
          setVal(f, 'num_equipos', String(rint(4, 8)));
          setVal(f, 'integrantes_por_equipo', String(rint(3, 5)));
          finalizar(f, 'Sesión de demo rellenada (revisa lab/horario)');
        }
      });
    }

    if (esEstudiante) {
      lista.push({
        label: 'Dibujar firma de prueba',
        run: async () => {
          goTab('equipo');
          await wait(120);
          dibujarFirma();
          toast('Firma de prueba dibujada · pulsa "Firmar"');
        }
      });
    }

    return lista;
  };

  // Garabato sobre el canvas de firma (dispara eventos de mouse para que el pad lo registre)
  const dibujarFirma = () => {
    const cv = document.getElementById('signaturePad');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const ev = (type, x, y) => {
      const opts = { bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y, button: 0 };
      cv.dispatchEvent(new MouseEvent(type, opts));
      cv.dispatchEvent(new PointerEvent(type.replace('mouse', 'pointer'), Object.assign({ pointerId: 1, pointerType: 'mouse' }, opts)));
    };
    const w = r.width || 300, h = r.height || 200;
    ev('mousedown', w * 0.15, h * 0.6);
    for (let i = 1; i <= 16; i++) {
      ev('mousemove', w * (0.15 + 0.7 * (i / 16)), h * (0.5 + 0.25 * Math.sin(i)));
    }
    ev('mouseup', w * 0.85, h * 0.5);
  };

  // ---------- UI del panel ----------
  let scripts = [];
  let abierto = false;
  let panel, listaEl;

  const injectStyles = () => {
    const css = `
      #demoPanel{position:fixed;right:18px;bottom:84px;width:300px;max-width:calc(100vw - 36px);z-index:99999;
        background:linear-gradient(180deg,rgba(16,52,62,.97),rgba(12,42,51,.97));color:#fff;border-radius:18px;
        border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 60px -18px rgba(0,0,0,.6);
        backdrop-filter:blur(14px);font-family:var(--font,'Hanken Grotesk',system-ui,sans-serif);
        overflow:hidden;transform-origin:bottom right;animation:demoIn .22s cubic-bezier(.22,1,.36,1);}
      #demoPanel[hidden]{display:none}
      @keyframes demoIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
      #demoPanel .dp-head{display:flex;align-items:center;gap:8px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.1);
        font-family:var(--font-display,'Bricolage Grotesque',sans-serif);font-weight:800;font-size:15px;letter-spacing:-.01em}
      #demoPanel .dp-head .dp-dot{width:9px;height:9px;border-radius:50%;background:#ed8a4f;box-shadow:0 0 10px #ed8a4f}
      #demoPanel .dp-head small{margin-left:auto;font-weight:600;font-size:11px;color:rgba(255,255,255,.6);font-family:var(--font)}
      #demoPanel ul{list-style:none;margin:0;padding:6px;max-height:50vh;overflow:auto}
      #demoPanel li{display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:11px;cursor:pointer;
        transition:background .15s ease}
      #demoPanel li:hover{background:rgba(255,255,255,.09)}
      #demoPanel .dp-num{flex:0 0 26px;height:26px;display:grid;place-items:center;border-radius:8px;
        background:linear-gradient(135deg,#3a8ea3,#e07338);color:#fff;font-weight:800;font-size:13px}
      #demoPanel .dp-label{font-size:13.5px;font-weight:600}
      #demoPanel .dp-foot{padding:10px 14px;border-top:1px solid rgba(255,255,255,.1);font-size:11.5px;color:rgba(255,255,255,.7)}
      #demoPanel .dp-foot b{color:#f4a674}
      #demoPanel .dp-empty{padding:18px 14px;font-size:13px;color:rgba(255,255,255,.7);text-align:center}
      #demoFab{position:fixed;right:18px;bottom:18px;z-index:99998;width:46px;height:46px;border-radius:50%;
        background:linear-gradient(135deg,#3a8ea3,#e07338);color:#fff;display:grid;place-items:center;cursor:pointer;
        box-shadow:0 10px 26px -8px rgba(0,0,0,.6);font-size:18px;border:1px solid rgba(255,255,255,.2);
        transition:transform .2s ease}
      #demoFab:hover{transform:scale(1.08) rotate(8deg)}
      @media (min-width:900px){#demoFab{right:24px;bottom:24px}#demoPanel{right:24px;bottom:84px}}
      #demoToast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:99999;
        background:rgba(16,52,62,.96);color:#fff;padding:11px 18px;border-radius:999px;font-size:13px;font-weight:600;
        box-shadow:0 12px 30px -10px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.14);
        opacity:0;transition:opacity .2s ease,transform .2s ease;pointer-events:none;max-width:90vw}
      #demoToast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  };

  let toastEl, toastTimer;
  const toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'demoToast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  const renderLista = () => {
    if (!scripts.length) {
      listaEl.innerHTML = '<div class="dp-empty">No hay formularios que autollenar en esta pantalla.</div>';
      return;
    }
    listaEl.innerHTML = scripts.map((s, i) => `
      <li data-run="${i}">
        <span class="dp-num">${i + 1}</span>
        <span class="dp-label">${s.label}</span>
      </li>`).join('');
    listaEl.querySelectorAll('li[data-run]').forEach((li) => {
      li.addEventListener('click', () => ejecutar(Number(li.dataset.run)));
    });
  };

  const construirPanel = () => {
    panel = document.createElement('div');
    panel.id = 'demoPanel';
    panel.hidden = true;
    panel.tabIndex = -1;
    panel.innerHTML = `
      <div class="dp-head"><span class="dp-dot"></span> Scripts de demo <small>Ctrl + 0</small></div>
      <ul id="demoLista"></ul>
      <div class="dp-foot">Presiona <b>1-9</b> para ejecutar · <b>Esc</b> para cerrar</div>`;
    document.body.appendChild(panel);
    listaEl = panel.querySelector('#demoLista');

    const fab = document.createElement('div');
    fab.id = 'demoFab';
    fab.title = 'Scripts de demo (Ctrl+0)';
    fab.innerHTML = '⚡';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);
  };

  const abrir = () => {
    scripts = buildScripts();
    renderLista();
    panel.hidden = false;
    abierto = true;
    panel.focus();
  };
  const cerrar = () => { panel.hidden = true; abierto = false; };
  const toggle = () => { abierto ? cerrar() : abrir(); };

  const ejecutar = (idx) => {
    if (idx < 0 || idx >= scripts.length) return;
    cerrar();
    Promise.resolve(scripts[idx].run()).catch((e) => toast('Error en el script: ' + e.message));
  };

  // ---------- atajos de teclado ----------
  const onKey = (e) => {
    // Ctrl + 0  -> abrir/cerrar
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.code === 'Digit0' || e.code === 'Numpad0' || e.key === '0')) {
      e.preventDefault();
      toggle();
      return;
    }
    if (!abierto) return;
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    // 1..9 -> ejecutar script
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      ejecutar(Number(e.key) - 1);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    construirPanel();
    document.addEventListener('keydown', onKey);
  });
})();
