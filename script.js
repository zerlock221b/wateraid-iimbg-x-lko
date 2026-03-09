/* =============================================
   SCRIPT.JS — WaterAid India Internship Portfolio
   ============================================= */

'use strict';

/* ─── Helpers ──────────────────────────────── */

function $(id) {
  return document.getElementById(id);
}

function $$(sel, ctx) {
  return Array.from((ctx || document).querySelectorAll(sel));
}

/* ─── 1. DARK MODE TOGGLE ───────────────────── */

(function initTheme() {
  const btn = $('theme-toggle');
  const body = document.body;
  const STORAGE_KEY = 'wa-theme';

  function applyTheme(dark) {
    if (dark) {
      body.classList.add('dark-theme');
      if (btn) btn.textContent = '☀️';
    } else {
      body.classList.remove('dark-theme');
      if (btn) btn.textContent = '🌓';
    }
  }

  // On load, read saved preference
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved === 'dark');

  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = body.classList.toggle('dark-theme');
      btn.textContent = isDark ? '☀️' : '🌓';
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    });
  }
})();

/* ─── 2. HAMBURGER MENU (Mobile) ────────────── */

(function initHamburger() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  const navbar = document.querySelector('.navbar');

  if (!hamburger || !navLinks) return;

  // Set initial icon
  hamburger.textContent = '☰';

  function openMenu() {
    navLinks.classList.add('nav-open');
    hamburger.textContent = '✕';
    hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    navLinks.classList.remove('nav-open');
    // Also close any open dropdowns when the whole menu closes
    $$('.dropdown.dropdown-open').forEach((d) => d.classList.remove('dropdown-open'));
    hamburger.textContent = '☰';
    hamburger.setAttribute('aria-expanded', 'false');
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navLinks.classList.contains('nav-open');
    isOpen ? closeMenu() : openMenu();
  });

  // Close the menu only when tapping a REAL navigation link (not parent
  // dropdown labels whose href="#" — those are toggle triggers, not pages).
  $$('a', navLinks).forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href !== '#') {
      link.addEventListener('click', closeMenu);
    }
  });

  // Close when clicking anywhere outside the navbar
  document.addEventListener('click', (e) => {
    if (navbar && !navbar.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
})();

/* ─── 3. DROPDOWN SUPPORT (Touch devices) ───── */

(function initDropdowns() {
  const isTouchDevice = () =>
    window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;

  if (!isTouchDevice()) return; // CSS hover handles desktop

  // On mobile the dropdowns are always visible (static layout).
  // We only need to intercept taps on the top-level <a> labels
  // ("Weeks ▼", "Project Info ▼", "Challenges ▼") — never on links
  // inside the dropdown itself, so navigation is never blocked.
  $$('.nav-links > li').forEach((li) => {
    const dropdown = li.querySelector('.dropdown');
    if (!dropdown) return;

    // The direct child <a> is the section label (e.g. "Weeks ▼")
    const label = li.querySelector(':scope > a');
    if (!label) return;

    label.addEventListener('click', (e) => {
      // If tapping on a link INSIDE the dropdown, let it navigate
      if (e.target.closest('.dropdown')) return;

      // Stop the event bubbling to the document-level listener in initHamburger
      // so the whole .nav-links menu doesn't collapse when toggling a dropdown
      e.stopPropagation();
      e.preventDefault();

      const isOpen = dropdown.classList.contains('dropdown-open');

      // Close all open dropdowns first
      $$('.dropdown.dropdown-open').forEach((d) => {
        d.classList.remove('dropdown-open');
      });

      // Open this one if it was closed
      if (!isOpen) {
        dropdown.classList.add('dropdown-open');
      }
    });
  });

  // Close all dropdowns on outside tap
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-links li')) {
      $$('.dropdown.dropdown-open').forEach((d) => {
        d.classList.remove('dropdown-open');
      });
    }
  });
})();

/* ─── 4 & 5 & 6 & 7. SCROLL MONTAGE ENGINE ─── */

(function initMontage() {
  const canvas = $('montage-canvas');
  const section = $('scroll-montage');
  const captionEl = $('montage-text');
  const logoEl = $('montage-logo');
  const overlayEl = $('candidate-overlay');

  if (!canvas || !section) return;

  const ctx = canvas.getContext('2d');
  const TOTAL_FRAMES = 107; // actual frame count in montage_frames/
  const FRAME_BASE = 'assets/montage_frames/photo'; // files: photo1.jpg … photo107.jpg

  // ── Caption config ──
  const CAPTIONS = [
    { from: 0.00, to: 0.15, text: 'WaterAid India' },
    { from: 0.15, to: 0.30, text: 'Week 1: Foundations' },
    { from: 0.30, to: 0.45, text: 'Week 2: Data Collection' },
    { from: 0.45, to: 0.60, text: 'The Journey Continues\u2026' },
    { from: 0.60, to: 0.75, text: 'Field. Community. Impact.' },
    { from: 0.75, to: 0.90, text: '8 Weeks. Two Projects.' },
    { from: 0.90, to: 1.00, text: 'Meet the Team' },
  ];

  let currentCaption = '';

  // ── Preload frames ──
  const frames = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let currentFrameIndex = 0;
  let rafId = null;
  let ticking = false;
  let lastFraction = -1;

  function frameUrl(i) {
    // frames are: photo1.jpg, photo2.jpg … photo107.jpg  (1-indexed, no padding)
    return FRAME_BASE + (i + 1) + '.jpg';
  }

  function preloadAllFrames() {
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = frameUrl(i);
      img.onload = img.onerror = () => { loadedCount++; };
      frames[i] = img;
    }
  }

  preloadAllFrames();

  // ── Canvas sizing (cover-fill) ──
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawFrame(currentFrameIndex);
  }

  function drawFrame(index) {
    const img = frames[index];
    if (!img || !img.complete || !img.naturalWidth) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // ── Caption update ──
  function updateCaption(fraction) {
    let newText = '';
    for (const c of CAPTIONS) {
      if (fraction >= c.from && fraction < c.to) {
        newText = c.text;
        break;
      }
    }
    if (newText === '') newText = CAPTIONS[CAPTIONS.length - 1].text;

    if (captionEl && newText !== currentCaption) {
      currentCaption = newText;
      captionEl.style.opacity = '0';
      captionEl.style.transition = 'opacity 0.45s ease';
      setTimeout(() => {
        captionEl.textContent = newText;
        captionEl.style.opacity = '1';
      }, 200);
    }
  }

  // ── Logo overlay ──
  function updateLogo(fraction) {
    if (!logoEl) return;

    if (fraction < 0) {
      // Above montage
      logoEl.style.opacity = '1';
      logoEl.style.transform = 'scale(1)';
      return;
    }

    if (fraction >= 0 && fraction < 0.10) {
      const t = fraction / 0.10; // 0→1
      const scale = 0.8 + 0.2 * t;
      logoEl.style.opacity = '1';
      logoEl.style.transform = `scale(${scale})`;
      logoEl.style.display = 'block';
    } else if (fraction >= 0.10 && fraction < 0.20) {
      const t = (fraction - 0.10) / 0.10; // 0→1
      logoEl.style.opacity = String(1 - t);
      logoEl.style.transform = `scale(${1 + t * 0.1})`;
    } else {
      logoEl.style.opacity = '0';
      logoEl.style.transform = 'scale(1.1)';
    }
  }

  // ── Candidate cards overlay ──
  function updateCandidateOverlay(fraction) {
    if (!overlayEl) return;

    if (fraction < 0.50) {
      overlayEl.className = 'hidden-cards';
    } else if (fraction >= 0.50 && fraction < 0.92) {
      overlayEl.className = 'floating';
    } else {
      overlayEl.className = 'show-cards';
    }
  }

  // ── Main scroll render loop ──
  function onScroll() {
    if (!ticking) {
      rafId = requestAnimationFrame(render);
      ticking = true;
    }
  }

  function render() {
    ticking = false;

    const rect = section.getBoundingClientRect();
    const sectionH = section.offsetHeight - window.innerHeight;

    let fraction;
    if (rect.top > 0) {
      // Scroll hasn't reached section yet
      fraction = -1;
    } else if (-rect.top >= sectionH) {
      // Past the section
      fraction = 1;
    } else {
      fraction = -rect.top / sectionH;
    }

    if (fraction === lastFraction) return;
    lastFraction = fraction;

    const clampedFraction = Math.max(0, Math.min(1, fraction));

    // Frame calculation
    const frameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.floor(clampedFraction * TOTAL_FRAMES)
    );

    if (frameIndex !== currentFrameIndex) {
      currentFrameIndex = frameIndex;
      drawFrame(currentFrameIndex);
    }

    updateCaption(clampedFraction);
    updateLogo(fraction);
    updateCandidateOverlay(clampedFraction);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas);

  // Initial setup
  resizeCanvas();
  render();
})();

/* ─── 8. PHOTO CARD STACK INTERACTION ────────── */

(function initPhotoCardStacks() {
  const containers = $$('.photo-cards-container');

  containers.forEach((container) => {
    let cards = $$('.photo-card', container);

    function applyCardPositions() {
      cards.forEach((card, i) => {
        card.style.transition =
          'transform 0.5s cubic-bezier(0.23,1,0.32,1), opacity 0.5s ease, z-index 0s';
        card.style.zIndex = String(cards.length - i);

        switch (i) {
          case 0:
            card.style.transform = 'translate(-50%, -50%) translateY(0px) scale(1)';
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            break;
          case 1:
            card.style.transform = 'translate(-50%, -50%) translateY(20px) scale(0.96)';
            card.style.opacity = '0.92';
            card.style.pointerEvents = 'none';
            break;
          case 2:
            card.style.transform = 'translate(-50%, -50%) translateY(40px) scale(0.92)';
            card.style.opacity = '0.85';
            card.style.pointerEvents = 'none';
            break;
          default:
            card.style.transform = 'translate(-50%, -50%) translateY(60px) scale(0.88)';
            card.style.opacity = '0';
            card.style.pointerEvents = 'none';
            break;
        }
      });
    }

    // Initial layout
    applyCardPositions();

    // Click on top card sends it to the back
    container.addEventListener('click', (e) => {
      const topCard = cards[0];
      if (!topCard) return;
      // Only fire if click target is the top card or inside it
      if (!topCard.contains(e.target)) return;

      // Move top card to end of array
      cards.push(cards.shift());
      // Re-append in DOM order so z-index and tab order stay logical
      cards.forEach((c) => container.appendChild(c));
      applyCardPositions();
    });
  });
})();

/* ─── 9. SCROLL FADE-IN OBSERVER ─────────────── */

(function initScrollObserver() {
  const targets = $$(
    '.project-card, .challenge-box, .candidate-card, .photo-card, .week-container'
  );

  if (!targets.length) return;

  const style = {
    opacity: '0',
    transform: 'translateY(30px)',
    transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
  };

  // Set initial hidden state
  targets.forEach((el) => {
    Object.assign(el.style, style);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        observer.unobserve(el); // Fire once only
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => observer.observe(el));
})();

/* ─── 10. SMOOTH ANCHOR SCROLLING ────────────── */

(function initSmoothAnchors() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();

    const navHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height') || '72',
      10
    );

    const targetTop =
      target.getBoundingClientRect().top + window.pageYOffset - navHeight;

    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  });
})();

/* ─── 11. CANVAS RESIZE HANDLER ──────────────── */

// Canvas resize is handled inside the montage engine above.
// This standalone handler ensures non-montage canvases also
// get updated if any exist elsewhere on the page.

(function initCanvasResizeHandler() {
  let resizeTimer;

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      $$('canvas').forEach((canvas) => {
        if (canvas.id === 'montage-canvas') return; // montage handles itself
        // Generic resize: preserve current rendered bitmap
        const img = new Image();
        img.src = canvas.toDataURL();
        canvas.width = canvas.offsetWidth || canvas.width;
        canvas.height = canvas.offsetHeight || canvas.height;
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      });
    }, 150);
  });
})();
