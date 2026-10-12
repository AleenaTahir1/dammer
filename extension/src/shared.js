// Shared by the service worker and the popup. No state lives here.

// Only ordinary web pages can be refreshed; browser and extension pages are left alone.
export const WEB_MATCH = ['http://*/*', 'https://*/*'];

// Chrome will not fire a packed extension's alarm more often than this.
export const MIN_SEC = 30;
export const MAX_SEC = 3600;

export const PRESETS = [
  { id: '2-3', minSec: 120, maxSec: 180, label: '2–3' },
  { id: '3-5', minSec: 180, maxSec: 300, label: '3–5' },
  { id: '5-8', minSec: 300, maxSec: 480, label: '5–8' },
  { id: '8-12', minSec: 480, maxSec: 720, label: '8–12' },
];

// Values the custom steppers move through, in seconds.
export const STEPS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1800, 2700, 3600];

// Auto-stop choices, in minutes. 0 means run until stopped by hand.
export const AUTO_STOP = [60, 120, 240, 480, 0];

// What to do when a refresh is due while the user is looking at the tab.
export const ON_TAB = ['refresh', 'pause', 'stop'];

// Stop once the computer has gone unused for this many minutes. 0 keeps going.
export const AWAY = [0, 5, 15, 30];

export const THEMES = ['auto', 'light', 'dark', 'glass'];
export const TIMERS = ['digital', 'analog'];
export const ACCENTS = ['moss', 'pine', 'clay', 'ochre', 'slate'];

export const DEFAULTS = Object.freeze({
  mode: '3-5',
  customMinSec: 180,
  customMaxSec: 300,
  autoStopMin: 120,
  onTab: 'pause',
  awayMin: 0,
  keepAwake: true,
  hardRefresh: false,
  badge: true,
  theme: 'auto',
  timer: 'digital',
  accent: 'moss',
});

// One tap in settings applies these: slower refreshes, a shorter auto-stop, and
// a timer that only runs while someone is at the computer.
export const CAREFUL = Object.freeze({ mode: '8-12', autoStopMin: 60, onTab: 'pause', awayMin: 5 });

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function normalize(raw = {}) {
  const s = { ...DEFAULTS, ...raw };
  // The custom range is kept on its own so trying a preset never loses it.
  s.customMinSec = clamp(Math.round(Number(s.customMinSec) || DEFAULTS.customMinSec), MIN_SEC, MAX_SEC);
  s.customMaxSec = clamp(Math.round(Number(s.customMaxSec) || s.customMinSec), s.customMinSec, MAX_SEC);
  const preset = PRESETS.find((p) => p.id === s.mode);
  if (!preset) s.mode = 'custom';
  // The range in force, derived from the mode.
  s.minSec = preset ? preset.minSec : s.customMinSec;
  s.maxSec = preset ? preset.maxSec : s.customMaxSec;
  s.autoStopMin = AUTO_STOP.includes(s.autoStopMin) ? s.autoStopMin : DEFAULTS.autoStopMin;
  // Before 1.1 this was an on/off switch called skipWhenActive.
  if (raw.onTab === undefined && raw.skipWhenActive === false) s.onTab = 'refresh';
  delete s.skipWhenActive;
  s.onTab = ON_TAB.includes(s.onTab) ? s.onTab : DEFAULTS.onTab;
  s.awayMin = AWAY.includes(s.awayMin) ? s.awayMin : DEFAULTS.awayMin;
  s.keepAwake = Boolean(s.keepAwake);
  s.hardRefresh = Boolean(s.hardRefresh);
  s.badge = Boolean(s.badge);
  s.theme = THEMES.includes(s.theme) ? s.theme : DEFAULTS.theme;
  s.timer = TIMERS.includes(s.timer) ? s.timer : DEFAULTS.timer;
  s.accent = ACCENTS.includes(s.accent) ? s.accent : DEFAULTS.accent;
  return s;
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return normalize(settings);
}

// A fresh delay for every cycle, so reloads never land on a fixed period.
export function randomDelay({ minSec, maxSec }) {
  return Math.round(minSec + Math.random() * (maxSec - minSec)) * 1000;
}

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isWeb(url) {
  const protocol = parse(url)?.protocol;
  return protocol === 'http:' || protocol === 'https:';
}

// The address without its query string or fragment. Only this form is ever
// stored, so tokens and search terms in a url never reach disk.
export function pageOf(url) {
  const parsed = parse(url);
  return parsed ? parsed.origin + parsed.pathname : '';
}

// "www.example.com" → "example.com", for showing to the user.
export function hostOf(url) {
  return parse(url)?.hostname.replace(/^www\./, '') ?? '';
}

// Two pages count as the same site when their last two host labels match, so
// app.example.com and www.example.com are one site. Deliberately loose: the
// only cost of a false match is that the timer keeps running on the picked tab.
export function sameSite(a, b) {
  const site = (url) => (isWeb(url) ? parse(url).hostname.split('.').slice(-2).join('.') : null);
  return site(a) !== null && site(a) === site(b);
}

export function isLoginPage(url) {
  return /^\/(log-?in|sign-?in|signin|sso)(\/|$)/i.test(parse(url)?.pathname ?? '');
}

// The tab the user picked is remembered so they choose it once. Tab ids do not
// survive a browser restart, so the url is kept as a second way to find it.
export async function rememberTarget(tab) {
  await chrome.storage.local.set({ target: { tabId: tab.id, url: pageOf(tab.url) } });
}

// Finds the remembered tab: the same tab if it is still on that site, else a
// tab at the same address, else any tab on that site. `missing` is set when a
// tab was remembered but nothing like it is open. With nothing remembered yet,
// the tab in front is offered.
export async function resolveTarget() {
  const [{ target }, tabs] = await Promise.all([chrome.storage.local.get('target'), chrome.tabs.query({ url: WEB_MATCH })]);
  if (target) {
    const tab =
      tabs.find((t) => t.id === target.tabId && sameSite(t.url, target.url)) ??
      tabs.find((t) => pageOf(t.url) === target.url) ??
      tabs.find((t) => sameSite(t.url, target.url)) ??
      null;
    return { tab, tabs, missing: tab ? null : target };
  }
  const [front] = await chrome.tabs.query({ active: true, lastFocusedWindow: true, url: WEB_MATCH });
  return { tab: front ?? null, tabs, missing: null };
}
