// Copies the extension's popup and worker into docs/demo so the website can
// run them live against docs/demo/mock-chrome.js. Run after changing the
// extension, so the site never shows something the extension does not do.
//
//   node tools/site.mjs
//
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const demo = join(root, 'docs/demo');
const { version } = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));

for (const dir of ['popup', 'src']) {
  rmSync(join(demo, dir), { recursive: true, force: true });
  cpSync(join(root, 'extension', dir), join(demo, dir), { recursive: true });
}

const page = join(demo, 'popup/popup.html');
const html = readFileSync(page, 'utf8')
  .replace('<html lang="en"', `<html lang="en" data-version="${version}"`)
  .replace('<title>Dammer</title>', '<title>Dammer live demo</title>\n  <meta name="robots" content="noindex">')
  // The site decides the demo's theme, so the saved-theme loader is left out.
  .replace('  <script src="theme.js"></script>\n', '')
  .replace(
    '<script type="module" src="popup.js"></script>',
    '<script src="../mock-chrome.js"></script>\n  <script type="module" src="../src/background.js"></script>\n  <script type="module" src="popup.js"></script>',
  );
if (!html.includes('mock-chrome.js')) throw new Error('could not wire the demo into popup.html');
writeFileSync(page, html);

console.log(`synced docs/demo with extension v${version}`);
