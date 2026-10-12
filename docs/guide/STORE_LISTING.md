# Chrome Web Store listing

Dammer is distributed through GitHub releases. This file holds the text and answers needed if it is ever submitted to the Chrome Web Store, so the listing stays consistent with what the extension really does.

## Listing

**Name:** Dammer — Tab Auto Refresh

**Summary (132 characters max):**
Private, lightweight auto-refresh for any tab. Randomised intervals, auto-stop, analog or digital timer. No tracking.

**Category:** Productivity → Tools

**Language:** English

**Description:**

> Dammer refreshes a tab for you on a timer. Choose the tab, choose how often, press Start.
>
> • Works on any website. Pick the tab once and Dammer remembers it.
> • Refreshes at a random moment inside the range you set, from 30 seconds to 60 minutes.
> • Digital or analog countdown.
> • Light, dark and glass themes with five colours.
> • Never reloads a tab while you are using it.
> • Stops by itself after a set time, or when the tab is closed or leaves the site.
> • Start or stop from any tab with Alt+Shift+R.
>
> Private by design. Dammer makes no network requests, has no accounts or analytics, and cannot read the content of any page. It is open source: https://github.com/AleenaTahir1/dammer
>
> Some websites do not allow automatic refreshing. Check a site's terms before using Dammer on it.

**Screenshots (1280×800 or 640×400):** compose from `docs/screenshots/`.

**Homepage:** https://aleenatahir1.github.io/dammer/

**Support:** https://github.com/AleenaTahir1/dammer/issues

## Privacy tab

**Single purpose:** Automatically reload one tab the user has chosen, on a timer the user sets.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `tabs` | Needed to show the user's open tabs by title and address so they can choose which one to refresh, and to detect when the chosen tab has navigated to a different site so the timer can stop. |
| `alarms` | Needed to schedule the next refresh and the automatic stop while the service worker is asleep. |
| `storage` | Needed to save the user's settings and chosen tab on their device. |
| `idle` | Needed to tell whether the user is at the computer, so a tab they are looking at is not reloaded and the timer can stop when they step away. |

**Remote code:** No. All code is in the package.

**Data use:** Dammer does not collect or use user data. None of the data-type boxes apply.

Certifications:
- Does not sell or transfer user data to third parties.
- Does not use or transfer user data for purposes unrelated to the single purpose.
- Does not use or transfer user data to determine creditworthiness or for lending.

**Privacy policy URL:** https://aleenatahir1.github.io/dammer/privacy/
