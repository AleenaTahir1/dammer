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
    if (!motionOK) return;
    gsap
      .timeline()
      .fromTo('#loadBar', { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' })
      .to('#loadBar', { opacity: 0, duration: 0.3 })
      .fromTo('#tabSpin', { rotate: 0 }, { rotate: 720, duration: 1, ease: 'power1.inOut' }, 0)
      .fromTo(rows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.6 }, 0.35);
    hop();
  }

  /* The character. */

  const buddy = $('#buddy');
  const bubble = $('#buddySay');
  let bubbleTimer;
  function speak(text) {
    bubble.textContent = text;
    bubble.classList.add('is-on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('is-on'), 3400);
  }
  function hop() {
    gsap.to(buddy, { y: -16, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 });
    speak('Refreshed!');
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
    speak('Hi! I refresh tabs.');
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
      .fromTo('.hero-demo', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1.4 }, 0.3)
      .fromTo('#heroDevice', { y: -40, scale: 0.94, opacity: 0, transformOrigin: '86% 0%' }, { y: 0, scale: 1, opacity: 1, duration: 1.1 }, 0.85)
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
  gsap
    .timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
    .to('.hero-copy', { yPercent: -12, opacity: 0.3, ease: 'none' }, 0)
    .to('.browser', { yPercent: 5, ease: 'none' }, 0)
    .to('.stage .slot', { yPercent: -7, ease: 'none' }, 0);

  /* The character walks along the bottom of the window: how far across it is
     and the ring around it are both the page's scroll progress. */
  const never = $('.never');
  const walk = gsap.quickTo(buddy, 'x', { duration: 0.5, ease: 'power3.out' });
  const covers = (el, y) => {
    const box = el.getBoundingClientRect();
    return box.top < y && box.bottom > y;
  };
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const stride = Math.sin(self.scroll() / 34);
      // It starts just off the left edge and walks in once you begin to scroll.
      walk(self.progress * (innerWidth - buddy.offsetWidth + 62));
      gsap.set('#buddyRing', { attr: { 'stroke-dasharray': `${self.progress * 100} 100` } });
      gsap.set('#legA', { rotate: stride * 30 });
      gsap.set('#legB', { rotate: stride * -30 });
      gsap.set('#buddyBody', { y: -Math.abs(stride) * 2.5, rotate: self.direction * 4, transformOrigin: '50% 80%' });
      buddy.classList.toggle('flip', self.progress > 0.55);
      const feet = innerHeight - 40;
      buddy.classList.toggle('on-dark', covers(never, feet) || (how.classList.contains('is-dark') && covers(how, feet)));
    },
  });
  ScrollTrigger.addEventListener('scrollEnd', () => gsap.to(['#legA', '#legB', '#buddyBody'], { rotate: 0, y: 0, duration: 0.5 }));

  // Its eyes follow the pointer.
  const lookX = gsap.quickTo('#pupils', 'x', { duration: 0.3 });
  const lookY = gsap.quickTo('#pupils', 'y', { duration: 0.3 });
  addEventListener('pointermove', (event) => {
    const box = buddy.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 3);
    const reach = Math.hypot(dx, dy) || 1;
    lookX((dx / reach) * 2.6);
    lookY((dy / reach) * 2.6);
  });

  // And it has something to say about each part of the page.
  const remarks = [
    ['.hero', 'Hi! Scroll and I’ll walk with you.'],
    ['#how', 'Watch the popup change.'],
    ['.never', 'I can’t peek at your pages.'],
    ['.screens', 'That’s every screen I have.'],
    ['.install', 'One minute. Promise.'],
    ['.foot', 'Thanks for scrolling!'],
  ];
  for (const [trigger, text] of remarks) {
    ScrollTrigger.create({ trigger, start: 'top 60%', end: 'bottom 60%', onEnter: () => speak(text), onEnterBack: () => speak(text) });
  }

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
