/* =========================================================
   BimestManager · animations.js — v3 CINEMATIC
   ----------------------------------------------------------
   Sin dependencias externas. Vanilla JS + Canvas 2D.
   - Loader fade-out
   - Partículas conectadas (network) en hero
   - Scroll reveal con IntersectionObserver
   - iPhone 3D — parallax con mouse
   - Tilt 3D automático en cards
   - Botones magnéticos
   - Cursor blob personalizado
   - Contadores animados
   - Navbar dinámico al scroll
   - Sidebar activo en docs
   - Smooth scroll
   - Toggle menú móvil
   - Respeta prefers-reduced-motion
   ========================================================= */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;

  /* ============== 1. LOADER ============== */
  const loader = document.getElementById("loader");
  if (loader) {
    window.addEventListener("load", () => {
      setTimeout(() => loader.classList.add("hidden"), reduced ? 100 : 700);
    });
    setTimeout(() => loader.classList.add("hidden"), 2400); // failsafe
  }

  /* ============== 2. CURSOR BLOB ============== */
  const cursor = document.getElementById("cursor");
  if (cursor && !isTouch && !reduced) {
    document.body.classList.add("has-cursor");
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let tx = cx, ty = cy;
    const lerp = (a, b, n) => a + (b - a) * n;
    window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; });
    const tick = () => {
      cx = lerp(cx, tx, 0.18);
      cy = lerp(cy, ty, 0.18);
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    tick();
    document.querySelectorAll("a, button, [data-tilt], .magnetic, .materia, .team-card, .role, .col-cmp, .pillar").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("large"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("large"));
    });
  }

  /* ============== 3. PARTÍCULAS CANVAS 2D ============== */
  const canvas = document.getElementById("hero-canvas");
  if (canvas && !reduced) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    const COLORS = ["#9b7cf2", "#e07338", "#6d4fc7", "#ed8a4f", "#3a8ea3"];

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(95, Math.floor((W * H) / 16000));
      particles = Array.from({ length: target }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 16000) {
          const f = (16000 - dist2) / 16000;
          p.x += (dx / Math.sqrt(dist2 + 1)) * f * 1.3;
          p.y += (dy / Math.sqrt(dist2 + 1)) * f * 1.3;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.65;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 13000) {
            const alpha = 1 - d2 / 13000;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(155, 124, 242, ${alpha * 0.35})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    window.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });
  }

  /* ============== 4. SCROLL REVEAL ============== */
  const revealEls = document.querySelectorAll(".reveal, .line");
  if (reduced) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -50px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ============== 5. iPHONE — TILT 3D CON MOUSE ============== */
  const iphone = document.getElementById("iphone");
  if (iphone && !isTouch && !reduced) {
    let raf = null;
    let baseY = -8;  // rotación base en Y (mira ligeramente a la izq)
    let baseX = 2;   // rotación base en X
    let cz = 0;

    window.addEventListener("mousemove", (e) => {
      const xRatio = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
      const yRatio = (e.clientY / window.innerHeight - 0.5) * 2;  // -1..1
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rotY = baseY + xRatio * 8;   // tilt Y
        const rotX = baseX - yRatio * 6;   // tilt X
        iphone.style.transform =
          `rotateY(${rotY}deg) rotateX(${rotX}deg) translateZ(0)`;
      });
    });

    // Pausa la animación CSS float cuando el mouse está activo en pantalla
    let mouseInside = false;
    document.addEventListener("mouseenter", () => { mouseInside = true; });
    document.addEventListener("mouseleave", () => {
      mouseInside = false;
      iphone.style.transform = "";
    });
  }

  /* ============== 6. TILT 3D AUTOMÁTICO EN CARDS ============== */
  if (!isTouch && !reduced) {
    const tiltSelectors = [
      "[data-tilt]",
      ".materia",
      ".team-card",
      ".role",
      ".server-box",
      ".col-cmp",
      ".pillar",
      ".incluye-item",
    ].join(", ");

    document.querySelectorAll(tiltSelectors).forEach((el) => {
      const maxTilt = parseFloat(el.dataset.tilt) || 5;
      let raf = null;

      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const rx = (0.5 - y) * maxTilt * 2;
        const ry = (x - 0.5) * maxTilt * 2;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      });

      el.addEventListener("mouseleave", () => {
        if (raf) cancelAnimationFrame(raf);
        el.style.transform = "";
      });
    });
  }

  /* ============== 7. BOTONES MAGNÉTICOS ============== */
  if (!isTouch && !reduced) {
    document.querySelectorAll(".magnetic").forEach((el) => {
      const strength = 0.3;
      let raf = null;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
        });
      });
      el.addEventListener("mouseleave", () => {
        if (raf) cancelAnimationFrame(raf);
        el.style.transform = "";
      });
    });
  }

  /* ============== 8. CONTADORES ANIMADOS ============== */
  const counters = document.querySelectorAll(".counter");
  if (counters.length > 0) {
    const animateCount = (el) => {
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target) || reduced) {
        el.textContent = target || 0;
        return;
      }
      const duration = 1700;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.floor(eased * target);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target;
      };
      requestAnimationFrame(step);
    };

    if ("IntersectionObserver" in window) {
      const co = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            co.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      counters.forEach((el) => co.observe(el));
    } else {
      counters.forEach(animateCount);
    }
  }

  /* ============== 9. NAVBAR AL SCROLL ============== */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 24) nav.classList.add("scrolled");
      else nav.classList.remove("scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ============== 10. DOCS SIDEBAR ACTIVO ============== */
  const sidebarLinks = document.querySelectorAll(".docs-sidebar a");
  if (sidebarLinks.length > 0) {
    const sections = [];
    sidebarLinks.forEach((link) => {
      const id = link.getAttribute("href").slice(1);
      const sec = document.getElementById(id);
      if (sec) sections.push({ id, sec, link });
    });
    const setActive = () => {
      const scrollPos = window.scrollY + 140;
      let current = sections[0];
      for (const s of sections) if (s.sec.offsetTop <= scrollPos) current = s;
      sidebarLinks.forEach((l) => l.classList.remove("active"));
      if (current) current.link.classList.add("active");
    };
    setActive();
    window.addEventListener("scroll", setActive, { passive: true });
  }

  /* ============== 11. SMOOTH SCROLL ============== */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      const navLinks = document.getElementById("navLinks");
      if (navLinks) navLinks.classList.remove("open");
    });
  });

  /* ============== 12. MENÚ MÓVIL ============== */
  const toggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (toggle && navLinks) {
    toggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  }
})();
