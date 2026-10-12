// Dammer website. Motion is GSAP + ScrollTrigger + SplitText over Lenis smooth
// scroll. Without those libraries, or with reduced motion, the page is fully
// usable: everything is visible and the steps work as plain buttons.

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* The live demos: two copies of the real popup, each in an iframe. */

  const frames = $$('.demo');
  const caption = $('#heroCaption');
  let refreshes = 0;

  addEventListener('message', (event) => {
    if (event.origin !== location.origin || !event.data?.dammer) return;
    const frame = frames.find((f) => f.contentWindow === event.source);
    if (!frame) return;
    if (event.data.type === 'height') frame.style.height = `${event.data.value}px`;
    if (event.data.type === 'refresh' && frame === frames[0]) {
      refreshes += 1;
      caption.textContent = `Just refreshed “${event.data.title}”. ${refreshes} so far.`;
      refreshPage();
    }
  });

  /* The browser window in the hero: each real refresh from the popup reloads
     its page, and a new message arrives at the top. */

  const rows = $$('#rows li');
  function refreshPage() {
    rows.forEach((row, i) => {
      row.classList.toggle('is-new', i === 0);
      row.lastElementChild.style.setProperty('--w', `${42 + Math.random() * 50}%`);
    });
    $('#pageNote').textContent = refreshes === 1 ? '1 new message' : `${refreshes} new messages`;
    dispatchEvent(new CustomEvent('dammer:refresh'));
    if (!motionOK) return;
    // The chosen card turns over, like a page being reloaded.
    chosen.animate([{ rotate: 'x 0deg' }, { rotate: 'x 360deg' }], { duration: 800, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    gsap
      .timeline()
      .fromTo('#loadBar', { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' })
      .to('#loadBar', { opacity: 0, duration: 0.3 })
      .fromTo('#tabSpin', { rotate: 0 }, { rotate: 720, duration: 1, ease: 'power1.inOut' }, 0)
      .fromTo(rows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.6 }, 0.35);
  }

  // Runs something inside a demo once its popup script is ready.
  function withDemo(frame, action) {
    const attempt = () => {
      try {
        if (frame.contentWindow.demo && frame.contentDocument.body.classList.contains('ready')) return action(frame.contentWindow, frame.contentDocument);
      } catch {}
      setTimeout(attempt, 200);
    };
    attempt();
  }

  /* Tab cards: four example tabs floating beside the headline. Choosing one
     points the live demo at it; they can also be dragged and spring back. */

  const cards = $$('.tabcard');
  const titles = { 11: 'Inbox · Example Mail', 12: 'Orders · Corner Shop', 13: 'Live scores · Matchday', 14: 'Dashboard · Analytics' };
  let chosen = cards[0];
  let run = null;

  function showChosen(card) {
    chosen = card;
    cards.forEach((c) => c.setAttribute('aria-pressed', String(c === card)));
    $('#tabTitle').textContent = titles[card.dataset.tab];
    $('#tabUrl').textContent = card.dataset.site;
    $('#pageTitle').textContent = card.dataset.title;
    $('#pageNote').textContent = 'up to date';
    rows.forEach((row) => row.classList.remove('is-new'));
  }

  function chooseCard(card) {
    if (card === chosen) return;
    showChosen(card);
    withDemo(frames[0], (win) => win.demo.pick(Number(card.dataset.tab)));
  }

  // The chosen card mirrors the demo's real timer. If the tab is changed
  // inside the popup instead, the cards follow.
  withDemo(frames[0], (win) => {
    setInterval(async () => {
      run = await win.demo.run();
      const card = cards.find((c) => Number(c.dataset.tab) === run?.tabId);
      if (card && card !== chosen) showChosen(card);
    }, 400);
  });

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bodies = cards.map((card, i) => ({ card, x: 0, y: 0, vx: 0, vy: 0, grab: null, moved: 0, phase: i * 1.7, lean: [-3, 2.5, 3, -2][i] }));

  for (const body of bodies) {
    const { card } = body;
    card.addEventListener('pointerdown', (event) => {
      if (still) return;
      card.setPointerCapture(event.pointerId);
      body.grab = { px: event.clientX, py: event.clientY, x: body.x, y: body.y };
      body.moved = 0;
    });
    card.addEventListener('pointermove', (event) => {
      if (!body.grab) return;
      const dx = event.clientX - body.grab.px;
      const dy = event.clientY - body.grab.py;
      body.moved = Math.max(body.moved, Math.hypot(dx, dy));
      body.vx = (body.grab.x + dx - body.x) * 12;
      body.vy = (body.grab.y + dy - body.y) * 12;
      body.x = body.grab.x + dx;
      body.y = body.grab.y + dy;
    });
    const release = () => (body.grab = null);
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);
    // A drag is not a choice.
    card.addEventListener('click', () => {
      if (body.moved < 6) chooseCard(card);
      body.moved = 0;
    });
  }

  let cardClock = 0;
  let lastCardFrame = 0;
  function cardFrame(now) {
    const dt = lastCardFrame ? Math.min((now - lastCardFrame) / 1000, 1 / 20) : 1 / 60;
    lastCardFrame = now;
    cardClock += dt;
    for (const body of bodies) {
      if (!body.grab) {
        // A spring pulls each card home; released mid-throw, it overshoots and settles.
        body.vx += (-90 * body.x - 9 * body.vx) * dt;
        body.vy += (-90 * body.y - 9 * body.vy) * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
      }
      const bob = still ? 0 : Math.sin(cardClock * 0.9 + body.phase) * 6;
      body.card.style.translate = `${body.x.toFixed(1)}px ${(body.y + bob).toFixed(1)}px`;
      body.card.style.rotate = `${(body.lean + clampNumber(body.vx * 0.012, -9, 9)).toFixed(2)}deg`;

      const live = body.card === chosen && run;
      const total = live ? Math.max(1, run.nextAt - run.cycleStart) : 1;
      const left = live ? Math.max(0, run.nextAt - Date.now()) : 0;
      body.card.style.setProperty('--p', live ? String(Math.min(1, 1 - left / total)) : '0');
      const text = live ? `0:${String(Math.ceil(left / 1000)).padStart(2, '0')}` : 'idle';
      const label = body.card.querySelector('.tabcard-time');
      if (label.textContent !== text) label.textContent = text;
    }
    requestAnimationFrame(cardFrame);
  }
  const clampNumber = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  requestAnimationFrame(cardFrame);

  /* How it works: each step re-configures the second demo. */

  const how = $('#how');
  const howFrame = frames[1];
  const steps = $$('.step');
  const looks = [
    { settings: { timer: 'digital', theme: 'light', accent: 'moss' }, menu: true },
    { settings: { timer: 'analog', theme: 'light', accent: 'moss' } },
    { settings: { timer: 'analog', theme: 'glass', accent: 'moss' }, dark: true },
    { settings: { timer: 'digital', theme: 'glass', accent: 'clay' }, dark: true },
  ];
  let current = -1;

  function setStep(index) {
    if (index === current) return;
    current = index;
    const look = looks[index];
    steps.forEach((step, i) => step.setAttribute('aria-current', String(i === index)));
    how.classList.toggle('is-dark', Boolean(look.dark));
    document.body.classList.toggle('nav-light', Boolean(look.dark) && inHow);
    withDemo(howFrame, (win, doc) => {
      win.demo.set(look.settings);
      const menuOpen = !doc.getElementById('tabMenu').hidden;
      if (Boolean(look.menu) !== menuOpen) doc.getElementById('tabButton').click();
    });
  }

  let inHow = false;
  steps.forEach((step, index) => step.addEventListener('click', () => (scrollToStep ? scrollToStep(index) : setStep(index))));
  let scrollToStep = null;

  const motionOK = window.gsap && window.ScrollTrigger && window.SplitText && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!motionOK) {
    setStep(0);
    return;
  }

  /* Motion */

  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'expo.out', duration: 1.1 });
  document.documentElement.classList.add('motion');

  // Smooth scroll, driven by GSAP's ticker so there is a single frame loop.
  // Touch devices keep their native scrolling.
  let lenis = null;
  if (window.Lenis && matchMedia('(pointer: fine)').matches) {
    lenis = new Lenis({ lerp: 0.11, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const lines = (el) => SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true, aria: 'auto' });

  document.fonts.ready.then(() => {
    /* Hero: headline lines rise out of their masks, then the rest follows in overlap. */
    const headline = lines('#headline');
    gsap
      .timeline({ delay: 0.15 })
      .from(headline.lines, { yPercent: 110, duration: 1.3, stagger: 0.11 })
      .to('.nav[data-load]', { opacity: 1, duration: 0.8 }, 0.1)
      .fromTo('.hero-copy [data-load]', { opacity: 0, y: 26 }, { opacity: 1, y: 0, stagger: 0.09 }, 0.45)
      .fromTo('.tabcard', { opacity: 0, y: -70, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 1.3, stagger: 0.12 }, 0.5)
      .fromTo('.hero-demo', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1.4 }, 0.6)
      .fromTo('#heroDevice', { y: -40, scale: 0.94, opacity: 0, transformOrigin: '86% 0%' }, { y: 0, scale: 1, opacity: 1, duration: 1.1 }, 1.1)
      .fromTo('.facts', { opacity: 0 }, { opacity: 1 }, 0.9)
      .from('.facts div', { y: 22, opacity: 0, stagger: 0.07 }, 0.9);

    /* Section headings use the same masked-line reveal as they arrive. */
    for (const heading of $$('[data-lines]')) {
      const split = lines(heading);
      gsap.from(split.lines, { yPercent: 110, duration: 1.2, stagger: 0.1, scrollTrigger: { trigger: heading, start: 'top 86%' } });
    }

    measure();
  });
  addEventListener('load', measure);

  // Triggers below the pinned section must be measured after it, whatever
  // order they were created in.
  function measure() {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }

  /* Hero leaving: the copy eases back while the browser and the popup over it
     drift at different speeds, so the popup reads as floating. */
  gsap.to('.hero-copy', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero-sky', start: 'top top', end: 'bottom top', scrub: 0.6 } });
  gsap
    .timeline({ scrollTrigger: { trigger: '.stage', start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
    .fromTo('.browser', { yPercent: 3 }, { yPercent: -3, ease: 'none' }, 0)
    .fromTo('.stage .slot', { yPercent: 5 }, { yPercent: -6, ease: 'none' }, 0);

  /* Generic reveals, staggered within whatever arrives together. */
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.fromTo(batch, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.09 }),
  });

  gsap.matchMedia().add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, ({ conditions }) => {
    if (conditions.wide) {
      /* Signature: the section pins and the scrub walks the real popup through four set-ups. */
      const trigger = ScrollTrigger.create({
        trigger: how,
        start: 'top top',
        end: '+=320%',
        pin: '.how-pin',
        scrub: 1,
        animation: gsap
          .timeline({ defaults: { ease: 'none' } })
          .to('#rail', { scaleY: 1, duration: 4 }, 0)
          .fromTo('#howDevice', { yPercent: 5, rotate: -1.5 }, { yPercent: -5, rotate: 1.5, duration: 4 }, 0),
        onUpdate: (self) => setStep(Math.min(looks.length - 1, Math.floor(self.progress * looks.length))),
        onToggle: (self) => {
          inHow = self.isActive;
          document.body.classList.toggle('nav-light', inHow && Boolean(looks[Math.max(0, current)].dark));
        },
      });
      scrollToStep = (index) => {
        const y = trigger.start + ((index + 0.5) / looks.length) * (trigger.end - trigger.start);
        if (lenis) lenis.scrollTo(y);
        else window.scrollTo({ top: y, behavior: 'smooth' });
      };
      setStep(0);
      return () => {
        scrollToStep = null;
      };
    }
    setStep(0);
  });

  /* Privacy: each line is struck through as it reaches the middle of the screen. */
  for (const item of $$('.never-list li')) {
    gsap.fromTo(
      item,
      { '--strike': 0, opacity: 0.4 },
      { '--strike': 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: item, start: 'top 82%', end: 'top 48%', scrub: 0.5 } },
    );
  }

  /* The nav turns light while it is over the dark privacy section. */
  ScrollTrigger.create({
    trigger: '.never',
    start: 'top 40px',
    end: 'bottom 40px',
    onToggle: (self) => document.body.classList.toggle('nav-over-dark', self.isActive),
  });

  /* Screens drift sideways as the section passes. */
  const track = $('#track');
  gsap.to(track, {
    x: () => -(track.scrollWidth - innerWidth),
    ease: 'none',
    scrollTrigger: { trigger: '.screens', start: 'top 70%', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
  });

  /* Install steps and the footer wordmark. */
  gsap.fromTo('.install-steps li', { opacity: 0, x: 40 }, { opacity: 1, x: 0, stagger: 0.12, scrollTrigger: { trigger: '.install-steps', start: 'top 82%' } });
  gsap.from('.foot-word', { yPercent: 38, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } });
})();
