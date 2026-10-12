// Fast sanity checks that need no browser: the manifest is valid and inside
// Chrome Web Store limits, every file it names exists, every script parses,
// and nothing in the extension reaches for the network or runs remote code.
//
//   node tools/check.mjs
//
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const ext = join(root, 'extension');
const problems = [];
const fail = (message) => problems.push(message);

const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} does not match package.json ${pkg.version}`);
if (manifest.description.length > 132) fail(`description is ${manifest.description.length} characters; the store limit is 132`);
if (manifest.host_permissions?.length) fail('host_permissions should stay empty');
if (!manifest.content_security_policy?.extension_pages?.includes("connect-src 'none'")) fail("the CSP must keep connect-src 'none'");

const named = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.action.default_icon),
  ...Object.values(manifest.icons),
];
for (const file of named) if (!existsSync(join(ext, file))) fail(`manifest names a missing file: ${file}`);

const scripts = ['src', 'popup'].flatMap((dir) =>
  readdirSync(join(ext, dir))
    .filter((name) => name.endsWith('.js'))
    .map((name) => join(ext, dir, name)),
);
for (const file of scripts) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`syntax error in ${file}\n${error.stderr}`);
  }
  const source = readFileSync(file, 'utf8');
  for (const banned of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'eval(', 'new Function', 'importScripts(']) {
    if (source.includes(banned)) fail(`${file} uses ${banned} — the extension must not talk to the network or run generated code`);
  }
}

const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : null;
if (tag && tag !== `v${manifest.version}`) fail(`tag ${tag} does not match manifest version ${manifest.version}`);

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ manifest, ${named.length} referenced files and ${scripts.length} scripts look good (v${manifest.version})`);
