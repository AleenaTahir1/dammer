// Service worker. It is asleep almost all the time: Chrome wakes it for an
// alarm, a popup message or a closed tab, it does a few milliseconds of work
// and goes idle again. Nothing is kept in globals; state lives in
// chrome.storage.session (the run) and chrome.storage.local (the settings).

import { getSettings, isLoginPage, isWeb, pageOf, randomDelay, rememberTarget, resolveTarget, sameSite } from './shared.js';

const REFRESH = 'refresh';
const AUTO_STOP = 'auto-stop';

const ICON_ON = { 16: '/icons/on-16.png', 32: '/icons/on-32.png', 48: '/icons/on-48.png' };
const ICON_OFF = { 16: '/icons/off-16.png', 32: '/icons/off-32.png', 48: '/icons/off-48.png' };

// Listeners are registered synchronously at the top level so that the events
// which wake the worker are never missed.
chrome.alarms.onAlarm.addListener((alarm) => {
  serial(() => (alarm.name === AUTO_STOP ? onAutoStop() : tick()));
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Only this extension's own pages may drive the timer.
  if (sender.id !== chrome.runtime.id) return false;
  serial(() => onMessage(message)).then(
    (result) => respond({ ok: true, ...result }),
    (error) => respond({ ok: false, error: String(error?.message ?? error) }),
  );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  serial(async () => {
    const run = await getRun();
    if (run?.tabId === tabId) await stop('closed');
  });
});

// Chrome can swap a tab for a new one with a different id (e.g. prerendering).
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  serial(async () => {
    const run = await getRun();
    if (run?.tabId !== removedTabId) return;
    run.tabId = addedTabId;
    if (run.keptAwake) await keepAwake(run);
    const tab = await chrome.tabs.get(addedTabId).catch(() => null);
    if (tab) await rememberTarget(tab);
    await chrome.storage.session.set({ run });
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle') serial(toggle);
});

chrome.runtime.onStartup.addListener(() => serial(reconcile));
chrome.runtime.onInstalled.addListener(() => serial(reconcile));

// Events can interleave at every await, so all state changes run one at a time.
let queue = Promise.resolve();
function serial(task) {
  const result = queue.then(task);
  queue = result.catch((error) => console.warn('[dammer]', error));
  return result;
}

async function getRun() {
  const { run } = await chrome.storage.session.get('run');
  return run ?? null;
}

async function onMessage(message) {
  switch (message?.type) {
    case 'start':
      if (!Number.isInteger(message.tabId)) throw new Error('bad-tab');
      return start(message.tabId);
    case 'stop':
      return stop('user');
    case 'refresh-now':
      return tick({ force: true });
    case 'apply':
      return applySettings(Array.isArray(message.changed) ? message.changed : []);
    default:
      throw new Error('unknown-message');
  }
}

async function start(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !isWeb(tab.url)) throw new Error('bad-tab');

  const previous = await getRun();
  if (previous && previous.tabId !== tabId) await releaseTab(previous);

  const settings = await getSettings();
  const now = Date.now();
  const run = {
    tabId,
    url: pageOf(tab.url),
    startedAt: now,
    stopAt: settings.autoStopMin ? now + settings.autoStopMin * 60_000 : null,
    cycleStart: now,
    nextAt: now + randomDelay(settings),
    count: 0,
    lastAt: null,
    skipped: null,
    keptAwake: false,
  };
  if (settings.keepAwake) await keepAwake(run);

  await rememberTarget(tab);
  await chrome.alarms.create(REFRESH, { when: run.nextAt });
  await scheduleAutoStop(run);
  await chrome.storage.session.remove('lastStop');
  await chrome.storage.session.set({ run });
  await paint(true);
}

async function stop(reason) {
  const run = await getRun();
  await chrome.alarms.clear(REFRESH);
  await chrome.alarms.clear(AUTO_STOP);
  if (run) {
    await releaseTab(run);
    await chrome.storage.session.set({ lastStop: { reason, at: Date.now(), count: run.count } });
  }
  await chrome.storage.session.remove('run');
  await paint(false);
}

async function tick({ force = false } = {}) {
  const run = await getRun();
  if (!run) {
    // An alarm that outlived its run, e.g. after a browser restart.
    await chrome.alarms.clear(REFRESH);
    return;
  }

  const tab = await chrome.tabs.get(run.tabId).catch(() => null);
  if (!tab) return stop('closed');
  // run.url is where the tab was last cycle, so these catch a tab that has
  // wandered off to another site or been bounced to a login page since.
  if (!sameSite(tab.url, run.url)) return stop('left');
  if (isLoginPage(tab.url) && !isLoginPage(run.url)) return stop('signed-out');

  const now = Date.now();
  if (run.stopAt && now >= run.stopAt) return stop('timer');

  // Follow the tab as it moves around the site so it can be found after a restart.
  if (pageOf(tab.url) !== run.url) {
    run.url = pageOf(tab.url);
    await rememberTarget(tab);
  }

  const settings = await getSettings();
  if (!force) {
    // Nobody has touched the computer for the chosen time, or it is locked.
    if (settings.awayMin && (await chrome.idle.queryState(settings.awayMin * 60)) !== 'active') return stop('away');
    if (settings.onTab === 'stop' && (await watching(tab))) return stop('opened');
  }
  let skipped = force ? null : await skipReason(tab, settings);
  if (!skipped) {
    try {
      await chrome.tabs.reload(tab.id, { bypassCache: settings.hardRefresh });
      run.count += 1;
      run.lastAt = now;
      // A reload can drop the flag, so it is set again every cycle.
      if (run.keptAwake) await setDiscardable(tab.id, false);
    } catch {
      skipped = 'failed';
    }
  }

  run.skipped = skipped;
  run.cycleStart = now;
  run.nextAt = now + randomDelay(settings);
  await chrome.alarms.create(REFRESH, { when: run.nextAt });
  await chrome.storage.session.set({ run });
}

async function skipReason(tab, settings) {
  if (tab.status === 'loading') return 'loading';
  if (settings.onTab === 'pause' && (await watching(tab))) return 'active';
  if (navigator.onLine === false) return 'offline';
  return null;
}

// Whether the user is looking at the tab: it is in front, its window has
// focus, and the computer was used in the last minute. Someone who walked away
// with the tab in front is not looking at it.
async function watching(tab) {
  if (!tab.active) return false;
  const win = await chrome.windows.get(tab.windowId).catch(() => null);
  return Boolean(win?.focused) && (await chrome.idle.queryState(60)) === 'active';
}

async function onAutoStop() {
  const run = await getRun();
  if (run?.stopAt && Date.now() >= run.stopAt) return stop('timer');
  if (run) await scheduleAutoStop(run);
}

async function scheduleAutoStop(run) {
  if (run.stopAt) await chrome.alarms.create(AUTO_STOP, { when: run.stopAt });
  else await chrome.alarms.clear(AUTO_STOP);
}

// The popup saves settings itself, then tells the worker which group changed
// so a running timer picks the change up straight away.
async function applySettings(changed) {
  const run = await getRun();
  if (!run) return;
  const settings = await getSettings();
  const now = Date.now();

  if (changed.includes('interval')) {
    run.cycleStart = now;
    run.nextAt = now + randomDelay(settings);
    run.skipped = null;
    await chrome.alarms.create(REFRESH, { when: run.nextAt });
  }
  if (changed.includes('autoStop')) {
    // Counted from when the run began, so changing it never extends a run.
    run.stopAt = settings.autoStopMin ? run.startedAt + settings.autoStopMin * 60_000 : null;
    await scheduleAutoStop(run);
  }
  if (changed.includes('keepAwake')) {
    if (settings.keepAwake) await keepAwake(run);
    else await releaseTab(run);
  }
  if (changed.includes('badge')) await paint(true);
  await chrome.storage.session.set({ run });
}

async function toggle() {
  if (await getRun()) return stop('user');
  const { tab } = await resolveTarget();
  if (tab) await start(tab.id);
}

// Runs on browser start and on install/update. Session state is gone after a
// restart while alarms may survive, so the two are brought back in line.
async function reconcile() {
  const run = await getRun();
  if (!run) {
    // A run cut short by an update or restart can leave its tab marked.
    const { awake } = await chrome.storage.local.get('awake');
    if (Number.isInteger(awake)) await setDiscardable(awake, true);
    await chrome.storage.local.remove('awake');
    await chrome.alarms.clearAll();
    await paint(false);
    return;
  }
  if (!(await chrome.alarms.get(REFRESH))) {
    await chrome.alarms.create(REFRESH, { when: Math.max(run.nextAt, Date.now() + 1000) });
  }
  await paint(true);
}

async function setDiscardable(tabId, autoDiscardable) {
  try {
    await chrome.tabs.update(tabId, { autoDiscardable });
    return true;
  } catch {
    return false;
  }
}

// The tab id is also written to disk so the mark can be undone by reconcile()
// if the run's own state is lost.
async function keepAwake(run) {
  run.keptAwake = await setDiscardable(run.tabId, false);
  if (run.keptAwake) await chrome.storage.local.set({ awake: run.tabId });
}

async function releaseTab(run) {
  if (!run.keptAwake) return;
  await setDiscardable(run.tabId, true);
  await chrome.storage.local.remove('awake');
  run.keptAwake = false;
}

// The badge is set once per state change, never on a timer, so it costs nothing
// while the worker sleeps.
async function paint(running) {
  const { badge } = await getSettings();
  await Promise.all([
    chrome.action.setIcon({ path: running ? ICON_ON : ICON_OFF }),
    chrome.action.setBadgeBackgroundColor({ color: '#3f5c31' }),
    chrome.action.setBadgeTextColor({ color: '#ffffff' }),
    chrome.action.setBadgeText({ text: running && badge ? 'ON' : '' }),
    chrome.action.setTitle({ title: running ? 'Dammer — refreshing a tab' : 'Dammer — idle' }),
  ]);
}
