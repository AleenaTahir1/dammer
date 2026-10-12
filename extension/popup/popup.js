import {
  ACCENTS,
  AUTO_STOP,
  AWAY,
  CAREFUL,
  DEFAULTS,
  ON_TAB,
  PRESETS,
  STEPS,
  THEMES,
  TIMERS,
  getSettings,
  hostOf,
  isWeb,
  normalize,
  rememberTarget,
  resolveTarget,
} from '../src/shared.js';

const $ = (id) => document.getElementById(id);

const els = {
  readouts: document.querySelectorAll('[data-readout]'),
  units: document.querySelectorAll('[data-unit]'),
  timerBox: document.querySelector('.timer'),
  digits: document.querySelector('.digits'),
  bar: $('bar'),
  clock: $('clock'),
  sweep: $('sweep'),
  status: $('status'),
  tabSelect: $('tabSelect'),
  tabButton: $('tabButton'),
  tabName: $('tabName'),
  tabMenu: $('tabMenu'),
  toggle: $('toggle'),
  now: $('now'),
  presets: $('presets'),
  custom: $('custom'),
  minValue: $('minValue'),
  maxValue: $('maxValue'),
  meta: $('meta'),
  frame: document.querySelector('.frame'),
  app: $('app'),
  settings: $('settings'),
  about: $('about'),
  theme: $('theme'),
  timer: $('timer'),
  accent: $('accent'),
  autoStop: $('autoStop'),
  onTab: $('onTab'),
  away: $('away'),
  careful: $('careful'),
};

const SWITCHES = ['keepAwake', 'hardRefresh', 'badge'];

const STOP_NOTES = {
  closed: 'Stopped: tab closed',
  left: 'Stopped: tab left the site',
  'signed-out': 'Stopped: login page',
  timer: 'Auto-stop reached',
  away: 'Stopped: you were away',
  opened: 'Stopped: you opened the tab',
};

const HOLD_NOTES = {
  active: 'Paused while you’re on the tab',
  loading: 'Tab was loading',
  offline: 'Offline',
  failed: 'Reload failed',
};

const CHECK = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const state = { settings: normalize(), run: null, lastStop: null, tabs: [], target: null, missing: null, error: null };
let ticker = null;
let shownProgress = 0;
let busy = false;

init();

async function init() {
  const [settings, session] = await Promise.all([getSettings(), chrome.storage.session.get(['run', 'lastStop'])]);
  state.settings = settings;
  state.run = session.run ?? null;
  state.lastStop = session.lastStop ?? null;
  await findTabs();

  buildControls();
  bind();
  render();

  chrome.storage.onChanged.addListener(onStorageChanged);
  systemDark.addEventListener('change', applyLook);
  $('version').textContent = chrome.runtime.getManifest().version;
  chrome.commands.getAll().then((commands) => {
    $('shortcut').textContent = commands.find((c) => c.name === 'toggle')?.shortcut || 'Not set';
  });

  // Transitions switch on one frame late so nothing animates into place on open.
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('ready')));
}

// While running, the target is the tab being refreshed; otherwise it is the
// tab the user picked last time. `missing` holds a remembered tab that is no
// longer open, so it can be offered again.
async function findTabs() {
  const { tab, tabs, missing } = await resolveTarget();
  state.tabs = tabs;
  state.target = tabs.find((t) => t.id === state.run?.tabId) ?? tab;
  state.missing = state.target ? null : missing;
}

async function onStorageChanged(changes, area) {
  if (area === 'session') {
    if (changes.run) state.run = changes.run.newValue ?? null;
    if (changes.lastStop) state.lastStop = changes.lastStop.newValue ?? null;
    if (changes.run) state.error = null;
    // Started, stopped, or moved to another tab.
    if (changes.run && changes.run.newValue?.tabId !== changes.run.oldValue?.tabId) await findTabs();
  }
  if (area === 'local' && changes.settings) state.settings = normalize(changes.settings.newValue);
  render();
}

async function send(message) {
  const reply = await chrome.runtime.sendMessage(message).catch((error) => ({ ok: false, error: String(error) }));
  return reply ?? { ok: false, error: 'no-reply' };
}

// Saves, then tells the worker which groups a running timer has to pick up.
// Everything else is either visual or read fresh on each refresh.
async function saveSettings(patch) {
  const before = state.settings;
  const after = normalize({ ...before, ...patch });
  state.settings = after;
  render();
  await chrome.storage.local.set({ settings: after });
  const changed = [];
  if (before.minSec !== after.minSec || before.maxSec !== after.maxSec) changed.push('interval');
  if (before.autoStopMin !== after.autoStopMin) changed.push('autoStop');
  if (before.keepAwake !== after.keepAwake) changed.push('keepAwake');
  if (before.badge !== after.badge) changed.push('badge');
  if (state.run && changed.length) await send({ type: 'apply', changed });
}

async function startOn(tab) {
  state.error = null;
  const reply = await send({ type: 'start', tabId: tab.id });
  if (reply.ok) return;
  state.error = 'Couldn’t start on that tab';
  await findTabs();
  render();
}

async function pickTab(tab) {
  openMenu(false);
  state.error = null;
  // Picking another tab while running moves the timer over to it; the worker
  // remembers the tab once that has worked.
  if (state.run) {
    if (state.run.tabId !== tab.id) await startOn(tab);
    return;
  }
  state.target = tab;
  state.missing = null;
  await rememberTarget(tab);
  render();
}

/* Events */

function bind() {
  els.toggle.addEventListener('click', async () => {
    // A second click before the first has landed would undo it.
    if (busy) return;
    busy = true;
    if (state.run) await send({ type: 'stop' });
    else if (state.target) await startOn(state.target);
    busy = false;
  });

  els.now.addEventListener('click', () => {
    els.now.classList.remove('spin');
    void els.now.offsetWidth;
    els.now.classList.add('spin');
    send({ type: 'refresh-now' });
  });

  els.tabButton.addEventListener('click', () => openMenu(els.tabMenu.hidden));

  els.tabMenu.addEventListener('click', (event) => {
    const option = event.target.closest('.option');
    if (!option) return;
    if (option.dataset.reopen && isWeb(state.missing?.url)) {
      chrome.tabs.create({ url: state.missing.url });
      return;
    }
    const tab = state.tabs.find((t) => String(t.id) === option.dataset.id);
    if (tab) pickTab(tab);
  });

  document.addEventListener('click', (event) => {
    if (!els.tabSelect.contains(event.target)) openMenu(false);
  });

  onPick(els.presets, (mode) => saveSettings({ mode }));
  onPick(els.autoStop, (value) => saveSettings({ autoStopMin: Number(value) }));
  onPick(els.onTab, (onTab) => saveSettings({ onTab }));
  onPick(els.away, (value) => saveSettings({ awayMin: Number(value) }));
  els.careful.addEventListener('click', () => saveSettings({ ...CAREFUL }));
  onPick(els.theme, (theme) => saveSettings({ theme }));
  onPick(els.timer, (timer) => saveSettings({ timer }));
  onPick(els.accent, (accent) => saveSettings({ accent }));

  els.custom.addEventListener('click', (event) => {
    const step = event.target.closest('.step');
    if (!step) return;
    const field = step.closest('.stepper').dataset.field;
    const { customMinSec, customMaxSec } = state.settings;
    const next = stepValue(state.settings[field], Number(step.dataset.dir));
    const patch = { mode: 'custom', customMinSec, customMaxSec, [field]: next };
    // The two ends push each other so the range can never invert.
    if (field === 'customMinSec') patch.customMaxSec = Math.max(customMaxSec, next);
    else patch.customMinSec = Math.min(customMinSec, next);
    saveSettings(patch);
  });

  for (const key of SWITCHES) {
    $(key).addEventListener('change', (event) => saveSettings({ [key]: event.target.checked }));
  }

  $('reset').addEventListener('click', () => saveSettings({ ...DEFAULTS }));
  $('openSettings').addEventListener('click', () => showView('settings'));
  $('closeSettings').addEventListener('click', () => showView('main'));
  $('openAbout').addEventListener('click', () => showView('about'));
  $('closeAbout').addEventListener('click', () => showView('settings'));
}

function onPick(group, handler) {
  group.addEventListener('click', (event) => {
    const option = event.target.closest('[role="radio"]');
    if (option && option.getAttribute('aria-checked') !== 'true') handler(option.dataset.value);
  });
  // Arrow keys move through a group the way they do for native radio buttons.
  group.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const options = [...group.children];
    const next = options[options.indexOf(document.activeElement) + step];
    if (!step || !next) return;
    event.preventDefault();
    next.focus();
    next.click();
  });
}

// Three views share the popup: the main one, and the settings and about
// sheets that slide over it.
function showView(view) {
  openMenu(false);
  const from = document.body.dataset.view;
  document.body.dataset.view = view;
  els.app.inert = view !== 'main';
  els.settings.inert = view !== 'settings';
  els.about.inert = view !== 'about';
  // A sheet can be taller than the main view, so the popup grows to fit it.
  const sheet = { settings: els.settings, about: els.about }[view];
  const body = sheet?.querySelector('.sheet-body');
  els.frame.style.minHeight = sheet ? `${Math.min(600, sheet.offsetHeight - body.clientHeight + body.scrollHeight)}px` : '';
  ({ main: $('openSettings'), settings: from === 'about' ? $('openAbout') : $('closeSettings'), about: $('closeAbout') })[view].focus();
}

async function openMenu(open) {
  if (!open && els.tabMenu.hidden) return;
  if (open) {
    // Tabs may have opened or closed since the popup was drawn.
    await findTabs();
    const items = state.tabs.map(tabOption);
    if (state.missing) items.unshift(reopenOption(state.missing));
    if (!items.length) items.push(emptyNote());
    els.tabMenu.replaceChildren(...items);
    render();
  }
  els.tabMenu.hidden = !open;
  els.tabButton.setAttribute('aria-expanded', String(open));
  // The list can be longer than the space under the field, so the popup
  // grows to fit it while it is open.
  const top = els.tabButton.getBoundingClientRect().bottom - els.frame.getBoundingClientRect().top + 6;
  els.frame.style.minHeight = open ? `${Math.min(600, top + els.tabMenu.offsetHeight + 12)}px` : '';
}

function tabOption(tab) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'option';
  button.dataset.id = tab.id;
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(tab.id === state.target?.id));
  // Titles and addresses come from web pages, so they only ever go in as text.
  button.innerHTML = `<span class="option-text"><span class="option-title"></span><span class="option-path"></span></span>${CHECK}`;
  button.querySelector('.option-title').textContent = tab.title || hostOf(tab.url);
  button.querySelector('.option-path').textContent = hostOf(tab.url);
  return button;
}

function reopenOption(target) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'option option-action';
  button.dataset.reopen = 'true';
  button.setAttribute('role', 'option');
  button.textContent = `Open ${hostOf(target.url)}`;
  return button;
}

function emptyNote() {
  const note = document.createElement('p');
  note.className = 'menu-empty';
  note.textContent = 'No web pages are open';
  return note;
}

function stepValue(current, dir) {
  const index = STEPS.reduce((best, step, i) => (Math.abs(step - current) < Math.abs(STEPS[best] - current) ? i : best), 0);
  return STEPS[Math.min(STEPS.length - 1, Math.max(0, index + dir))];
}

/* Rendering */

function buildControls() {
  const title = (word) => word[0].toUpperCase() + word.slice(1);
  els.presets.replaceChildren(...PRESETS.map((p) => option('chip', p.id, p.label)), option('chip', 'custom', 'Custom'));
  els.autoStop.replaceChildren(...AUTO_STOP.map((min) => option('chip', min, min ? `${min / 60}h` : 'Off')));
  els.onTab.replaceChildren(...ON_TAB.map((choice) => option('chip', choice, title(choice))));
  els.away.replaceChildren(...AWAY.map((min) => option('chip', min, min ? `${min}m` : 'Off')));
  els.theme.replaceChildren(...THEMES.map((theme) => option('chip', theme, title(theme))));
  els.timer.replaceChildren(...TIMERS.map((timer) => option('chip', timer, title(timer))));
  els.accent.replaceChildren(
    ...ACCENTS.map((accent) => {
      const swatch = option('swatch', accent, '');
      swatch.title = title(accent);
      swatch.setAttribute('aria-label', title(accent));
      return swatch;
    }),
  );
}

function option(className, value, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.value = value;
  button.setAttribute('role', 'radio');
  button.textContent = label;
  return button;
}

function render() {
  const { settings, run } = state;
  const running = Boolean(run);
  document.body.dataset.state = running ? 'running' : 'idle';
  document.body.dataset.timer = settings.timer;
  applyLook();

  select(els.presets, settings.mode);
  select(els.autoStop, settings.autoStopMin);
  select(els.onTab, settings.onTab);
  select(els.away, settings.awayMin);
  const careful = Object.entries(CAREFUL).every(([key, value]) => settings[key] === value);
  els.careful.disabled = careful;
  els.careful.textContent = careful ? 'On' : 'Apply';
  select(els.theme, settings.theme);
  select(els.timer, settings.timer);
  select(els.accent, settings.accent);
  for (const key of SWITCHES) $(key).checked = settings[key];

  els.custom.hidden = settings.mode !== 'custom';
  els.minValue.textContent = span(settings.customMinSec);
  els.maxValue.textContent = span(settings.customMaxSec);
  for (const step of els.custom.querySelectorAll('.step')) {
    const value = settings[step.closest('.stepper').dataset.field];
    step.disabled = step.dataset.dir === '-1' ? value <= STEPS[0] : value >= STEPS.at(-1);
  }

  renderTab();

  els.toggle.textContent = running ? 'Stop' : 'Start';
  els.toggle.disabled = !running && !state.target;
  els.now.disabled = !running;

  if (running) {
    ticker ??= setInterval(tick, 250);
    tick();
  } else {
    clearInterval(ticker);
    ticker = null;
    renderIdle();
  }
}

function applyLook() {
  const { theme, accent } = state.settings;
  const root = document.documentElement;
  root.dataset.theme = theme === 'auto' ? (systemDark.matches ? 'dark' : 'light') : theme;
  root.dataset.accent = accent;
  // theme.js reads this copy before first paint on the next open.
  try {
    localStorage.setItem('dammer:look', JSON.stringify({ theme, accent }));
  } catch {}
}

// Marks the chosen option and slides the highlight under it.
function select(group, value) {
  for (const el of group.children) {
    const chosen = el.dataset.value === String(value);
    el.setAttribute('aria-checked', String(chosen));
    if (chosen) {
      group.style.setProperty('--x', `${el.offsetLeft}px`);
      group.style.setProperty('--w', `${el.offsetWidth}px`);
    }
  }
}

function renderTab() {
  const { target, missing } = state;
  els.tabSelect.toggleAttribute('data-empty', !target);
  els.tabName.textContent = target ? target.title || hostOf(target.url) : missing ? `${hostOf(missing.url)} isn’t open` : 'Choose a tab';
}

function renderIdle() {
  const range = rangeParts(state.settings);
  const note = state.error ?? STOP_NOTES[state.lastStop?.reason];
  delete document.body.dataset.hold;
  document.body.toggleAttribute('data-note', Boolean(note));
  setReadout(range.value, range.unit);
  setProgress(0);
  setText(els.status, note ?? (state.target ? 'Ready' : 'Choose a tab to start'));
  setText(els.meta, '');
}

// Only runs while the popup is open, so the live countdown costs nothing
// once it closes.
function tick() {
  const { run } = state;
  if (!run) return;
  const now = Date.now();
  const remaining = run.nextAt - now;
  const total = Math.max(1, run.nextAt - run.cycleStart);
  const hold = HOLD_NOTES[run.skipped];

  document.body.toggleAttribute('data-hold', Boolean(hold));
  document.body.toggleAttribute('data-note', Boolean(state.error));
  setReadout(clock(Math.max(0, remaining)), '');
  setProgress(1 - remaining / total);
  setText(els.status, state.error ?? hold ?? (remaining > 0 ? 'Next refresh' : 'Refreshing'));

  const parts = [run.count === 1 ? '1 refresh' : `${run.count} refreshes`];
  if (run.lastAt) parts.push(`last ${ago(now - run.lastAt)}`);
  if (run.stopAt) parts.push(`stops in ${duration(Math.max(0, run.stopAt - now))}`);
  setText(els.meta, parts.join('  ·  '));
}

// Screen readers announce a live region whenever it is written to, so text is
// only touched when it really changes.
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function setReadout(value, unit) {
  for (const el of els.readouts) setText(el, value);
  for (const el of els.units) setText(el, unit);
  // Ranges such as 0:45–60:00 need a smaller size to fit.
  els.digits.toggleAttribute('data-long', value.length > 7);
}

// Drives both timer styles: the digital bar, and the analog hand and slice.
function setProgress(fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  // A new cycle starts from zero: jump there instead of sweeping backwards.
  const snap = f < shownProgress;
  shownProgress = f;
  if (snap) els.timerBox.classList.add('snap');
  els.bar.style.transform = `scaleX(${f})`;
  els.sweep.style.strokeDashoffset = String(1000 * (1 - f));
  els.clock.style.setProperty('--turn', `${f * 360}deg`);
  if (snap) {
    // Reading a layout value commits the jump before transitions come back.
    void els.timerBox.offsetWidth;
    els.timerBox.classList.remove('snap');
  }
}

/* Formatting */

function clock(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  if (minutes < 60) return `${minutes}:${seconds}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${seconds}`;
}

function duration(ms) {
  const total = Math.floor(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)}h ${rest}m` : `${minutes / 60}h`;
}

function ago(ms) {
  return ms < 5000 ? 'just now' : `${duration(ms)} ago`;
}

function span(sec) {
  if (sec < 60) return `${sec} sec`;
  if (sec % 60 === 0) return `${sec / 60} min`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function rangeParts({ minSec, maxSec }) {
  if (minSec % 60 === 0 && maxSec % 60 === 0) {
    const a = minSec / 60;
    const b = maxSec / 60;
    return { value: a === b ? String(a) : `${a}–${b}`, unit: 'min' };
  }
  const short = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return { value: minSec === maxSec ? short(minSec) : `${short(minSec)}–${short(maxSec)}`, unit: '' };
}
