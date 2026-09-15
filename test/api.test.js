const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 4300 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;
let child;
let dataDir;

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Server did not become healthy');
}

async function json(pathname, options) {
  const response = await fetch(`${base}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-replay-test-'));
  child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR: dataDir,
      JWT_SECRET: 'test-only-secret-that-is-not-used-in-production'
    },
    stdio: 'ignore'
  });
  await waitForHealth();
});

test.after(() => {
  child?.kill('SIGTERM');
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('health endpoint reports service status', async () => {
  const { response, body } = await json('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'life-replay');
});

test('protected memory endpoint rejects anonymous access', async () => {
  const { response, body } = await json('/api/memories');
  assert.equal(response.status, 401);
  assert.equal(body.error, 'Authentication required');
});

test('register, login and current-user flow works', async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';

  const registration = await json('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password })
  });

  assert.equal(registration.response.status, 201);
  assert.ok(registration.body.token);
  assert.equal(registration.body.user.email, email);
  assert.equal(registration.body.user.name, 'Test User');

  const login = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  assert.equal(login.response.status, 200);
  assert.ok(login.body.token);

  const me = await json('/api/me', {
    headers: { authorization: `Bearer ${login.body.token}` }
  });

  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.email, email);
  assert.equal(me.body.user.name, 'Test User');
});

test('invalid credentials are rejected without leaking details', async () => {
  const { response, body } = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' })
  });

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Incorrect email or password');
  assert.equal(body.password, undefined);
});
