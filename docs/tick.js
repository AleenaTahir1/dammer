// Tick, the alarm-clock character.
//
// Tick lives in a layer that scrolls with the document and hops between the
// elements marked data-perch: headings, buttons, the browser window, the
// popup, screenshots. It keeps the reader company on the way down the page,
// flips once in the air on long jumps (a "refresh"), and rings its bells
// whenever the live demo refreshes its tab.
//
// States: sitting on a perch → crouching → jumping along an arc → sitting.
// Positions are in the layer's own coordinates and re-measured every frame,
// so Tick stays glued to whatever it sits on, even while that thing moves.
// Skipped entirely with prefers-reduced-motion.

(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const sky = document.querySelector('[data-tick-sky]');
  const tick = sky?.querySelector('[data-tick]');
  const art = tick?.querySelector('svg');
  if (!art) return;

  const part = (name) => art.querySelector(`[data-part="${name}"]`);
  const parts = { feet: part('feet'), bellL: part('bell-l'), bellR: part('bell-r'), eyes: part('eyes'), lids: part('lids'), ring: part('ring') };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = (t) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
  };
  const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  // Tick is drawn in a 64-unit box and stands on the point (32, 61).
  const FOOT_X = 0.5;
  const FOOT_Y = 61 / 64;
  let size = 46;

  /* Where things are */

  let origin = { x: 0, y: 0 };
  let view = { left: 0, top: 0, right: 0, bottom: 0 };
  const measureView = () => {
    const box = sky.getBoundingClientRect();
    origin = { x: box.left, y: box.top };
    view = { left: -box.left, top: -box.top, right: -box.left + document.documentElement.clientWidth, bottom: -box.top + innerHeight };
  };
  // Sized to the page (measured without itself), so Tick never makes the page longer.
  const fitLayer = () => {
    sky.style.height = '0px';
    sky.style.height = `${document.documentElement.scrollHeight}px`;
    size = tick.offsetWidth || size;
  };

  const perches = [...document.querySelectorAll('[data-perch]')];
  const ruler = document.createElement('canvas').getContext('2d');
  const textNodes = (el) => {
    const out = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.data.trim()) out.push(node);
    return out;
  };
  // How far the tops of capital letters sit below the top of their text box.
  const capGap = (el) => {
    const style = getComputedStyle(el);
    ruler.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const m = ruler.measureText('H');
    return m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
  };

  // A spot is somewhere to stand: a fraction along the top edge of an element,
  // or along the tops of the letters in a piece of text.
  const where = (spot) => {
    let box;
    let lift = 0;
    if (spot.node) {
      const range = document.createRange();
      range.selectNodeContents(spot.node);
      box = range.getClientRects()[0];
      lift = spot.lift;
    } else {
      box = spot.el.getBoundingClientRect();
    }
    if (!box?.width) return null;
    return { x: box.left + spot.frac * box.width - origin.x, y: box.top + lift - origin.y };
  };

  const seen = (el) => (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true);
  // The part of the window Tick uses: clear of the nav, the edges and the very bottom.
  const inZone = (p, slack = 0) => p.y > view.top + 110 - slack && p.y < view.bottom - 70 + slack && p.x > view.left + 30 - slack && p.x < view.right - 30 + slack;

  /* State */

  let mode = 'hidden';
  let pos = { x: 0, y: 0 };
  let spot = null;
  let jump = null;
  let face = 1;
  let faceTarget = 1;
  let squash = 1;
  let spin = 0;
  let tilt = 0;
  let look = { x: 0, y: 0 };
  let blink = 0;
  let blinkIn = 2;
  let bell = 0;
  let ringing = 0;
  let dwell = 0;
  let idleIn = 1;
  let leaveIn = -1;
  let crouch = 0;
  let shuffle = null;
  let scrollDir = 0;
  let lastScroll = 0;
  let clock = 0;
  let zoneIn = 0;
  let pointer = { x: -1e4, y: -1e4, at: -10 };
  const recent = [];

  /* Choosing where to go */

  const candidates = () => {
    const out = [];
    for (const el of perches) {
      if (!seen(el)) continue;
      const option = { el, frac: 0.5 };
      if (el.dataset.perch === 'text') {
        const nodes = textNodes(el);
        if (!nodes.length) continue;
        option.node = nodes[Math.floor(Math.random() * nodes.length)];
        option.lift = capGap(option.node.parentElement);
      }
      const probe = where(option);
      if (!probe) continue;
      const span = option.node ? rangeWidth(option.node) : el.getBoundingClientRect().width;
      const inset = Math.min(0.42, (size * 0.6) / span);
      option.frac = rand(inset, 1 - inset);
      const p = where(option);
      if (p && inZone(p)) out.push({ spot: option, p });
    }
    return out;
  };
  const rangeWidth = (node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getClientRects()[0]?.width || 1;
  };

  // A weighted pick: a comfortable hop away, a little ahead of where the reader
  // is heading, and not somewhere Tick has just been.
  const choose = (away) => {
    const options = candidates()
      .map(({ spot: option, p }) => {
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d < 90) return null;
        let weight = 0.25 + Math.exp(-(((d - 340) / 380) ** 2));
        const depth = (p.y - view.top) / (view.bottom - view.top);
        if (scrollDir > 0.2) weight *= 0.5 + 1.5 * depth;
        if (scrollDir < -0.2) weight *= 0.5 + 1.5 * (1 - depth);
        if (away) weight *= ((p.x - pos.x) * away.x + (p.y - pos.y) * away.y) / d > 0.1 ? 2.5 : 0.15;
        if (recent.includes(option.el)) weight *= 0.08;
        return { option, weight };
      })
      .filter(Boolean);
    let pick = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
    for (const o of options) if ((pick -= o.weight) <= 0) return o.option;
    return null;
  };

  /* Moving */

  // One hop: an arc from here to the spot. Long hops include a full flip.
  const hopTo = (target) => {
    const to = where(target);
    if (!to) return;
    const distance = Math.hypot(to.x - pos.x, to.y - pos.y);
    jump = {
      from: { ...pos },
      spot: target,
      t: 0,
      time: clamp(0.34 + distance / 900, 0.42, 1.05),
      height: clamp(distance * 0.32, 46, 190),
      flip: distance > 300 ? Math.sign(to.x - pos.x) || 1 : 0,
    };
    if (Math.abs(to.x - pos.x) > 12) faceTarget = Math.sign(to.x - pos.x);
    recent.push(target.el);
    if (recent.length > 3) recent.shift();
    mode = 'jumping';
    squash = 1.14;
  };

  const leave = (away) => {
    const target = choose(away);
    if (target) {
      spot = target;
      hopTo(target);
      return true;
    }
    return false;
  };

  const takeOff = (away) => {
    if (mode !== 'sitting') return;
    mode = 'crouching';
    crouch = 0.13;
    shuffle = null;
    takeOff.away = away;
  };

  const land = () => {
    mode = 'sitting';
    jump = null;
    spin = 0;
    squash = 0.72;
    dwell = rand(3.2, 7);
    idleIn = rand(0.5, 1.2);
    leaveIn = -1;
    bell = 1;
  };

  // If the reader has scrolled far away, Tick comes back in from the nearest edge.
  const catchUp = () => {
    const tall = view.bottom - view.top;
    if (pos.y > view.top - tall * 0.6 && pos.y < view.bottom + tall * 0.6) return false;
    const above = pos.y < view.top;
    pos = { x: clamp(pos.x, view.left + 60, view.right - 60), y: above ? view.top - 60 : view.bottom + 60 };
    return true;
  };

  const sitting = (dt) => {
    const p = where(spot);
    if (!p) {
      if (!leave()) mode = 'lost';
      return;
    }
    pos = p;
    if (shuffle) {
      // A little side-step along the edge.
      shuffle.t += dt / 0.28;
      spot.frac = shuffle.from + (shuffle.to - shuffle.from) * smooth(shuffle.t);
      const q = where(spot);
      if (q) pos = { x: q.x, y: q.y - Math.sin(Math.PI * clamp(shuffle.t, 0, 1)) * 8 };
      if (shuffle.t >= 1) {
        shuffle = null;
        squash = 0.86;
      }
    }

    // Time to go: the perch has scrolled away, Tick has sat long enough, or it was poked.
    if (!inZone(p, 30)) {
      if (leaveIn < 0) leaveIn = rand(0.1, 0.35);
    } else leaveIn = -1;
    if (leaveIn >= 0 && (leaveIn -= dt) < 0) return takeOff();
    if ((dwell -= dt) < 0) return takeOff();

    // Small lives: glances, bell wiggles, side-steps.
    if ((idleIn -= dt) < 0 && !shuffle) {
      idleIn = rand(0.7, 2.4);
      const roll = Math.random();
      if (roll < 0.34) faceTarget = -faceTarget;
      else if (roll < 0.58) bell = 1;
      else if (roll < 0.82) {
        const width = spot.node ? rangeWidth(spot.node) : spot.el.getBoundingClientRect().width;
        const inset = Math.min(0.42, (size * 0.6) / width);
        const to = clamp(spot.frac + (faceTarget * rand(14, 30)) / width, inset, 1 - inset);
        if (Math.abs(to - spot.frac) * width > 6) {
          shuffle = { from: spot.frac, to, t: 0 };
          squash = 0.86;
        }
      }
    }
  };

  const jumping = (dt) => {
    let to = where(jump.spot);
    // The landing spot left the screen mid-air (the reader scrolled): pick another.
    if (!to || !inZone(to, 60)) {
      const next = choose();
      if (next) {
        spot = next;
        const flip = jump.flip;
        hopTo(next);
        jump.flip = flip && jump.flip;
        to = where(next);
      }
      if (!to) return;
    }
    jump.t = Math.min(1, jump.t + dt / jump.time);
    const t = jump.t;
    const glide = smooth(t);
    pos = {
      x: jump.from.x + (to.x - jump.from.x) * glide,
      y: jump.from.y + (to.y - jump.from.y) * glide - Math.sin(Math.PI * t) * jump.height,
    };
    spin = jump.flip * 360 * smooth((t - 0.08) / 0.84);
    tilt = approach(tilt, jump.flip ? 0 : (0.5 - t) * 22 * faceTarget, 12, dt);
    squash = approach(squash, t > 0.82 ? 0.94 : 1.12, 14, dt);
    if (t >= 1) land();
  };

  /* Drawing */

  const render = () => {
    tick.style.transform = `translate3d(${pos.x - size * FOOT_X}px, ${pos.y - size * FOOT_Y}px, 0)`;
    const turn = Math.sign(face || 1) * Math.max(0.25, Math.abs(face));
    art.style.transform = `rotate(${(spin + tilt).toFixed(2)}deg) scale(${(turn * (2 - squash) ** 0.5).toFixed(3)}, ${squash.toFixed(3)})`;
    // Feet tuck in while airborne.
    const tuck = mode === 'jumping' ? Math.sin(Math.PI * jump.t) : 0;
    parts.feet.setAttribute('transform', `translate(0 ${(-5 * tuck).toFixed(2)})`);
    const shake = Math.sin(clock * 62) * 9 * Math.max(bell, ringing > 0 ? 1 : 0);
    parts.bellL.setAttribute('transform', `rotate(${shake.toFixed(2)} 18 16)`);
    parts.bellR.setAttribute('transform', `rotate(${(-shake).toFixed(2)} 46 16)`);
    parts.eyes.setAttribute('transform', `translate(${(look.x * Math.sign(face || 1)).toFixed(2)} ${look.y.toFixed(2)})`);
    parts.lids.setAttribute('transform', blink > 0 ? 'translate(0 36) scale(1 0.12) translate(0 -36)' : '');
    parts.ring.style.opacity = ringing > 0 ? String(0.35 + 0.65 * Math.abs(Math.sin(clock * 18))) : '0';
  };

  let previous = 0;
  const frame = (now) => {
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 20) : 1 / 60;
    previous = now;
    clock += dt;
    measureView();
    const y = -origin.y;
    scrollDir = Math.abs(y - lastScroll) > 0.5 ? Math.sign(y - lastScroll) : approach(scrollDir, 0, 0.8, dt);
    lastScroll = y;

    if (mode === 'sitting') sitting(dt);
    else if (mode === 'crouching') {
      squash = approach(squash, 0.76, 30, dt);
      const p = where(spot);
      if (p) pos = p;
      if ((crouch -= dt) <= 0) {
        if (!leave(takeOff.away)) {
          mode = 'sitting';
          dwell = 1.2;
        }
        takeOff.away = undefined;
      }
    } else if (mode === 'jumping') jumping(dt);
    else if (mode === 'lost') {
      // Nothing to stand on in view: wait just off-screen until something appears.
      if (leave()) tick.hidden = false;
    }

    if (mode !== 'hidden' && mode !== 'lost' && catchUp() && !leave()) mode = 'lost';

    // Eyes follow the pointer when it is near, and otherwise look where Tick is going.
    const head = { x: pos.x, y: pos.y - size * 0.5 };
    const dx = pointer.x - head.x;
    const dy = pointer.y - head.y;
    const gap = Math.hypot(dx, dy) || 1;
    const watching = clock - pointer.at < 2.5 && gap < 260;
    look.x = approach(look.x, watching ? (dx / gap) * 2 * Math.sign(face || 1) : 1.1, 10, dt);
    look.y = approach(look.y, watching ? (dy / gap) * 1.6 : 0, 10, dt);

    face = approach(face, faceTarget, 26, dt);
    if (mode !== 'jumping') {
      squash = approach(squash, 1, 9, dt);
      tilt = approach(tilt, 0, 10, dt);
    }
    bell = Math.max(0, bell - dt / 0.35);
    ringing -= dt;
    if ((blinkIn -= dt) < 0) {
      blink = 0.1;
      blinkIn = rand(1.8, 4.6);
    }
    blink -= dt;

    // A lighter coat while over the dark sections.
    if ((zoneIn -= dt) < 0) {
      zoneIn = 0.25;
      const under = document.elementsFromPoint(clamp(pos.x + origin.x, 1, innerWidth - 1), clamp(pos.y + origin.y - size * 0.4, 1, innerHeight - 1));
      const dark = under.some((el) => el.matches?.('.never, .never *, .how.is-dark, .how.is-dark *, .foot-panel, .foot-panel *'));
      tick.dataset.zone = dark ? 'dark' : '';
    }

    render();
    requestAnimationFrame(frame);
  };

  /* The outside world */

  addEventListener('pointermove', (event) => (pointer = { x: event.clientX - origin.x, y: event.clientY - origin.y, at: clock }), { passive: true });
  // Poke Tick and it hops away from the pointer.
  addEventListener(
    'pointerdown',
    (event) => {
      const x = event.clientX - origin.x;
      const y = event.clientY - origin.y;
      const d = Math.hypot(x - pos.x, y - (pos.y - size * 0.5)) || 1;
      if (d < 70) takeOff({ x: (pos.x - x) / d, y: -0.4 });
    },
    { passive: true },
  );
  // The live demo just refreshed its tab: ring.
  addEventListener('dammer:refresh', () => {
    ringing = 0.9;
    if (mode === 'sitting') squash = 0.84;
  });

  new ResizeObserver(fitLayer).observe(document.body);
  addEventListener('load', fitLayer);
  fitLayer();

  // Tick drops in from above once the page has settled.
  setTimeout(() => {
    measureView();
    pos = { x: view.left + (view.right - view.left) * rand(0.55, 0.8), y: view.top - 70 };
    tick.hidden = false;
    mode = 'sitting';
    if (!leave()) mode = 'lost';
  }, 2200);
  requestAnimationFrame(frame);
})();
