// Launches Chrome with a throwaway profile, loads the unpacked extension over
// the DevTools pipe, and points two made-up sites at a local server, so the
// tests drive the real extension in a real browser without touching the
// network or your own Chrome profile.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:https';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
export const ROOT = resolve(here, '../..');
export const EXT = join(ROOT, 'extension');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME =
  process.env.CHROME ??
  { darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }[process.platform] ??
  'google-chrome';

// Scratch space for the browser profile and a one-off self-signed certificate.
const work = mkdtempSync(join(tmpdir(), 'dammer-e2e-'));

// Stand-in websites. mail.example.com and shop.other.test never leave this machine.
export function startFakeSites() {
  const hits = [];
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(work, 'key.pem'), '-out', join(work, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const server = createServer({ key: readFileSync(join(work, 'key.pem')), cert: readFileSync(join(work, 'cert.pem')) }, (req, res) => {
    const host = req.headers.host.split(':')[0];
    if (!req.url.includes('favicon')) hits.push(host + req.url);
    const page = req.url.startsWith('/login') ? 'Log in' : req.url.startsWith('/orders') ? 'Orders' : req.url.startsWith('/p') ? `Page ${req.url.slice(2)}` : 'Inbox';
    const site = host.startsWith('mail') ? 'Example Mail' : host.startsWith('shop') ? 'Other Shop' : 'Other Docs';
    const title = `${page} · ${site}`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>${title}</title><h1>${title}</h1>`);
  });
  return new Promise((resolve) => server.listen(8443, '127.0.0.1', () => resolve({ hits, close: () => server.close() })));
}

export async function launch() {
  const profile = join(work, 'profile');
  const chrome = spawn(
    CHROME,
    [
      `--user-data-dir=${profile}`,
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--host-resolver-rules=MAP *.example.com 127.0.0.1:8443, MAP *.other.test 127.0.0.1:8443',
      '--ignore-certificate-errors',
      '--window-size=1200,900',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );
  const [, , , toChrome, fromChrome] = chrome.stdio;
  let seq = 0;
  let buffer = '';
  const pending = new Map();
  const listeners = new Set();
  fromChrome.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const msg = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, method } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
      } else for (const fn of listeners) fn(msg);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, method });
      toChrome.write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });

  // A page (or the extension's service worker) we can run code in.
  async function attach(targetId) {
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const errors = [];
    listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    const call = (method, params) => send(method, params, sessionId);
    await call('Runtime.enable');
    const evaluate = async (body) => {
      const { result, exceptionDetails } = await call('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    return { targetId, call, evaluate, errors };
  }

  const open = async (url) => attach((await send('Target.createTarget', { url })).targetId);
  const { id } = await send('Extensions.loadUnpacked', { path: EXT });
  const close = () => {
    chrome.kill();
    setTimeout(() => rmSync(work, { recursive: true, force: true }), 500);
  };
  return { id, send, attach, open, close };
}
