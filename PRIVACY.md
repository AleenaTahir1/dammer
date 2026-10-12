# Privacy policy

Effective 12 October 2026 · applies to Dammer 1.0.0 and later

Dammer does not collect, transmit, sell or share any data. There are no accounts, no analytics, no advertising and no remote servers. Everything the extension does happens inside your browser on your computer.

## What Dammer can see

Dammer has the `tabs` permission. This lets it read the **title and address of your open tabs**, which it uses for two things:

- to show your tabs in the tab picker so you can choose one;
- to check, each time a refresh is due, that the chosen tab is still on the same site and has not been sent to a login page.

Dammer has no content scripts and no host permissions. It **cannot read or change what is on any page**: not text, not forms, not passwords, not cookies.

## What Dammer stores

All of it stays in your browser profile on your computer.

| Where | What | Kept until |
| --- | --- | --- |
| `chrome.storage.local` | Your settings (interval, theme, timer style and so on). | You reset or remove the extension. |
| `chrome.storage.local` | The tab you chose: its tab number and its address **without** the query string or fragment (for example `https://example.com/inbox`, never `?token=…`). | You choose another tab or remove the extension. |
| `chrome.storage.local` | The number of the tab currently protected from Memory Saver, so the protection can be undone after an update. | The timer stops. |
| `chrome.storage.session` | The running timer: tab number, address as above, start time, next refresh time and refresh count. Held in memory only. | The timer stops or the browser closes. |
| `localStorage` (popup) | A copy of your theme and colour, so the popup opens without a flash. | You remove the extension. |

Dammer does not use `chrome.storage.sync`, so nothing is copied to your Google account.

## What Dammer sends

Nothing. The extension's content security policy sets `connect-src 'none'`, which makes the browser block every network request from the extension's own pages. The project's automated check also fails if networking code is added.

Reloading a tab does cause *your browser* to request that page from its website again, exactly as pressing the reload button would. That request goes from your browser to the site, not through Dammer.

The About page contains links to the developers' GitHub and LinkedIn profiles. They open in a new tab only if you click them.

## Other permissions

- `alarms`: to wake the extension when a refresh is due.
- `storage`: for the items in the table above.
- `idle`: to learn whether the computer has been used in the last minute, for the "Pause while I'm on the tab" setting. Dammer receives only "active", "idle" or "locked".

## Removing your data

Removing the extension from `chrome://extensions` deletes everything it stored. The **Reset** button in settings restores the default settings without removing the extension.

## Changes

Any change to this policy will be recorded in [CHANGELOG.md](CHANGELOG.md) and in this file's history on GitHub. A release that changed what Dammer can see or store would say so in its release notes.

## Contact

Questions: open an issue at <https://github.com/AleenaTahir1/dammer/issues>. To report a security problem privately, see [SECURITY.md](SECURITY.md).
