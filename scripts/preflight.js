const fs = require('fs');
const path = require('path');

const production = process.env.NODE_ENV === 'production';
const failures = [];
const warnings = [];
const value = name => String(process.env[name] || '').trim();

function requireEnv(name, predicate, message) {
  const v = value(name);
  if (!v || !predicate(v)) failures.push(`${name}: ${message}`);
}

if (!production) {
  console.log('Life Replay preflight: development mode; production-only secret checks are skipped.');
  process.exit(0);
}

requireEnv('JWT_SECRET', v => v.length >= 32 && v !== 'change-me-in-production', 'set a random secret of at least 32 characters');
requireEnv('ALLOWED_ORIGINS', v => v.split(',').some(x => /^https:\/\//.test(x.trim())), 'configure at least one HTTPS frontend origin');
requireEnv('FRONTEND_URL', v => /^https:\/\//.test(v), 'configure the HTTPS frontend URL for password reset and verification links');
requireEnv('DATA_DIR', v => path.isAbsolute(v), 'use an absolute persistent-volume path in production');
requireEnv('DATABASE_URL', v => /^postgres(?:ql)?:\/\//.test(v), 'configure the managed PostgreSQL connection string');
requireEnv('REDIS_URL', v => /^(redis|rediss):\/\//.test(v), 'configure Redis for distributed coordination and durable jobs');
requireEnv('S3_BUCKET', v => v.length > 0, 'configure the durable object-storage bucket');
if (!(value('S3_ENDPOINT') || value('R2_ENDPOINT'))) failures.push('S3_ENDPOINT/R2_ENDPOINT: configure the durable object-storage endpoint');
if (!(value('S3_ACCESS_KEY_ID') || value('R2_ACCESS_KEY_ID'))) failures.push('S3_ACCESS_KEY_ID/R2_ACCESS_KEY_ID: configure object-storage credentials');
if (!(value('S3_SECRET_ACCESS_KEY') || value('R2_SECRET_ACCESS_KEY'))) failures.push('S3_SECRET_ACCESS_KEY/R2_SECRET_ACCESS_KEY: configure object-storage credentials');
requireEnv('TOKEN_ENCRYPTION_KEY', v => v.length >= 32, 'set a random encryption key of at least 32 characters for OAuth tokens');

const dataDir = value('DATA_DIR');
try {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
} catch (error) {
  failures.push(`DATA_DIR: ${error.message}`);
}
if (/^(?:\.\/?|\/tmp(?:\/|$))/.test(dataDir)) warnings.push('DATA_DIR appears ephemeral; configure a persistent volume before accepting real memories.');

if (!value('RESEND_API_KEY') || !value('EMAIL_FROM')) warnings.push('Email delivery is not configured; verification and password reset cannot send production email.');
if (!value('OPENAI_API_KEY')) warnings.push('OPENAI_API_KEY is not configured; AI answers use the local memory search fallback.');
if (!value('GOOGLE_CLIENT_ID') || !value('GOOGLE_CLIENT_SECRET') || !value('GOOGLE_REDIRECT_URI')) warnings.push('Google OAuth is not fully configured; provider imports remain disabled.');
if (!value('OTEL_EXPORTER_OTLP_ENDPOINT')) warnings.push('OTEL exporter is not configured; external metrics/traces are unavailable.');
if (!value('CLAMAV_URL')) warnings.push('CLAMAV_URL is not configured; uploaded media malware scanning is unavailable.');
if (!value('FFMPEG_PATH')) warnings.push('FFMPEG_PATH is not configured; production video transcoding is unavailable.');

if (failures.length) {
  console.error('Life Replay preflight FAILED');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Life Replay preflight PASSED');
warnings.forEach(item => console.warn(`WARN: ${item}`));
