# Architecture

Dammer has two parts that never share memory: a **service worker** that does the refreshing and a **popup** that shows and changes state. They communicate through `chrome.storage` and four messages.

```
 popup (open only while you look at it)        service worker (asleep almost always)
 ┌───────────────────────────────┐             ┌──────────────────────────────────┐
 │ popup.js                      │  messages   │ background.js                    │
 │  start / stop / refresh-now   │ ──────────▶ │  start()  stop()  tick()         │
 │  apply (settings changed)     │             │                                  │
 │                               │  storage    │  chrome.alarms ──▶ tick()        │
 │  renders from run + settings  │ ◀────────── │  chrome.tabs.reload(tabId)       │
 └───────────────────────────────┘  onChanged  └──────────────────────────────────┘
```

## The service worker

Chrome stops an extension's service worker after about 30 seconds of inactivity, so nothing is kept in variables. Each event reads what it needs from storage, acts, writes back, and returns.

- **State.** The running timer (`run`) lives in `chrome.storage.session`: tab id, address, start time, next refresh time, count. Settings and the remembered tab live in `chrome.storage.local`.
- **Timing.** One one-shot alarm, `refresh`, is set for the next refresh. When it fires, `tick()` reloads the tab and sets the next alarm with a fresh random delay. A second alarm, `auto-stop`, ends the run. Alarms survive the worker being stopped; that is the whole reason they are used instead of `setTimeout`.
- **Order.** Alarms, messages and tab events can arrive while an earlier one is still awaiting storage, so every handler goes through `serial()`, a one-at-a-time queue.
- **Stop conditions.** Before each reload `tick()` checks that the tab still exists, is on the same site as last cycle, and has not been redirected to a login page. With the matching settings on, it also stops when the computer has gone unused for the chosen time, or when the user is looking at the tab. Any of these ends the run with a reason the popup can show.
- **Skip conditions.** A reload is skipped, and the cycle simply continues, while the tab is still loading, while the machine is offline, or while the tab is in front of a focused window and the computer has been used in the last minute.
- **Recovery.** On browser start and on install or update, `reconcile()` clears alarms that have no run and releases a tab that was left protected from Memory Saver.

The reload itself is `chrome.tabs.reload(tabId)`, which needs no host permission. Dammer never injects code into a page.

## The popup

The popup is created each time it is opened and destroyed when it closes.

- `theme.js` runs first, from `<head>`, and applies the saved theme from `localStorage` before anything is painted.
- `popup.js` loads settings and the run, finds the target tab, renders, and then listens to `chrome.storage.onChanged`. The worker is the only writer of `run`; the popup only reacts.
- A 250 ms timer updates the countdown while a run is active. It drives both timer styles from one number, the fraction of the cycle that has elapsed: the digital bar's scale, and the analog hand's angle and slice. Because the popup is destroyed on close, the countdown costs nothing in the background.

## Choosing and remembering a tab

`resolveTarget()` in `shared.js` is used by both sides so the popup and the keyboard shortcut always agree:

1. the remembered tab id, if that tab is still on the remembered site;
2. otherwise a tab at the remembered address;
3. otherwise any tab on the remembered site;
4. otherwise nothing, and the popup offers to reopen the address.

With nothing remembered yet, the tab in front is offered. Addresses are stored without query strings or fragments.

## Why there is no build step

Chrome loads ES modules directly, the whole extension is about 70 KB, and a build step would be one more thing that could be tampered with. `tools/build.mjs` only zips the `extension/` folder.
