# Permissions

Dammer asks for four permissions and no host access.

| Permission | Install warning | Used for | Where in the code |
| --- | --- | --- | --- |
| `tabs` | "Read your browsing history" | Reading the title and address of open tabs, to list them in the tab picker and to detect that the chosen tab has left its site. | `resolveTarget()` in `src/shared.js`; `tick()` in `src/background.js` |
| `alarms` | none | Waking the service worker when a refresh or the auto-stop is due. | `src/background.js` |
| `storage` | none | Saving settings and the chosen tab locally. | `src/shared.js`, `src/background.js`, `popup/popup.js` |
| `idle` | none | Learning whether the computer was used recently, for the "On the tab" and "Stop if away" settings. | `watching()` and `tick()` in `src/background.js` |

## About the `tabs` warning

Chrome words this permission as "Read your browsing history" because tab addresses reveal which sites are open. Dammer needs it to let you choose any tab by name. It reads addresses only when the popup is open or a refresh is due, keeps at most one trimmed address (the tab you chose), and cannot send anything anywhere: see the network section in [PRIVACY.md](../../PRIVACY.md).

## What is deliberately absent

| Not requested | What that rules out |
| --- | --- |
| Host permissions, `<all_urls>` | Reading or changing page content, cookies or requests |
| `scripting`, content scripts | Running code inside pages |
| `webRequest`, `declarativeNetRequest` | Seeing or modifying network traffic |
| `cookies`, `history`, `bookmarks`, `downloads` | Access to those stores |
| `externally_connectable`, `web_accessible_resources` | Pages or other extensions talking to Dammer |

Reloading a tab with `chrome.tabs.reload`, protecting it from Memory Saver with `chrome.tabs.update`, and reading window focus with `chrome.windows.get` need no permission.

## Content security policy

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'
```

Only files inside the package can load, inline scripts and styles are blocked, and `connect-src 'none'` blocks every outgoing connection from the extension's pages.
