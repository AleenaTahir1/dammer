// End-to-end test: drives the real extension in real Chrome and, along the
// way, retakes the screenshots used in the README and on the website.
//
//   node tests/e2e/run.mjs
//
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, launch, sleep, startFakeSites } from './lib.mjs';

const SHOTS = join(ROOT, 'docs/screenshots');
const INBOX = 'https://mail.example.com/inbox';
const results = [];
const check = (name, pass, detail) => results.push({ pass: Boolean(pass), name, detail });
const secs = (t) => t.split(':').reduce((a, n) => a * 60 + Number(n), 0);

// Helpers available inside every snippet run in the popup page.
const H = `
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const getRun = async () => (await chrome.storage.session.get('run')).run;
const lastStop = async () => (await chrome.storage.session.get('lastStop')).lastStop?.reason;
const angle = () => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.clock-hand')).transform); return (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360; };
const barScale = () => new DOMMatrix(getComputedStyle($('bar')).transform).a;
const sweep = () => parseFloat(getComputedStyle($('sweep')).strokeDashoffset);
const digital = () => document.querySelector('.digits [data-readout]').textContent;
const analog = () => document.querySelector('.analog-read [data-readout]').textContent;
const secs = (t) => t.split(':').reduce((a, n) => a * 60 + Number(n), 0);
const shown = (sel) => getComputedStyle(document.querySelector(sel)).display !== 'none';
const frameH = () => document.querySelector('.frame').getBoundingClientRect().height;
const options = () => [...document.querySelectorAll('#tabMenu .option')];
const pick = async (title) => { if ($('tabMenu').hidden) { $('tabButton').click(); await wait(500); } options().find((o) => o.textContent.includes(title)).click(); await wait(900); };
const fire = async (name = 'refresh', ms = 1900) => { await chrome.alarms.create(name, { when: Date.now() + 300 }); await wait(ms); };
// Puts the running cycle at a chosen point so the display can be checked there.
const setFraction = async (f, total = 240000) => { const run = await getRun(); const now = Date.now(); run.cycleStart = now - total * f; run.nextAt = now + total * (1 - f); await chrome.storage.session.set({ run }); };
`;

const sites = await startFakeSites();
let browser;
try {
  browser = await launch();
  const background = (url) => browser.send('Target.createTarget', { url, background: true });
  await background(INBOX);
  await sleep(1000);
  const popup = await browser.open(`chrome-extension://${browser.id}/popup/popup.html`);
  await popup.call('Page.enable');
  await popup.call('Emulation.setDeviceMetricsOverride', { width: 360, height: 600, deviceScaleFactor: 2, mobile: false });
  const P = (body) => popup.evaluate(H + body);
  const loads = (part) => sites.hits.filter((u) => u.includes(part)).length;
  const shot = async (name, scheme) => {
    await popup.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await sleep(700);
    const height = await P(`document.activeElement?.blur(); return frameH();`);
    const { data } = await popup.call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 360, height, scale: 1 } });
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64'));
  };
  await sleep(1200);

  /* 1. First run: nothing chosen yet */
  const first = await P(`return { status: $('status').textContent, tab: $('tabName').textContent, disabled: $('toggle').disabled, bodyW: document.body.getBoundingClientRect().width, frameW: document.querySelector('.frame').getBoundingClientRect().width, docW: document.documentElement.scrollWidth, frameH: frameH() };`);
  check('first run asks for a tab and keeps Start disabled', first.status === 'Choose a tab to start' && first.tab === 'Choose a tab' && first.disabled, first);
  check('popup is exactly 360px wide with nothing overflowing', first.bodyW === 360 && first.frameW === 360 && first.docW === 360, first);
  check('popup height is inside Chrome’s 600px limit', first.frameH <= 600, first.frameH);
  const chosen = await P(`$('tabButton').click(); await wait(500); const list = options().map((o) => [o.querySelector('.option-title').textContent, o.querySelector('.option-path').textContent]); await pick('Example Mail'); return { list, digital: digital(), unit: document.querySelector('.digits [data-unit]').textContent, status: $('status').textContent, tab: $('tabName').textContent, disabled: $('toggle').disabled, target: (await chrome.storage.local.get('target')).target };`);
  check('the tab menu lists the open web page with its site', chosen.list.length === 1 && chosen.list[0][0] === 'Inbox · Example Mail' && chosen.list[0][1] === 'mail.example.com', chosen.list);
  check('choosing a tab makes the timer ready and remembers the choice', chosen.digital === '3–5' && chosen.unit === 'min' && chosen.status === 'Ready' && chosen.tab === 'Inbox · Example Mail' && !chosen.disabled && chosen.target?.url === INBOX, chosen);
  await shot('digital-light-idle', 'light');

  /* 2. Start */
  const started = await P(`$('toggle').click(); await wait(600); const run = await getRun(); const tab = await chrome.tabs.get(run.tabId); return { run, alarms: (await chrome.alarms.getAll()).map((a) => a.name).sort(), badge: await chrome.action.getBadgeText({}), discardable: tab.autoDiscardable, url: tab.url, text: $('toggle').textContent, state: document.body.dataset.state };`);
  const delay = (started.run.nextAt - started.run.cycleStart) / 1000;
  check('Start creates a run on the chosen tab', started.url === INBOX && started.state === 'running' && started.text === 'Stop', { url: started.url, state: started.state });
  check('first delay is inside the 3–5 minute range', delay >= 180 && delay <= 300, `${delay}s`);
  check('refresh and auto-stop alarms are set', started.alarms.join() === 'auto-stop,refresh', started.alarms);
  check('toolbar badge shows ON', started.badge === 'ON', started.badge);
  check('tab is protected from Memory Saver', started.discardable === false, started.discardable);

  /* 3. Digital clock */
  const d = await P(`const run = await getRun(); const a = { text: digital(), expect: Math.ceil((run.nextAt - Date.now()) / 1000) }; await wait(3000); const b = { text: digital(), expect: Math.ceil((run.nextAt - Date.now()) / 1000) }; return { a, b, digitalShown: shown('.digital'), analogShown: shown('.analog') };`);
  check('digital readout matches the real time left', Math.abs(secs(d.a.text) - d.a.expect) <= 1 && Math.abs(secs(d.b.text) - d.b.expect) <= 1, d);
  check('digital readout counts down one second per second', [2, 3, 4].includes(secs(d.a.text) - secs(d.b.text)), `${d.a.text} → ${d.b.text} over 3s`);
  check('only the digital timer is visible in digital mode', d.digitalShown && !d.analogShown, d);
  const points = [0.1, 0.25, 0.5, 0.75, 0.95];
  const bars = [];
  for (const f of points) bars.push(await P(`await setFraction(${f}); await wait(900); const run = await getRun(); return { f: ${f}, bar: barScale(), text: digital(), expect: Math.ceil((run.nextAt - Date.now()) / 1000) };`));
  check('digital progress bar tracks elapsed time at 10/25/50/75/95%', bars.every((b) => Math.abs(b.bar - b.f) < 0.02 && Math.abs(secs(b.text) - b.expect) <= 1), bars.map((b) => `${b.f}→${b.bar.toFixed(3)} (${b.text})`).join(', '));
  const barWrap = await P(`await setFraction(0.95); await wait(900); await setFraction(0.02); await wait(120); return barScale();`);
  check('digital bar snaps back to empty when a new cycle starts', barWrap < 0.05, barWrap);
  await P(`await setFraction(0.62); await wait(600);`);
  await shot('digital-dark-running', 'dark');
  await shot('digital-light-running', 'light');

  /* 4. Analog clock */
  const mode = await P(`$('openSettings').click(); await wait(400); document.querySelector('#timer [data-value=analog]').click(); await wait(300); $('closeSettings').click(); await wait(500); return { timer: document.body.dataset.timer, digitalShown: shown('.digital'), analogShown: shown('.analog'), saved: (await chrome.storage.local.get('settings')).settings.timer };`);
  check('switching to Analog shows the clock and saves the choice', mode.timer === 'analog' && mode.analogShown && !mode.digitalShown && mode.saved === 'analog', mode);
  const hands = [];
  for (const f of points) hands.push(await P(`await setFraction(${f}); await wait(900); const run = await getRun(); return { f: ${f}, angle: angle(), sweep: sweep(), text: analog(), expect: Math.ceil((run.nextAt - Date.now()) / 1000) };`));
  check('analog hand points at elapsed time at 10/25/50/75/95%', hands.every((h) => Math.abs(h.angle - h.f * 360) < 4), hands.map((h) => `${h.f}→${h.angle.toFixed(1)}° (want ${h.f * 360}°)`).join(', '));
  check('analog slice fills in step with the hand', hands.every((h) => Math.abs(h.sweep - 1000 * (1 - h.f)) < 12), hands.map((h) => `${h.f}→${h.sweep.toFixed(0)}`).join(', '));
  check('analog time readout matches the real time left', hands.every((h) => Math.abs(secs(h.text) - h.expect) <= 1), hands.map((h) => `${h.text}/${h.expect}`).join(', '));
  const live = await P(`await setFraction(0.5, 60000); await wait(800); const a = angle(); await wait(3000); return { a, b: angle() };`);
  check('analog hand advances in real time (18° in 3s on a 60s cycle)', Math.abs(live.b - live.a - 18) < 4, `${live.a.toFixed(1)}° → ${live.b.toFixed(1)}°`);
  const wrap = await P(`await setFraction(0.95); await wait(900); const before = angle(); await setFraction(0.02); await wait(120); return { before, after: angle(), sweep: sweep() };`);
  check('analog hand and slice snap back to the top when a new cycle starts', wrap.before > 330 && wrap.after < 20 && wrap.sweep > 950, wrap);
  await P(`await setFraction(0.62); await wait(600);`);
  await shot('analog-light-running', 'light');
  await shot('analog-dark-running', 'dark');

  /* 5. Choices survive closing and reopening the popup */
  await popup.call('Page.reload');
  await sleep(1500);
  const reopened = await P(`return { timer: document.body.dataset.timer, state: document.body.dataset.state, tab: $('tabName').textContent, analogShown: shown('.analog') };`);
  check('reopening the popup keeps Analog, the running state and the tab', reopened.timer === 'analog' && reopened.state === 'running' && reopened.tab === 'Inbox · Example Mail' && reopened.analogShown, reopened);

  /* 6. Refresh now and alarm-driven refresh */
  let before = loads('/inbox');
  const now1 = await P(`$('now').click(); await wait(1500); const run = await getRun(); return { count: run.count, meta: $('meta').textContent, left: (run.nextAt - Date.now()) / 1000 };`);
  check('Refresh now reloads the tab once and restarts the cycle', loads('/inbox') - before === 1 && now1.count === 1 && now1.left > 175 && now1.meta.startsWith('1 refresh'), { ...now1, reloads: loads('/inbox') - before });
  before = loads('/inbox');
  const alarm = await P(`await fire(); const run = await getRun(); const next = await chrome.alarms.get('refresh'); return { count: run.count, skipped: run.skipped, nextIn: (next.scheduledTime - Date.now()) / 1000, matches: next.scheduledTime === run.nextAt, discardable: (await chrome.tabs.get(run.tabId)).autoDiscardable };`);
  check('an alarm reloads the background tab and schedules the next one in range', loads('/inbox') - before === 1 && alarm.count === 2 && alarm.nextIn > 175 && alarm.nextIn <= 300 && alarm.matches, { ...alarm, reloads: loads('/inbox') - before });
  check('tab stays protected after a reload', alarm.discardable === false, alarm.discardable);

  /* 7. Worker killed between events */
  try {
    await popup.call('ServiceWorker.enable');
    await popup.call('ServiceWorker.stopAllWorkers');
    await sleep(800);
    before = loads('/inbox');
    const woke = await P(`await fire('refresh', 2500); return (await getRun()).count;`);
    check('after the service worker is killed, the next alarm wakes it and still refreshes', woke === 3 && loads('/inbox') - before === 1, { count: woke, reloads: loads('/inbox') - before });
  } catch (error) {
    check('service worker kill-and-wake', false, `could not stop the worker: ${error.message}`);
  }

  /* 8. Hold while the user is on the tab */
  const hold = await P(`const run = await getRun(); const me = (await chrome.tabs.getCurrent()).id; await chrome.tabs.update(run.tabId, { active: true }); await wait(400); const win = await chrome.windows.get((await chrome.tabs.get(run.tabId)).windowId); const idle = await chrome.idle.queryState(60); await fire(); const after = await getRun(); await chrome.tabs.update(me, { active: true }); await wait(1300); return { focused: win.focused, idle, skipped: after.skipped, countBefore: run.count, countAfter: after.count, status: $('status').textContent, hold: document.body.hasAttribute('data-hold') };`);
  if (hold.focused && hold.idle === 'active') check('holds instead of reloading while the user is on the tab', hold.skipped === 'active' && hold.countAfter === hold.countBefore && hold.hold, hold);
  else check(`tab in front is still refreshed when nobody is there (window focused: ${hold.focused}, user: ${hold.idle})`, hold.skipped === null && hold.countAfter === hold.countBefore + 1, hold);

  /* 9. Tab picker: another tab, another site, many tabs */
  await background('https://mail.example.com/orders');
  await background('https://shop.other.test/orders');
  await sleep(1500);
  const moved = await P(`const from = (await getRun()).tabId; $('tabButton').click(); await wait(500); const list = options().map((o) => ({ title: o.querySelector('.option-title').textContent, selected: o.getAttribute('aria-selected') })); await pick('Orders · Example Mail'); const run = await getRun(); return { list, moved: run.tabId !== from, url: run.url, name: $('tabName').textContent, fromDiscardable: (await chrome.tabs.get(from)).autoDiscardable, target: (await chrome.storage.local.get('target')).target, menuHidden: $('tabMenu').hidden };`);
  check('tab menu lists every open web page and marks the current one', moved.list.length === 3 && moved.list.filter((o) => o.selected === 'true').length === 1, moved.list);
  check('picking another tab moves the running timer to it and remembers it', moved.moved && moved.url.endsWith('/orders') && moved.name === 'Orders · Example Mail' && moved.target.url === moved.url && moved.menuHidden, { url: moved.url, name: moved.name });
  check('the tab it left is handed back to Memory Saver', moved.fromDiscardable === true, moved.fromDiscardable);
  before = loads('shop.other.test');
  const other = await P(`await pick('Other Shop'); await fire(); const run = await getRun(); return { url: run.url, count: run.count, name: $('tabName').textContent };`);
  check('works on a different website: picks it, refreshes it', other.url === 'https://shop.other.test/orders' && other.count === 1 && loads('shop.other.test') - before === 1 && other.name === 'Orders · Other Shop', { ...other, reloads: loads('shop.other.test') - before });
  for (let i = 1; i <= 5; i++) await background(`https://docs.other.test/p${i}`);
  await sleep(1800);
  const many = await P(`const closedH = frameH(); $('tabButton').click(); await wait(600); const menu = $('tabMenu').getBoundingClientRect(); const frame = document.querySelector('.frame').getBoundingClientRect(); const out = { count: options().length, inside: menu.bottom <= frame.bottom, openH: frame.height, scrolls: $('tabMenu').scrollHeight > $('tabMenu').clientHeight, docW: document.documentElement.scrollWidth }; return { ...out, closedH };`);
  check('with many tabs the menu scrolls and the popup grows to show it fully', many.count === 8 && many.inside && many.scrolls && many.openH <= 600 && many.docW === 360, many);
  await shot('tab-picker-light', 'light');
  const shrunk = await P(`$('tabButton').click(); await wait(400); return frameH();`);
  check('closing the menu returns the popup to its normal height', shrunk === many.closedH, { shrunk, closedH: many.closedH });

  /* 10. Stop reasons */
  const stopped = await P(`$('toggle').click(); await wait(600); return { run: (await getRun()) ?? null, alarms: (await chrome.alarms.getAll()).length, badge: await chrome.action.getBadgeText({}), state: document.body.dataset.state, text: $('toggle').textContent, tab: $('tabName').textContent };`);
  check('Stop clears the run, the alarms and the badge', stopped.run === null && stopped.alarms === 0 && stopped.badge === '' && stopped.state === 'idle' && stopped.text === 'Start', stopped);
  check('the picked tab is still selected after stopping', stopped.tab === 'Orders · Other Shop', stopped.tab);
  const left = await P(`await pick('Orders · Example Mail'); $('toggle').click(); await wait(600); const run = await getRun(); await chrome.tabs.update(run.tabId, { url: 'https://shop.other.test/orders' }); await wait(1200); await fire(); return { run: (await getRun()) ?? null, reason: await lastStop(), status: $('status').textContent, badge: await chrome.action.getBadgeText({}), tab: $('tabName').textContent };`);
  check('stops by itself when the tab moves to a different site', left.run === null && left.reason === 'left' && left.status === 'Stopped: tab left the site' && left.badge === '', left);
  check('then offers another open tab on the remembered site', left.tab === 'Inbox · Example Mail', left.tab);
  const sub = await P(`$('toggle').click(); await wait(600); const run = await getRun(); await chrome.tabs.update(run.tabId, { url: 'https://mail.example.com/orders' }); await wait(1200); await fire(); const after = await getRun(); return { running: Boolean(after), url: after?.url, count: after?.count, target: (await chrome.storage.local.get('target')).target.url };`);
  check('keeps running when the tab moves within the same site, and follows it', sub.running && sub.url.endsWith('/orders') && sub.count === 1 && sub.target === sub.url, sub);
  const login = await P(`const run = await getRun(); await chrome.tabs.update(run.tabId, { url: 'https://mail.example.com/login' }); await wait(1200); await fire(); return { run: (await getRun()) ?? null, reason: await lastStop(), status: $('status').textContent };`);
  check('stops when the site bounces the tab to a login page', login.run === null && login.reason === 'signed-out' && login.status === 'Stopped: login page', login);
  const auto = await P(`$('toggle').click(); await wait(600); const run = await getRun(); run.stopAt = Date.now() + 400; await chrome.storage.session.set({ run }); await fire('auto-stop', 1800); return { run: (await getRun()) ?? null, reason: await lastStop(), status: $('status').textContent };`);
  check('auto-stop ends the run', auto.run === null && auto.reason === 'timer' && auto.status === 'Auto-stop reached', auto);

  /* 11. Remembered tab no longer open */
  const gone = await P(`const mail = await chrome.tabs.query({ url: 'https://mail.example.com/*' }); const keep = mail[0]; await chrome.tabs.update(keep.id, { url: '${INBOX}' }); await wait(1200); await pick('Inbox · Example Mail'); $('toggle').click(); await wait(600); await chrome.tabs.remove(mail.map((t) => t.id)); await wait(1000); const out = { run: (await getRun()) ?? null, reason: await lastStop(), status: $('status').textContent, tab: $('tabName').textContent, disabled: $('toggle').disabled }; $('tabButton').click(); await wait(500); out.firstOption = options()[0].textContent; options()[0].click(); await wait(1800); out.reopened = (await chrome.tabs.query({ url: 'https://mail.example.com/*' })).map((t) => t.url); $('tabButton').click(); await wait(300); $('tabButton').click(); await wait(600); out.tabAfter = $('tabName').textContent; out.enabled = !$('toggle').disabled; $('tabButton').click(); await wait(300); return out;`);
  check('stops when the tab is closed and says so', gone.run === null && gone.reason === 'closed' && gone.status === 'Stopped: tab closed', gone);
  check('a remembered tab that is closed is named, not silently replaced', gone.tab === 'mail.example.com isn’t open' && gone.disabled, { tab: gone.tab, disabled: gone.disabled });
  check('the menu offers to reopen it, at the remembered address', gone.firstOption === 'Open mail.example.com' && gone.reopened.length === 1 && gone.reopened[0] === INBOX && gone.tabAfter === 'Inbox · Example Mail' && gone.enabled, gone);

  /* 12. Settings */
  const settings = await P(`await chrome.tabs.update((await chrome.tabs.getCurrent()).id, { active: true }); $('openSettings').click(); await wait(500); const body = document.querySelector('.sheet-body'); const h = frameH(); document.querySelector('#theme [data-value=dark]').click(); document.querySelector('#accent [data-value=clay]').click(); await wait(300); const look = { theme: document.documentElement.dataset.theme, accent: document.documentElement.dataset.accent, cached: localStorage.getItem('dammer:look') }; $('reset').click(); await wait(300); return { scrolls: body.scrollHeight > body.clientHeight, frameH: h, look, reset: (await chrome.storage.local.get('settings')).settings, shortcut: $('shortcut').textContent };`);
  check('settings fit without scrolling, inside 600px', !settings.scrolls && settings.frameH <= 600, { scrolls: settings.scrolls, frameH: settings.frameH });
  check('theme and colour apply at once and are cached for the next open', settings.look.theme === 'dark' && settings.look.accent === 'clay' && settings.look.cached.includes('clay'), settings.look);
  check('Reset restores the defaults', settings.reset.timer === 'digital' && settings.reset.accent === 'moss' && settings.reset.mode === '3-5', settings.reset);
  check('keyboard shortcut is registered', /R$/.test(settings.shortcut), settings.shortcut);
  const preserved = await P(`$('closeSettings').click(); await wait(400); document.querySelector('#presets [data-value=custom]').click(); await wait(300); document.querySelector('[data-field=customMinSec] [data-dir="-1"]').click(); await wait(300); const custom = [$('minValue').textContent, $('maxValue').textContent]; document.querySelector('#presets [data-value="5-8"]').click(); await wait(300); const preset = digital(); document.querySelector('#presets [data-value=custom]').click(); await wait(300); const back = [$('minValue').textContent, $('maxValue').textContent]; document.querySelector('#presets [data-value="3-5"]').click(); await wait(300); $('openSettings').click(); await wait(400); return { custom, preset, back };`);
  check('a custom range survives trying a preset', preserved.custom.join() === '2m 30s,5 min' && preserved.preset === '5–8' && preserved.back.join() === preserved.custom.join(), preserved);
  await shot('settings-light', 'light');
  await shot('settings-dark', 'dark');

  /* 12b. About page and Glass theme */
  const about = await P(`$('openAbout').click(); await wait(600); const links = [...document.querySelectorAll('#about a')].map((a) => a.href); const body = document.querySelector('#about .sheet-body'); return { view: document.body.dataset.view, version: $('version').textContent, manifest: chrome.runtime.getManifest().version, links, scrolls: body.scrollHeight > body.clientHeight, frameH: frameH(), name: document.querySelector('.about-name').textContent };`);
  check('About page shows the version and the developer links', about.view === 'about' && about.version === about.manifest && about.links.join() === 'https://github.com/AleenaTahir1,https://www.linkedin.com/in/aleenatahir,https://github.com/AleenaTahir1/dammer' && !about.scrolls && about.frameH <= 600, about);
  await shot('about-light', 'light');
  const glass = await P(`$('closeAbout').click(); await wait(400); document.querySelector('#theme [data-value=glass]').click(); await wait(400); $('closeSettings').click(); await wait(500); const s = getComputedStyle(document.querySelector('.select-btn')); await pick('Example Mail'); $('toggle').click(); await wait(600); await setFraction(0.62); await wait(600); return { theme: document.documentElement.dataset.theme, blur: s.backdropFilter, orb: getComputedStyle(document.querySelector('.frame'), '::before').animationName, cached: localStorage.getItem('dammer:look'), running: document.body.dataset.state, docW: document.documentElement.scrollWidth, frameH: frameH() };`);
  check('Glass theme applies frosted surfaces and drifting lights without changing the popup size', glass.theme === 'glass' && glass.blur.includes('blur') && glass.orb === 'float-a' && glass.cached.includes('glass') && glass.docW === 360 && glass.frameH <= 600, glass);
  await shot('glass-digital-running', 'dark');
  await P(`$('openSettings').click(); await wait(400); document.querySelector('#timer [data-value=analog]').click(); await wait(300); $('closeSettings').click(); await wait(600);`);
  await shot('glass-analog-running', 'dark');
  await P(`$('toggle').click(); await wait(500); $('openSettings').click(); await wait(400); $('reset').click(); await wait(300);`);

  /* 13. Long custom range */
  const long = await P(`$('closeSettings').click(); await wait(400); await chrome.storage.local.set({ settings: { mode: 'custom', customMinSec: 45, customMaxSec: 3600 } }); await wait(500); const el = document.querySelector('.digits'); const r = el.getBoundingClientRect(); return { text: digital(), left: r.left, right: r.right };`);
  check('the longest custom range still fits on one line', long.text === '0:45–60:00' && long.left >= 16 && long.right <= 344, long);

  check('no errors or warnings in the popup console', popup.errors.length === 0, popup.errors);
  const worker = (await browser.send('Target.getTargets')).targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(browser.id));
  if (worker) {
    const sw = await browser.attach(worker.targetId);
    await sleep(300);
    check('no errors in the service worker', sw.errors.length === 0, sw.errors);
  }
} catch (error) {
  check('test run completed', false, error.stack);
} finally {
  browser?.close();
  sites.close();
}

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      ' + JSON.stringify(r.detail)}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed; local stand-in sites served ${sites.hits.length} page loads`);
process.exit(failed ? 1 : 0);
