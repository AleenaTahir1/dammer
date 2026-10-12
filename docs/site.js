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

  /* The browser window in the hero. Each example tab has its own made-up page;
     every real refresh from the popup reloads it and something new arrives
     at the top, which is the whole reason anyone refreshes a tab. */

  const PAGES = {
    11: {
      url: 'mail.example.com/inbox', app: 'Example Mail', letter: 'M', colour: '#c2573a', title: 'Inbox', tab: 'Inbox · Example Mail', noun: 'message',
      nav: [['Inbox', '3'], ['Starred'], ['Sent'], ['Drafts', '1'], ['Archive']],
      rows: [['Priya Nair', 'Invoice for October — totals attached', '09:41'], ['Tom Becker', 'Re: Logo revisions, round two', '09:12'], ['Studio Lumen', 'Your order has shipped', 'Yesterday'], ['Hana Sato', 'Can we move the call to Friday?', 'Yesterday'], ['Billing', 'Receipt for your subscription', 'Mon'], ['Omar Haddad', 'Thanks for the quick turnaround', 'Mon']],
      incoming: [['Daniel Okafor', 'New brief: landing page for a bakery'], ['Lea Martin', 'Quick question about delivery time'], ['Noor Aziz', 'Approved — please send the final files'], ['Sam Rivera', 'Are you free for a small job today?']],
    },
    12: {
      url: 'shop.example.org/orders', app: 'Corner Shop', letter: 'C', colour: '#2f7d6b', title: 'Orders', tab: 'Orders · Corner Shop', noun: 'order',
      nav: [['Orders', '12'], ['Products'], ['Customers'], ['Payouts'], ['Settings']],
      rows: [['Order #4821', 'Maya Chen · 2 items · Paid', '$84.00'], ['Order #4820', 'Jonas Weber · 1 item · Paid', '$29.00'], ['Order #4819', 'Aisha Khan · 4 items · Packed', '$152.50'], ['Order #4818', 'Luca Rossi · 1 item · Shipped', '$18.00'], ['Order #4817', 'Emma Clarke · 3 items · Shipped', '$67.20'], ['Order #4816', 'Kenji Mori · 2 items · Delivered', '$41.00']],
      incoming: [['Order #4822', 'Sofia Alvarez · 1 item · Paid'], ['Order #4823', 'Ben Carter · 3 items · Paid'], ['Order #4824', 'Ines Dubois · 2 items · Paid'], ['Order #4825', 'Ravi Patel · 5 items · Paid']],
    },
    13: {
      url: 'scores.example.net/live', app: 'Matchday', letter: 'S', colour: '#2d5fb8', title: 'Live scores', tab: 'Live scores · Matchday', noun: 'update',
      nav: [['Live', '4'], ['Fixtures'], ['Results'], ['Tables'], ['Following']],
      rows: [['Harbour City 2 – 1 Northfield', 'Second half · 64′', 'Live'], ['Eastbrook 0 – 0 Lakeside', 'First half · 31′', 'Live'], ['Riverton 3 – 2 Ashdown', 'Second half · 88′', 'Live'], ['Westmoor 1 – 1 Kingsbridge', 'Half time', 'HT'], ['Oldport 2 – 0 Fenwick', 'Full time', 'FT'], ['Marlow 1 – 3 Stonehill', 'Full time', 'FT']],
      incoming: [['Goal! Harbour City 3 – 1 Northfield', 'Second half · 67′'], ['Goal! Eastbrook 1 – 0 Lakeside', 'First half · 38′'], ['Red card · Riverton v Ashdown', 'Second half · 90′'], ['Goal! Westmoor 2 – 1 Kingsbridge', 'Second half · 52′']],
    },
    14: {
      url: 'stats.example.io/dashboard', app: 'Analytics', letter: 'A', colour: '#6a4fb3', title: 'Dashboard', tab: 'Dashboard · Analytics', noun: 'event',
      nav: [['Dashboard'], ['Visitors'], ['Sales'], ['Reports'], ['Alerts', '2']],
      rows: [['Visitors right now', '128 people on the site', 'Live'], ['New signup', 'ana@example.com · Free plan', '2 min'], ['Sale completed', 'Pro plan · yearly', '6 min'], ['New signup', 'kofi@example.com · Free plan', '9 min'], ['Traffic spike', 'Search · up 18% in the last hour', '14 min'], ['Sale completed', 'Starter plan · monthly', '21 min']],
      incoming: [['Sale completed', 'Pro plan · monthly'], ['New signup', 'mei@example.com · Pro trial'], ['Visitors right now', '141 people on the site'], ['New signup', 'liam@example.com · Free plan']],
    },
  };
  const TONES = ['#8a9aa8', '#b08968', '#7fa37a', '#a87fa3', '#7f8fc0', '#c08a7f'];
  const rowList = $('#rows');
  let page = PAGES[11];
  let arrivals = 0;

  function rowFor([who, text, meta], index, fresh) {
    const li = document.createElement('li');
    li.className = fresh ? 'is-new' : '';
    li.innerHTML = '<i></i><b></b><time></time><span></span>';
    li.children[0].textContent = who.replace(/^(Order #|Goal! )/, '')[0];
    li.children[0].style.setProperty('--tone', fresh ? page.colour : TONES[index % TONES.length]);
    li.children[1].textContent = who;
    li.children[2].textContent = meta;
    li.children[3].textContent = text;
    return li;
  }

  function showPage(tabId) {
    page = PAGES[tabId];
    arrivals = 0;
    const browser = $('.browser');
    browser.style.setProperty('--fav', page.colour);
    for (const id of ['tabFav', 'appFav']) $(`#${id}`).textContent = page.letter;
    $('#tabTitle').textContent = page.tab;
    $('#tabUrl').textContent = page.url;
    $('#appName').textContent = page.app;
    $('#pageTitle').textContent = page.title;
    $('#pageNote').textContent = 'Up to date';
    $('#pageNav').replaceChildren(
      ...page.nav.map(([name, count], i) => {
        const li = document.createElement('li');
        li.className = i === 0 ? 'is-here' : '';
        li.textContent = name;
        if (count) li.append(Object.assign(document.createElement('span'), { textContent: count }));
        return li;
      }),
    );
    page.shown = page.rows.map((row) => [...row]);
    rowList.replaceChildren(...page.shown.map((row, i) => rowFor(row, i, false)));
  }

  function refreshPage() {
    // Something new arrives at the top and the oldest row drops off.
    const [who, text] = page.incoming[arrivals % page.incoming.length];
    arrivals += 1;
    page.shown = [[who, text, 'now'], ...page.shown.slice(0, 5)];
    const draw = () => {
      rowList.replaceChildren(...page.shown.map((row, i) => rowFor(row, i, i === 0)));
      $('#pageNote').textContent = `${arrivals} new ${page.noun}${arrivals === 1 ? '' : 's'} since you started`;
    };
    dispatchEvent(new CustomEvent('dammer:refresh'));
    if (!motionOK) return draw();
    // As in Chrome: the tab icon becomes a spinner, the reload arrow turns, a
    // bar runs across, the page blanks for a moment and comes back.
    const icon = $('#tabFav');
    icon.classList.add('is-loading');
    gsap
      .timeline({ onComplete: () => icon.classList.remove('is-loading') })
      .fromTo('#reloadIcon', { rotate: 0 }, { rotate: 360, duration: 0.8, ease: 'power2.inOut', transformOrigin: '50% 50%' }, 0)
      .fromTo('#loadBar', { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.75, ease: 'power2.inOut' }, 0)
      .to('.page-main', { opacity: 0, duration: 0.18 }, 0.05)
      .add(() => {
        draw();
        gsap.fromTo('#rows li', { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.45 });
      }, 0.45)
      .to('.page-main', { opacity: 1, duration: 0.3 }, 0.5)
      .to('#loadBar', { opacity: 0, duration: 0.25 }, 0.8);
  }

  /* Footer: how long the visitor has stayed. The bar fills once a minute. */

  const arrived = Date.now();
  setInterval(() => {
    const seconds = Math.floor((Date.now() - arrived) / 1000);
    $('#stay').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('#stayBar').style.setProperty('--p', String((seconds % 60) / 59));
  }, 1000);

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

  // The browser window shows whichever tab the popup is refreshing, so
  // changing the tab inside the popup changes the page behind it.
  let shownTab = 11;
  showPage(shownTab);
  withDemo(frames[0], (win) => {
    setInterval(async () => {
      const run = await win.demo.run();
      if (!run || run.tabId === shownTab || !PAGES[run.tabId]) return;
      shownTab = run.tabId;
      showPage(shownTab);
    }, 400);
  });

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
  for (const dark of ['.never', '.foot-panel']) {
    ScrollTrigger.create({
      trigger: dark,
      start: 'top 40px',
      end: 'bottom 40px',
      onToggle: (self) => document.body.classList.toggle('nav-over-dark', self.isActive),
    });
  }

  /* Screens drift sideways as the section passes. */
  const track = $('#track');
  gsap.to(track, {
    x: () => -(track.scrollWidth - innerWidth),
    ease: 'none',
    scrollTrigger: { trigger: '.screens', start: 'top 70%', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
  });

  /* Install steps and the footer wordmark. */
  gsap.fromTo('.install-steps li', { opacity: 0, x: 40 }, { opacity: 1, x: 0, stagger: 0.12, scrollTrigger: { trigger: '.install-steps', start: 'top 82%' } });
  /* The footer panel rises into place as the page ends. */
  gsap.from('.foot-panel', { yPercent: 14, scale: 0.965, transformOrigin: '50% 100%', ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'top 35%', scrub: 0.6 } });
})();
