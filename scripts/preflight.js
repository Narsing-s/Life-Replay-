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
requireEnv('FRONTEND_URL', value => /^https:\/\//.test(value.trim()), 'configure the HTTPS frontend URL for password reset and verification links');
requireEnv('DATA_DIR', value => path.isAbsolute(value), 'use an absolute persistent-volume path in production');
requireEnv('DATABASE_URL', value => /^postgres(?:ql)?:\/\//.test(value.trim()), 'configure the managed PostgreSQL connection string');
requireEnv('REDIS_URL', value => /^(redis|rediss):\/\//.test(value.trim()), 'configure Redis for distributed coordination and durable jobs');
requireEnv('S3_BUCKET', value => value.trim().length > 0, 'configure the durable object-storage bucket');
requireEnv('S3_ACCESS_KEY_ID', value => value.trim().length > 0 || String(process.env.R2_ACCESS_KEY_ID || '').trim().length > 0, 'configure object-storage credentials');
requireEnv('S3_SECRET_ACCESS_KEY', value => value.trim().length > 0 || String(process.env.R2_SECRET_ACCESS_KEY || '').trim().length > 0, 'configure object-storage credentials');
requireEnv('S3_ENDPOINT', value => value.trim().length > 0 || String(process.env.R2_ENDPOINT || '').trim().length > 0, 'configure the S3/R2 endpoint');
requireEnv('TOKEN_ENCRYPTION_KEY', value => value.length >= 32, 'set a random encryption key of at least 32 characters for OAuth tokens');

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

if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) warnings.push('Email delivery is not configured; verification and password reset cannot send production email.');
if (!process.env.OPENAI_API_KEY) warnings.push('OPENAI_API_KEY is not configured; AI answers use the local memory search fallback.');
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) warnings.push('Google OAuth is not fully configured; provider imports remain disabled.');
if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) warnings.push('OTEL exporter is not configured; external metrics/traces are unavailable.');
if (!process.env.CLAMAV_URL) warnings.push('CLAMAV_URL is not configured; uploaded media malware scanning is unavailable.');
if (!process.env.FFMPEG_PATH) warnings.push('FFMPEG_PATH is not configured; production video transcoding is unavailable.');

if (failures.length) {
  console.error('Life Replay preflight FAILED');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Life Replay preflight PASSED');
warnings.forEach(item => console.warn(`WARN: ${item}`));
