const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 4500 + Math.floor(Math.random() * 100);
const base = `http://127.0.0.1:${port}`;
let child;
let dataDir;

async function waitForHealth() {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('server did not become healthy');
}

async function req(pathname, options) {
  const r = await fetch(`${base}${pathname}`, options);
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { r, body };
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-replay-hardening-'));
  child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DATA_DIR: dataDir, JWT_SECRET: 'hardening-test-secret' }, stdio: 'ignore' });
  await waitForHealth();
});

test.after(() => { child?.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('CORS preflight accepts GitHub Pages origin', async () => {
  const { r } = await req('/api/auth/register', { method: 'OPTIONS', headers: { Origin: 'https://narsing-s.github.io', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://narsing-s.github.io');
  assert.match(r.headers.get('access-control-allow-methods') || '', /POST/);
});

test('request id and security headers are present', async () => {
  const { r } = await req('/api/health');
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('x-request-id'));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

test('password reset request does not reveal account existence', async () => {
  const { r, body } = await req('/api/v1/auth/password-reset/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'missing@example.com' }) });
  assert.equal(r.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.developmentToken, undefined);
});
