// Packs the extension folder into dist/dammer-<version>.zip, the file people
// download from the Releases page and the one the Chrome Web Store accepts.
//
//   node tools/build.mjs
//
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));
const out = join(root, 'dist', `dammer-${version}.zip`);

mkdirSync(join(root, 'dist'), { recursive: true });
rmSync(out, { force: true });
// -X leaves out extra file attributes; dotfiles such as .DS_Store are skipped.
execFileSync('zip', ['-r', '-X', '-q', out, '.', '-x', '.*', '-x', '*/.*'], { cwd: join(root, 'extension') });

console.log(`built ${out} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
