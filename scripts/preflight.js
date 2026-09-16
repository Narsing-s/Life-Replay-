const fs = require('fs');
const path = require('path');

const production = process.env.NODE_ENV === 'production';
const failures = [];
const warnings = [];

function requireEnv(name, predicate, message) {
  const value = process.env[name];
  if (!value || !predicate(value)) failures.push(`${name}: ${message}`);
}

if (!production) {
  console.log('Life Replay preflight: development mode; production-only secret checks are skipped.');
  process.exit(0);
}

requireEnv('JWT_SECRET', value => value.length >= 32 && value !== 'change-me-in-production', 'set a random secret of at least 32 characters');
requireEnv('ALLOWED_ORIGINS', value => value.split(',').some(x => /^https:\/\//.test(x.trim())), 'configure at least one HTTPS frontend origin');
requireEnv('DATA_DIR', value => path.isAbsolute(value), 'use an absolute persistent-volume path in production');

const dataDir = process.env.DATA_DIR;
if (dataDir) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    failures.push(`DATA_DIR: ${error.message}`);
  }
  if (/^(?:\.\/?|\/tmp(?:\/|$))/.test(dataDir)) warnings.push('DATA_DIR appears ephemeral; configure a persistent volume before accepting real memories.');
}

if (!process.env.OPENAI_API_KEY) warnings.push('OPENAI_API_KEY is not configured; AI answers use the local memory search fallback.');
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) warnings.push('Google Photos OAuth is not configured; import remains disabled.');

if (failures.length) {
  console.error('Life Replay preflight FAILED');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Life Replay preflight PASSED');
warnings.forEach(item => console.warn(`WARN: ${item}`));
