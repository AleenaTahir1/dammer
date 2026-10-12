// Builds the website's inner pages (privacy, security, install, FAQ,
// changelog, 404) and sitemap.xml from one template, so the navigation,
// footer and search-engine tags stay the same everywhere.
//
//   node tools/pages.mjs
//
// The home page (docs/index.html) is written by hand; everything this script
// writes is listed in PAGES below.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const docs = join(root, 'docs');
const { version } = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));

const SITE = 'https://aleenatahir1.github.io/dammer/';
const REPO = 'https://github.com/AleenaTahir1/dammer';
const RELEASES = `${REPO}/releases/latest`;
const UPDATED = '2026-10-12';
const UPDATED_TEXT = '12 October 2026';

// Questions and answers, used for the FAQ page and its structured data.
// Each answer is plain HTML and must stay true to what the extension does.
export const FAQ = [
  {
    group: 'Getting started',
    items: [
      ['How do I auto refresh a tab in Chrome?', `Chrome has no built-in auto refresh, so you need an extension. With Dammer: click its icon, choose the page under <strong>Tab</strong>, choose a range under <strong>Refresh every</strong>, and press <strong>Start</strong>. The toolbar icon turns green and shows ON while it runs. The <a href="../install/">install guide</a> has the full steps.`],
      ['Is Dammer free?', `Yes. Dammer is free and open source under the MIT licence. There is no account, no paid tier and no advertising.`],
      ['Is Dammer on the Chrome Web Store?', `No. You install it from a <a href="${RELEASES}">GitHub release</a> by loading the unzipped folder in <code>chrome://extensions</code> with Developer mode switched on. It takes about a minute.`],
      ['Which browsers does it work in?', `Chrome 120 or newer, and other Chromium browsers: Microsoft Edge, Brave, Arc and Opera. It does not work in Firefox or Safari, and there is no mobile version.`],
    ],
  },
  {
    group: 'Using it',
    items: [
      ['Does it work on any website?', `It works on any ordinary web page (addresses starting with http or https). It cannot refresh browser pages such as <code>chrome://settings</code> or the Chrome Web Store. Some websites do not allow automatic refreshing in their terms, so check before you use it on one.`],
      ['What refresh intervals can I set?', `Four presets (2–3, 3–5, 5–8 and 8–12 minutes) or a custom range from 30 seconds to 60 minutes. Each refresh happens at a random moment inside the range. Set both ends of a custom range to the same value if you want a fixed interval.`],
      ['Can it refresh more than one tab at a time?', `No. Dammer refreshes one tab at a time. Choosing a different tab while it is running moves the timer to that tab.`],
      ['Does it keep refreshing when the tab is in the background?', `Yes. The timer runs in Chrome itself, not inside the page, so it keeps working when you switch tabs or minimise the window, and Dammer stops Chrome's Memory Saver from putting the tab to sleep. Chrome has to be open, and refreshing pauses while the computer is asleep.`],
      ['Will it reload the page while I am typing?', `Not while you are using the tab. With <strong>On the tab</strong> set to Pause (the default), Dammer skips a refresh whenever the tab is in front and the computer has been used in the last minute. Set it to Stop and the timer ends as soon as you come back to the tab.`],
      ['How do I stop it?', `Press <strong>Stop</strong> in the popup, or press <code>Alt+Shift+R</code> from any tab. It also stops by itself after the auto-stop time (2 hours by default), when the tab is closed, when the tab moves to a different site, or when the site sends it to a login page.`],
      ['Can it stop when I leave my computer?', `Yes. Turn on <strong>Stop if away</strong> in settings and choose 5, 15 or 30 minutes. Once the computer has gone unused for that long, or is locked, the timer stops at the next refresh instead of running unattended.`],
      ['What does "Careful settings" do?', `One tap applies a cautious set-up: refresh every 8–12 minutes, auto-stop after 1 hour, pause while you are on the tab, and stop after 5 minutes away. You can still change each setting afterwards.`],
      ['What is the difference between the digital and analog timer?', `Only how the countdown looks. Digital shows large numbers with a progress bar; analog shows a clock face whose hand sweeps round once per cycle. Switch between them in Settings.`],
    ],
  },
  {
    group: 'Privacy and safety',
    items: [
      ['Is Dammer safe to install?', `It is designed so there is very little it could do even if it had a bug. It makes no network requests (the browser blocks them through its security policy), it has no access to the content of any page, and every line of code is public. The <a href="../security/">security page</a> explains how to check this yourself.`],
      ['Why does Chrome say it can "Read your browsing history"?', `That is how Chrome describes the <code>tabs</code> permission. Dammer uses it to read the title and address of your open tabs so you can pick one from a list, and to notice when the chosen tab has moved to a different site. Nothing is sent anywhere. See <a href="../security/#permissions">permissions</a>.`],
      ['Can Dammer read my passwords or what is on a page?', `No. It has no content scripts and no host permissions, so it cannot read or change the content of any page: not text, forms, passwords or cookies.`],
      ['What does Dammer store?', `Your settings and the tab you chose (its address without anything after a question mark), in your browser profile on your computer. Removing the extension deletes it all. The <a href="../privacy/">privacy policy</a> lists every item.`],
      ['Does it slow down my computer?', `No. The background script sleeps between refreshes and wakes for a few milliseconds each cycle. The only real cost is the page itself reloading, exactly as if you pressed the reload button.`],
    ],
  },
  {
    group: 'Updating and removing',
    items: [
      ['How do I update Dammer?', `Download the newest zip from the <a href="${RELEASES}">releases page</a>, unzip it over the old folder, then click the reload arrow on Dammer's card in <code>chrome://extensions</code>. Your settings are kept.`],
      ['How do I remove it?', `Open <code>chrome://extensions</code> and click <strong>Remove</strong> on Dammer's card. Everything it stored is deleted with it.`],
    ],
  },
];

const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const PAGES = [
  {
    slug: 'privacy',
    nav: 'Privacy',
    title: 'Privacy Policy — Dammer Auto Refresh Extension',
    description: 'Dammer collects nothing and sends nothing. See exactly what the auto-refresh extension can see, what it stores on your computer, and how to remove it.',
    eyebrow: 'Privacy policy',
    h1: 'Dammer collects nothing.',
    lede: 'No accounts, no analytics, no advertising and no servers. Everything the extension does happens inside your browser, on your computer.',
    body: `
<p class="doc-date">Effective ${UPDATED_TEXT}. Applies to Dammer 1.0.0 and later.</p>

<h2 id="see">What Dammer can see</h2>
<p>Dammer has the <code>tabs</code> permission. This lets it read the <strong>title and address of your open tabs</strong>, which it uses for two things:</p>
<ul>
  <li>to show your tabs in the tab picker so you can choose one;</li>
  <li>to check, each time a refresh is due, that the chosen tab is still on the same site and has not been sent to a login page.</li>
</ul>
<p>Dammer has no content scripts and no host permissions. It <strong>cannot read or change what is on any page</strong>: not text, not forms, not passwords, not cookies.</p>

<h2 id="store">What Dammer stores</h2>
<p>All of it stays in your browser profile on your computer.</p>
<div class="table"><table>
  <thead><tr><th>Where</th><th>What</th><th>Kept until</th></tr></thead>
  <tbody>
    <tr><td>Local extension storage</td><td>Your settings: interval, theme, timer style and so on.</td><td>You reset or remove the extension.</td></tr>
    <tr><td>Local extension storage</td><td>The tab you chose: its tab number and its address <strong>without</strong> the query string or fragment (for example <code>https://example.com/inbox</code>, never <code>?token=…</code>).</td><td>You choose another tab or remove the extension.</td></tr>
    <tr><td>Local extension storage</td><td>The number of the tab currently protected from Memory Saver, so the protection can be undone after an update.</td><td>The timer stops.</td></tr>
    <tr><td>Session storage (memory only)</td><td>The running timer: tab number, address as above, start time, next refresh time and refresh count.</td><td>The timer stops or the browser closes.</td></tr>
    <tr><td>Popup local storage</td><td>A copy of your theme and colour, so the popup opens without a flash.</td><td>You remove the extension.</td></tr>
  </tbody>
</table></div>
<p>Dammer does not use Chrome's synced storage, so nothing is copied to your Google account.</p>

<h2 id="send">What Dammer sends</h2>
<p>Nothing. The extension's content security policy sets <code>connect-src 'none'</code>, which makes the browser block every network request from the extension's own pages. The project's automated check also fails if networking code is ever added.</p>
<p>Reloading a tab does cause <em>your browser</em> to request that page from its website again, exactly as pressing the reload button would. That request goes from your browser to the site, not through Dammer.</p>
<p>The About page inside the extension links to the developer's GitHub and LinkedIn profiles. They open in a new tab only if you click them.</p>

<h2 id="other">Other permissions</h2>
<ul>
  <li><code>alarms</code>: to wake the extension when a refresh is due.</li>
  <li><code>storage</code>: for the items in the table above.</li>
  <li><code>idle</code>: to learn whether the computer has been used recently, for the "On the tab" and "Stop if away" settings. Dammer receives only "active", "idle" or "locked".</li>
</ul>
<p>Each one is explained on the <a href="../security/#permissions">security and permissions page</a>.</p>

<h2 id="website">This website</h2>
<p>This website has no analytics, cookies or tracking of its own. It is hosted on GitHub Pages and loads its fonts from Google Fonts and its animation libraries from the jsDelivr CDN, so those services receive the ordinary request data any web server does, such as your IP address. The live demo on the home page runs entirely in your browser.</p>

<h2 id="remove">Removing your data</h2>
<p>Removing the extension from <code>chrome://extensions</code> deletes everything it stored. The <strong>Reset</strong> button in settings restores the defaults without removing the extension.</p>

<h2 id="changes">Changes to this policy</h2>
<p>Any change is recorded in the <a href="../changelog/">changelog</a>. A release that changed what Dammer can see or store would say so in its notes.</p>

<h2 id="contact">Contact</h2>
<p>Questions: <a href="${REPO}/issues">open an issue on GitHub</a>. To report a security problem privately, see the <a href="../security/#report">security page</a>.</p>`,
  },
  {
    slug: 'security',
    nav: 'Security',
    title: 'Security and Permissions — Dammer Auto Refresh Extension',
    description: 'How Dammer is built so an auto-refresh extension cannot spy on you: no network access, no page access, four explained permissions, and how to verify it.',
    eyebrow: 'Security and permissions',
    h1: 'Built so it can’t spy on you.',
    lede: 'Auto-refresh extensions have a history of being used for ad injection and tracking. Dammer is designed so that there is very little it could do, even with a bug.',
    body: `
<h2 id="design">What the design rules out</h2>
<ul>
  <li><strong>No network access.</strong> The content security policy sets <code>connect-src 'none'</code>, so the browser blocks every outgoing connection from the extension. An automated check fails the build if <code>fetch</code>, <code>XMLHttpRequest</code>, <code>WebSocket</code>, <code>eval</code> or <code>new Function</code> appear in the code.</li>
  <li><strong>No remote code.</strong> Every script ships inside the package. Nothing is downloaded after install.</li>
  <li><strong>No access to page content.</strong> There are no content scripts, no host permissions and no <code>scripting</code> permission.</li>
  <li><strong>No messages from outside.</strong> Web pages and other extensions cannot talk to Dammer, and its background script rejects any message that does not come from its own popup.</li>
  <li><strong>Page data is treated as text.</strong> Tab titles and addresses come from web pages, so they are only ever inserted as plain text.</li>
  <li><strong>Stored addresses are trimmed.</strong> Anything after a question mark or hash is removed before an address is saved.</li>
  <li><strong>No dependencies.</strong> There are no third-party packages and no build step that could be tampered with.</li>
</ul>

<h2 id="permissions">Permissions, and why each is needed</h2>
<div class="table"><table>
  <thead><tr><th>Permission</th><th>Chrome's warning</th><th>What Dammer uses it for</th></tr></thead>
  <tbody>
    <tr><td><code>tabs</code></td><td>"Read your browsing history"</td><td>Reading the title and address of open tabs, to list them in the tab picker and to notice when the chosen tab has left its site.</td></tr>
    <tr><td><code>alarms</code></td><td>None</td><td>Waking the background script when a refresh or the auto-stop is due.</td></tr>
    <tr><td><code>storage</code></td><td>None</td><td>Saving your settings and chosen tab on your computer.</td></tr>
    <tr><td><code>idle</code></td><td>None</td><td>Learning whether the computer was used recently, so a tab you are looking at is not reloaded and the timer can stop when you step away.</td></tr>
  </tbody>
</table></div>
<p>Chrome words the <code>tabs</code> permission as "Read your browsing history" because tab addresses reveal which sites are open. Dammer reads them only while the popup is open or a refresh is due, keeps at most one trimmed address (the tab you chose), and has no way to send anything anywhere.</p>

<h3 id="absent">What it does not ask for</h3>
<div class="table"><table>
  <thead><tr><th>Not requested</th><th>What that rules out</th></tr></thead>
  <tbody>
    <tr><td>Host permissions, "all sites" access</td><td>Reading or changing page content, cookies or requests</td></tr>
    <tr><td><code>scripting</code>, content scripts</td><td>Running code inside pages</td></tr>
    <tr><td><code>webRequest</code>, <code>declarativeNetRequest</code></td><td>Seeing or changing network traffic</td></tr>
    <tr><td><code>cookies</code>, <code>history</code>, <code>bookmarks</code>, <code>downloads</code></td><td>Access to those stores</td></tr>
  </tbody>
</table></div>

<h2 id="verify">Check it yourself</h2>
<p>You do not have to take any of this on trust.</p>
<ul>
  <li><strong>Read the code.</strong> The extension is about 2,300 lines of plain HTML, CSS and JavaScript in the <a href="${REPO}/tree/main/extension">extension folder</a>.</li>
  <li><strong>Rebuild the download.</strong> Release zips are built by a public <a href="${REPO}/blob/main/.github/workflows/release.yml">GitHub Actions workflow</a> from the tagged commit. Run <code>npm run build</code> and compare.</li>
  <li><strong>Run the tests.</strong> <code>npm test</code> drives the real extension in a real copy of Chrome and runs 58 checks, including that reloads happen exactly once and that the timer survives the background script being stopped.</li>
  <li><strong>Watch the network.</strong> Open the popup, right-click it, choose Inspect and look at the Network tab. It stays empty.</li>
</ul>

<h2 id="report">Reporting a security problem</h2>
<p>Please report it privately, not in a public issue. On the <a href="${REPO}/security">repository's Security tab</a>, click <strong>Report a vulnerability</strong> and describe what you found and how to reproduce it. You can expect an acknowledgement within a week. Only the latest release receives fixes.</p>`,
  },
  {
    slug: 'install',
    nav: 'Install',
    title: 'Install Dammer — Auto Refresh for Chrome, Edge and Brave',
    description: 'Step-by-step guide to installing the Dammer auto-refresh extension in Chrome, Edge, Brave, Arc or Opera, starting your first timer, updating and removing it.',
    eyebrow: 'Install guide',
    h1: 'Install Dammer in a minute.',
    lede: 'Dammer is installed from a GitHub release. You download a small zip, unzip it and point your browser at the folder.',
    body: `
<p><a class="pill pill-solid" href="${RELEASES}"><span>Download for Chrome</span><small>free</small></a></p>

<h2 id="chrome">Install in Chrome</h2>
<ol class="steps-list">
  <li><strong>Download.</strong> Open the <a href="${RELEASES}">latest release</a> and download <code>dammer-${version}.zip</code>.</li>
  <li><strong>Unzip.</strong> Unzip it somewhere you will keep it, such as your Documents folder. Chrome loads the extension from this folder, so do not delete it afterwards.</li>
  <li><strong>Open the extensions page.</strong> Type <code>chrome://extensions</code> in the address bar and press Enter.</li>
  <li><strong>Turn on Developer mode</strong> with the switch in the top right corner.</li>
  <li><strong>Load it.</strong> Click <strong>Load unpacked</strong> and choose the unzipped folder, the one that contains <code>manifest.json</code>.</li>
  <li><strong>Pin it.</strong> Click the puzzle-piece icon in the toolbar and pin Dammer so its icon is always visible.</li>
</ol>

<h2 id="other-browsers">Edge, Brave, Arc and Opera</h2>
<p>The steps are the same; only the address of the extensions page changes.</p>
<div class="table"><table>
  <thead><tr><th>Browser</th><th>Extensions page</th><th>Developer switch</th></tr></thead>
  <tbody>
    <tr><td>Microsoft Edge</td><td><code>edge://extensions</code></td><td>"Developer mode", bottom left</td></tr>
    <tr><td>Brave</td><td><code>brave://extensions</code></td><td>"Developer mode", top right</td></tr>
    <tr><td>Arc</td><td><code>arc://extensions</code></td><td>"Developer mode", top right</td></tr>
    <tr><td>Opera</td><td><code>opera://extensions</code></td><td>"Developer mode", top right</td></tr>
  </tbody>
</table></div>
<p>Firefox and Safari are not supported.</p>

<h2 id="first-timer">Start your first timer</h2>
<ol class="steps-list">
  <li>Open the page you want refreshed.</li>
  <li>Click the Dammer icon in the toolbar.</li>
  <li>Under <strong>Tab</strong>, choose that page. Dammer remembers it, so you only do this once.</li>
  <li>Under <strong>Refresh every</strong>, choose a range in minutes, or <strong>Custom</strong> for anything from 30 seconds to 60 minutes.</li>
  <li>Press <strong>Start</strong>. The icon turns green and shows ON.</li>
</ol>
<p>You can now switch to other tabs; the timer keeps running. Press <strong>Stop</strong>, or <code>Alt+Shift+R</code> from any tab, to end it. It also stops by itself after two hours unless you change the auto-stop time in settings.</p>

<h2 id="update">Update</h2>
<p>Download the newest zip, unzip it over the old folder, then click the reload arrow on Dammer's card on the extensions page. Your settings are kept. The <a href="../changelog/">changelog</a> lists what changed.</p>

<h2 id="remove">Remove</h2>
<p>Click <strong>Remove</strong> on Dammer's card on the extensions page. Everything it stored is deleted with it.</p>

<h2 id="trouble">If something is not working</h2>
<div class="table"><table>
  <thead><tr><th>What you see</th><th>What to do</th></tr></thead>
  <tbody>
    <tr><td>"Manifest file is missing or unreadable"</td><td>You chose the wrong folder. Pick the folder that directly contains <code>manifest.json</code>.</td></tr>
    <tr><td>A "Disable developer mode extensions" message when Chrome starts</td><td>This is Chrome's standard notice for extensions installed outside the Web Store. Close it; Dammer keeps working.</td></tr>
    <tr><td>The Start button is greyed out</td><td>No tab is chosen. Open the <strong>Tab</strong> list and pick a page.</td></tr>
    <tr><td>The page you want is not in the Tab list</td><td>Only ordinary web pages are listed. Browser pages such as <code>chrome://settings</code> cannot be refreshed.</td></tr>
    <tr><td><code>Alt+Shift+R</code> does nothing</td><td>Another extension may use the same keys. Set a different shortcut at <code>chrome://extensions/shortcuts</code>.</td></tr>
    <tr><td>It says "Paused while you're on the tab"</td><td>That is the setting protecting whatever you are typing. Switch to another tab, or change <strong>On the tab</strong> to Refresh in settings.</td></tr>
    <tr><td>It says "Stopped: you were away"</td><td><strong>Stop if away</strong> is on and the computer went unused. Press Start again, or set it to Off in settings.</td></tr>
  </tbody>
</table></div>
<p>More answers are in the <a href="../faq/">FAQ</a>. If you have found a bug, <a href="${REPO}/issues">open an issue</a>.</p>`,
  },
  {
    slug: 'faq',
    nav: 'FAQ',
    title: 'Auto Refresh in Chrome: Questions and Answers — Dammer',
    description: 'Answers about auto-refreshing tabs in Chrome with Dammer: how to set it up, whether it is safe, which sites and browsers it works with, and how to stop it.',
    eyebrow: 'Frequently asked questions',
    h1: 'Questions, answered.',
    lede: 'How auto refresh works in Chrome, what Dammer can and cannot do, and how to keep it out of your way.',
    body: FAQ.map(
      ({ group, items }) => `
<h2 id="${slugify(group)}">${group}</h2>
<div class="qa">${items.map(([q, a]) => `
  <details id="${slugify(q)}">
    <summary><h3>${q}</h3></summary>
    <p>${a}</p>
  </details>`).join('')}
</div>`,
    ).join('\n'),
    schema: {
      '@type': 'FAQPage',
      mainEntity: FAQ.flatMap(({ items }) => items).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
    },
  },
  {
    slug: 'changelog',
    nav: 'Changelog',
    title: 'Changelog — Dammer Auto Refresh Extension',
    description: 'Release notes for Dammer, the private auto-refresh extension for Chrome: what was added, changed and fixed in each version.',
    eyebrow: 'Changelog',
    h1: 'What’s new.',
    lede: `The current version is ${version}. Every release is on GitHub with its download.`,
    body: `
<p><a class="pill pill-solid" href="${RELEASES}"><span>Download ${version}</span><small>free</small></a></p>

<h2 id="v1-1-0">1.1.0 <span class="doc-when">12 October 2026</span></h2>
<ul>
  <li><strong>On the tab</strong>: choose what happens when a refresh is due while you are looking at the tab: refresh anyway, pause, or stop the timer.</li>
  <li><strong>Stop if away</strong>: stops the timer once the computer has not been used for 5, 15 or 30 minutes, or is locked.</li>
  <li><strong>Careful settings</strong>: one tap sets slower refreshes, a 1-hour auto-stop, pause on the tab and stop after 5 minutes away.</li>
  <li>The keyboard shortcut is now shown on the About page.</li>
</ul>

<h2 id="v1-0-2">1.0.2 <span class="doc-when">12 October 2026</span></h2>
<ul>
  <li>The About page lists the author only; contributor credits are in the project README.</li>
  <li>New website with inner pages for privacy, security, installing and questions.</li>
</ul>

<h2 id="v1-0-1">1.0.1 <span class="doc-when">12 October 2026</span></h2>
<ul>
  <li>Project website with a live demo of the popup.</li>
</ul>

<h2 id="v1-0-0">1.0.0 <span class="doc-when">12 October 2026</span></h2>
<p>First public release.</p>
<ul>
  <li>Auto refresh for any open tab, chosen from a list and remembered between sessions.</li>
  <li>Randomised refresh intervals: four presets and a custom range from 30 seconds to 60 minutes.</li>
  <li>Digital and analog timer styles.</li>
  <li>Light, dark and glass themes with five accent colours; follows the system theme by default.</li>
  <li>Auto-stop after 1, 2, 4 or 8 hours.</li>
  <li>Automatic stop when the tab is closed, moves to a different site, or is sent to a login page.</li>
  <li>Pause while the tab is in front and the computer is in use.</li>
  <li>Protection from Chrome's Memory Saver for the chosen tab.</li>
  <li>Optional hard refresh and toolbar badge.</li>
  <li><code>Alt+Shift+R</code> shortcut to start or stop from any tab.</li>
  <li>About page with the version number and developer links.</li>
</ul>
<p>The full history, with every commit, is on <a href="${REPO}/releases">GitHub</a>.</p>`,
  },
];

const mark = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle class="mark-disc" cx="16" cy="16" r="16"/><circle class="mark-ring" cx="16" cy="16" r="10.24"/><path class="mark-wedge" d="M16 16V9.6A6.4 6.4 0 0 1 21.54 19.2z"/></svg>`;

// Tick, the character. Same markup as on the home page.
const tick = `<div class="tick-sky" data-tick-sky aria-hidden="true"><div class="tick" data-tick hidden><svg viewBox="0 0 64 64" overflow="visible"><g data-part="feet"><ellipse class="t-foot" cx="23" cy="59" rx="6.2" ry="3.6"/><ellipse class="t-foot" cx="41" cy="59" rx="6.2" ry="3.6"/></g><g data-part="bell-l"><path class="t-bell" d="M9.4 19.6a9.6 9.6 0 0 1 16.6-9.6z"/><circle class="t-bell" cx="14.6" cy="9.4" r="2.5"/></g><g data-part="bell-r"><path class="t-bell" d="M54.6 19.6a9.6 9.6 0 0 0-16.6-9.6z"/><circle class="t-bell" cx="49.4" cy="9.4" r="2.5"/></g><path class="t-arm" d="M27 12.5q5-4.4 10 0"/><circle class="t-body" cx="32" cy="37" r="21"/><circle class="t-face" cx="32" cy="37" r="16"/><path class="t-marks" d="M32 23v2.4M32 48.6V51M18 37h2.4M43.6 37H46"/><g data-part="eyes"><g data-part="lids"><ellipse class="t-eye" cx="26" cy="36" rx="2.9" ry="3.9"/><ellipse class="t-eye" cx="38" cy="36" rx="2.9" ry="3.9"/><circle class="t-glint" cx="27" cy="34.4" r="1.1"/><circle class="t-glint" cx="39" cy="34.4" r="1.1"/></g><path class="t-smile" d="M29.4 42.2q2.6 2.4 5.2 0"/></g><ellipse class="t-blush" cx="21.6" cy="41.4" rx="2.8" ry="1.8"/><ellipse class="t-blush" cx="42.4" cy="41.4" rx="2.8" ry="1.8"/><g class="t-ring" data-part="ring"><path d="M3.5 8.5q-3 6-.6 12M60.5 8.5q3 6 .6 12M-2 5.5q-4.2 9-.8 18M66 5.5q4.2 9 .8 18"/></g></svg></div></div>`;

const head = ({ title, description, url, schema, up, index = true }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="${index ? 'index, follow' : 'noindex'}">
  <meta name="author" content="Aleena Tahir">
  ${index ? `<link rel="canonical" href="${url}">` : ''}
  <meta property="og:site_name" content="Dammer">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Dammer, a private auto-refresh extension for Chrome">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${SITE}og.png">
  <meta name="theme-color" content="#e6e7dc">
  <link rel="icon" type="image/png" href="${up}favicon.png">
  <link rel="apple-touch-icon" href="${up}favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${up}site.css">
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': schema })}</script>
</head>`;

const nav = (up, here) => `
  <header class="nav">
    <a class="brand" href="${up}" aria-label="Dammer home">${mark}<span>Dammer</span></a>
    <nav class="nav-links" aria-label="Site">
      <a class="wipe" href="${up}#how">How it works</a>
      ${[['install', 'Install'], ['faq', 'FAQ'], ['privacy', 'Privacy']].map(([slug, label]) => `<a class="wipe" href="${up}${slug}/"${slug === here ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
    <a class="pill pill-quiet" href="${REPO}">GitHub</a>
  </header>`;

const footer = (up) => `
  <footer class="foot">
    <div class="foot-panel">
      <div class="foot-top">
        <div class="foot-cta">
          <h2 data-perch="text">Set it once.<br><em>Let it tick.</em></h2>
          <a class="pill pill-light" data-perch href="${RELEASES}"><span>Download for Chrome</span><small>free</small></a>
        </div>
        <div class="foot-clock" data-perch>
          <p class="eyebrow">You have been here for</p>
          <p class="foot-time" id="stay">0:00</p>
          <div class="foot-meter"><i id="stayBar"></i></div>
          <p class="foot-note">This page has not reloaded once. Some tabs need a nudge; that is what Dammer is for.</p>
        </div>
      </div>
      <div class="foot-links">
        <div class="foot-brand">
          <a class="brand" href="${up}" aria-label="Dammer home">${mark}<span>Dammer</span></a>
          <p>A private auto-refresh extension for any tab. Free and open source.</p>
        </div>
        <nav aria-label="Product">
          <p class="eyebrow">Product</p>
          <a class="wipe" href="${RELEASES}">Download</a>
          <a class="wipe" href="${up}#how">How it works</a>
          <a class="wipe" href="${up}install/">Install guide</a>
          <a class="wipe" href="${up}faq/">FAQ</a>
          <a class="wipe" href="${up}changelog/">Changelog</a>
        </nav>
        <nav aria-label="Project">
          <p class="eyebrow">Project</p>
          <a class="wipe" href="${REPO}">Source code</a>
          <a class="wipe" href="${up}privacy/">Privacy policy</a>
          <a class="wipe" href="${up}security/">Security</a>
          <a class="wipe" href="${REPO}/blob/main/LICENSE">MIT License</a>
        </nav>
        <nav aria-label="Author">
          <p class="eyebrow">Made by</p>
          <span>Aleena Tahir</span>
          <a class="wipe" href="https://github.com/AleenaTahir1">GitHub</a>
          <a class="wipe" href="https://www.linkedin.com/in/aleenatahir">LinkedIn</a>
        </nav>
      </div>
      <div class="foot-base">
        <p>© 2026 Aleena Tahir</p>
        <a class="foot-up" href="#top">Back to top <span aria-hidden="true">↑</span></a>
      </div>
    </div>
  </footer>

  ${tick}
  <script src="${up}pages.js"></script>
  <script src="${up}tick.js"></script>`;

function render(page) {
  const url = `${SITE}${page.slug}/`;
  const schema = [
    { '@type': 'WebPage', '@id': url, url, name: page.title, description: page.description, dateModified: UPDATED, inLanguage: 'en', isPartOf: { '@id': `${SITE}#website` } },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Dammer', item: SITE },
        { '@type': 'ListItem', position: 2, name: page.nav, item: url },
      ],
    },
    ...(page.schema ? [page.schema] : []),
  ];
  const others = PAGES.filter((p) => p !== page);
  return `${head({ ...page, url, schema, up: '../' })}
<body class="doc-page" id="top">
  <a class="skip" href="#main">Skip to content</a>
${nav('../', page.slug)}

  <main id="main" class="doc">
    <header class="doc-head">
      <nav class="crumbs" aria-label="Breadcrumb"><a class="wipe" href="../">Dammer</a><span aria-hidden="true">/</span><span aria-current="page">${page.nav}</span></nav>
      <p class="eyebrow">${page.eyebrow}</p>
      <h1>${page.h1}</h1>
      <p class="doc-lede">${page.lede}</p>
    </header>

    <article class="prose" data-perch>${page.body}
    </article>

    <nav class="doc-more" aria-label="More pages">
      ${others.map((p) => `<a href="../${p.slug}/" data-perch><span class="eyebrow">${p.eyebrow}</span><strong>${p.nav}</strong><span aria-hidden="true">→</span></a>`).join('\n      ')}
    </nav>
  </main>
${footer('../')}
</body>
</html>
`;
}

for (const page of PAGES) {
  mkdirSync(join(docs, page.slug), { recursive: true });
  writeFileSync(join(docs, page.slug, 'index.html'), render(page));
}

// GitHub Pages serves this for any address that does not exist. It can be
// reached from any depth, so its links are absolute.
writeFileSync(
  join(docs, '404.html'),
  `${head({ title: 'Page not found — Dammer', description: 'That page does not exist. Head back to Dammer, the private auto-refresh extension for Chrome.', url: `${SITE}404.html`, schema: [], up: '/dammer/', index: false })}
<body class="doc-page" id="top">
  <a class="skip" href="#main">Skip to content</a>
${nav('/dammer/', '')}
  <main id="main" class="doc">
    <header class="doc-head">
      <p class="eyebrow">Error 404</p>
      <h1>Nothing to refresh here.</h1>
      <p class="doc-lede">That page does not exist, or it has moved.</p>
      <p><a class="pill pill-solid" data-perch href="/dammer/"><span>Back to Dammer</span></a></p>
    </header>
    <nav class="doc-more" aria-label="Pages">
      ${PAGES.map((p) => `<a href="/dammer/${p.slug}/" data-perch><span class="eyebrow">${p.eyebrow}</span><strong>${p.nav}</strong><span aria-hidden="true">→</span></a>`).join('\n      ')}
    </nav>
  </main>
${footer('/dammer/')}
</body>
</html>
`,
);

// The home page is hand-written, but its questions and its structured data
// come from here so they can never drift from the FAQ page.
const HOME_QUESTIONS = ['How do I auto refresh a tab in Chrome?', 'Is Dammer safe to install?', 'Does it work on any website?', 'Does it keep refreshing when the tab is in the background?', 'Will it reload the page while I am typing?', 'Is Dammer free?'];
const homeFaq = HOME_QUESTIONS.map((question) => FAQ.flatMap(({ items }) => items).find(([q]) => q === question));
const homeSchema = [
  { '@type': 'WebSite', '@id': `${SITE}#website`, url: SITE, name: 'Dammer', description: 'A free, private auto-refresh extension for Chrome.', inLanguage: 'en', publisher: { '@id': `${SITE}#author` } },
  { '@type': 'Person', '@id': `${SITE}#author`, name: 'Aleena Tahir', url: 'https://github.com/AleenaTahir1', sameAs: ['https://github.com/AleenaTahir1', 'https://www.linkedin.com/in/aleenatahir'] },
  {
    '@type': 'SoftwareApplication',
    '@id': `${SITE}#app`,
    name: 'Dammer',
    alternateName: 'Dammer — Tab Auto Refresh',
    description: 'A free, open-source Chrome extension that auto-refreshes any tab on a timer you set. It makes no network requests and cannot read the content of any page.',
    url: SITE,
    image: `${SITE}og.png`,
    screenshot: ['digital-light-running', 'analog-dark-running', 'glass-digital-running', 'tab-picker-light'].map((name) => `${SITE}screenshots/${name}.png`),
    applicationCategory: 'BrowserApplication',
    applicationSubCategory: 'Browser extension',
    operatingSystem: 'Windows, macOS, Linux, ChromeOS',
    softwareRequirements: 'Google Chrome 120 or newer, or another Chromium browser (Edge, Brave, Arc, Opera)',
    softwareVersion: version,
    downloadUrl: RELEASES,
    releaseNotes: `${SITE}changelog/`,
    license: `${REPO}/blob/main/LICENSE`,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': `${SITE}#author` },
    featureList: ['Auto refresh any tab on a timer', 'Randomised refresh intervals from 30 seconds to 60 minutes', 'Digital and analog countdown', 'Light, dark and glass themes', 'Auto-stop', 'Pauses while you use the tab', 'No network requests or tracking'],
  },
  { '@type': 'FAQPage', '@id': `${SITE}#faq`, mainEntity: homeFaq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) },
];
const between = (html, name, content) => {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error(`docs/index.html is missing the ${name} markers`);
  return html.slice(0, a + start.length) + content + html.slice(b);
};
const homePath = join(docs, 'index.html');
let home = readFileSync(homePath, 'utf8');
home = between(home, 'schema', `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': homeSchema })}</script>`);
home = between(
  home,
  'faq',
  `
      <div class="qa" data-reveal>${homeFaq.map(([q, a]) => `
        <details>
          <summary><h3>${q}</h3></summary>
          <p>${a.replaceAll('href="../', 'href="')}</p>
        </details>`).join('')}
      </div>
      `,
);
writeFileSync(homePath, home);

const urls = [SITE, ...PAGES.map((p) => `${SITE}${p.slug}/`)];
writeFileSync(
  join(docs, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url, i) => `  <url><loc>${url}</loc><lastmod>${UPDATED}</lastmod><priority>${i === 0 ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`,
);

console.log(`wrote ${PAGES.length} pages, 404.html and sitemap.xml (${urls.length} addresses)`);
