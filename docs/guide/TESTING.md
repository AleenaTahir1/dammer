# Testing

## Quick check

```bash
npm run check
```

Needs only Node. It validates the manifest (version match, description length, no host permissions, CSP still blocks connections), confirms every file the manifest names exists, parses every script, and fails if `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` or `new Function` appear. This runs in CI on every push.

## End-to-end test

```bash
npm test
```

Needs Node 22 or newer, Google Chrome and `openssl`. Set `CHROME=/path/to/chrome` if Chrome is not in the default location.

The test starts Chrome headless with a temporary profile, loads the unpacked extension through the DevTools protocol, and opens the real popup page. Two made-up sites (`mail.example.com` and `*.other.test`) are mapped to a small local HTTPS server, so the test never touches the network or your own browser profile. Because the extension runs in a real browser, the real `chrome.alarms`, `chrome.tabs`, `chrome.storage`, `chrome.idle` and `chrome.action` APIs are exercised.

It runs 53 checks, grouped as:

| Area | What is verified |
| --- | --- |
| Layout | Popup is exactly 360 px wide in every view, never taller than 600 px, nothing overflows. |
| First run | Asks for a tab, Start disabled until one is chosen. |
| Start | Run created on the chosen tab, delay inside the chosen range, both alarms set, badge shown, tab protected from Memory Saver. |
| Digital timer | Readout equals the true time left, counts one second per second, bar matches elapsed time at 10/25/50/75/95 %, snaps to empty on a new cycle. |
| Analog timer | Hand angle and slice match elapsed time at the same five points, hand advances in real time, snaps to the top on a new cycle, readout matches. |
| Persistence | Timer style, running state and tab survive closing and reopening the popup. |
| Refreshing | "Refresh now" and an alarm each reload the page exactly once (counted by the local server) and schedule the next refresh in range. |
| Resilience | After the service worker is killed, the next alarm wakes it and the run continues. |
| Tab picker | Lists every open page, moves a running timer to another tab, works on a second site, scrolls and grows the popup with many tabs. |
| Stop reasons | Manual stop, tab moved to another site, login redirect, auto-stop, tab closed. Also that moving within the same site does not stop it. |
| Remembered tab | A closed tab is named and can be reopened at the remembered address. |
| Settings | Fit without scrolling, theme and colour apply and are cached, Reset works, custom range survives trying a preset. |
| About and Glass | Version and links are correct; glass theme applies without changing the popup size. |
| Console | No errors or warnings in the popup or the service worker. |

The run also retakes the screenshots in `docs/screenshots/`.

## What is not covered automatically

- The popup opened from the toolbar (the test opens the same page in a tab).
- Behaviour across a full browser restart.
- Browser zoom levels other than 100 %.
- Browsers other than Chrome.

Check these by hand when changing related code.
