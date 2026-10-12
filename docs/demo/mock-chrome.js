// Stand-in for the chrome.* APIs, so the real popup and service worker code
// can run inside the website as a live demo. Nothing here ships in the
// extension. The "tabs" are made up and "reloading" one only tells the page.
(() => {
  const event = () => {
    const listeners = [];
    return { addListener: (fn) => listeners.push(fn), fire: (...args) => listeners.map((fn) => fn(...args)) };
  };
  const tell = (message) => parent.postMessage({ dammer: true, ...message }, location.origin);

  const tab = (id, title, url) => [id, { id, windowId: 1, active: false, status: 'complete', title, url, autoDiscardable: true }];
  const tabs = new Map([
    tab(11, 'Inbox · Example Mail', 'https://mail.example.com/inbox'),
    tab(12, 'Orders · Corner Shop', 'https://shop.example.org/orders'),
    tab(13, 'Live scores · Matchday', 'https://scores.example.net/live'),
    tab(14, 'Dashboard · Analytics', 'https://stats.example.io/dashboard'),
  ]);

  const onChanged = event();
  const area = (name, data = {}) => ({
    async get(keys) {
      if (keys == null) return structuredClone(data);
      const out = {};
      for (const key of [].concat(keys)) if (key in data) out[key] = structuredClone(data[key]);
      return out;
    },
    async set(items) {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
        data[key] = structuredClone(value);
      }
      onChanged.fire(changes, name);
    },
    async remove(keys) {
      const changes = {};
      for (const key of [].concat(keys)) {
        if (!(key in data)) continue;
        changes[key] = { oldValue: data[key] };
        delete data[key];
      }
      if (Object.keys(changes).length) onChanged.fire(changes, name);
    },
  });

  // A 30-second cycle, so a visitor sees a full turn without waiting minutes.
  const local = area('local', {
    settings: { mode: 'custom', customMinSec: 30, customMaxSec: 30, autoStopMin: 0, theme: 'light' },
    target: { tabId: 11, url: 'https://mail.example.com/inbox' },
  });

  const alarms = new Map();
  const onAlarm = event();
  const onMessage = event();
  const nothing = async () => {};

  window.chrome = {
    storage: { local, session: area('session'), onChanged },
    alarms: {
      async create(name, { when }) {
        clearTimeout(alarms.get(name)?.timer);
        const timer = setTimeout(() => {
          alarms.delete(name);
          onAlarm.fire({ name });
        }, Math.max(0, when - Date.now()));
        alarms.set(name, { name, scheduledTime: when, timer });
      },
      async clear(name) {
        clearTimeout(alarms.get(name)?.timer);
        return alarms.delete(name);
      },
      async clearAll() {
        for (const { timer } of alarms.values()) clearTimeout(timer);
        alarms.clear();
      },
      async get(name) {
        return alarms.get(name);
      },
      onAlarm,
    },
    tabs: {
      async get(id) {
        if (!tabs.has(id)) throw new Error('No tab');
        return { ...tabs.get(id) };
      },
      async query(query) {
        return [...tabs.values()].filter((t) => !query.active || t.active).map((t) => ({ ...t }));
      },
      async reload(id) {
        tell({ type: 'refresh', title: tabs.get(id).title });
      },
      async update(id, props) {
        Object.assign(tabs.get(id), props);
      },
      create: nothing,
      onRemoved: event(),
      onReplaced: event(),
    },
    windows: { get: async () => ({ focused: false }), update: nothing },
    idle: { queryState: async () => 'idle' },
    action: { setIcon: nothing, setBadgeText: nothing, setBadgeBackgroundColor: nothing, setBadgeTextColor: nothing, setTitle: nothing },
    commands: { onCommand: event(), getAll: async () => [{ name: 'toggle', shortcut: 'Alt+Shift+R' }] },
    runtime: {
      id: 'demo',
      onMessage,
      onStartup: event(),
      onInstalled: event(),
      getManifest: () => ({ version: document.documentElement.dataset.version }),
      sendMessage: (message) => new Promise((resolve) => onMessage.fire(message, { id: 'demo' }, resolve)),
    },
  };

  // What the surrounding page may ask of the demo.
  window.demo = {
    async set(patch) {
      const { settings } = await local.get('settings');
      await local.set({ settings: { ...settings, ...patch } });
    },
    start: () => chrome.runtime.sendMessage({ type: 'start', tabId: 11 }),
  };

  addEventListener('load', () => {
    new ResizeObserver(([entry]) => tell({ type: 'height', value: Math.ceil(entry.contentRect.height) })).observe(document.querySelector('.frame'));
    setTimeout(() => window.demo.start(), 700);
  });
})();
