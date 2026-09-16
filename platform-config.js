const crypto = require('crypto');

function value(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function required(name) {
  const v = value(name);
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function bool(name, fallback = false) {
  const raw = value(name, fallback ? 'true' : 'false').toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function productionConfig() {
  return {
    env: value('NODE_ENV', 'development'),
    frontendUrl: value('FRONTEND_URL', 'http://localhost:4173'),
    databaseUrl: value('DATABASE_URL'),
    redisUrl: value('REDIS_URL'),
    objectStorage: {
      endpoint: value('S3_ENDPOINT') || value('R2_ENDPOINT'),
      region: value('S3_REGION', 'auto'),
      bucket: value('S3_BUCKET'),
      accessKeyId: value('S3_ACCESS_KEY_ID') || value('R2_ACCESS_KEY_ID'),
      secretAccessKey: value('S3_SECRET_ACCESS_KEY') || value('R2_SECRET_ACCESS_KEY'),
      forcePathStyle: bool('S3_FORCE_PATH_STYLE', false)
    },
    email: { apiKey: value('RESEND_API_KEY'), from: value('EMAIL_FROM') },
    ai: { apiKey: value('OPENAI_API_KEY'), baseUrl: value('OPENAI_BASE_URL', 'https://api.openai.com/v1'), model: value('OPENAI_MODEL', 'gpt-4o-mini'), embeddingModel: value('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small') },
    media: { maxBytes: Number(value('MAX_MEDIA_BYTES', 250 * 1024 * 1024)), ffmpeg: value('FFMPEG_PATH', 'ffmpeg'), clamavUrl: value('CLAMAV_URL') },
    observability: { otlpEndpoint: value('OTEL_EXPORTER_OTLP_ENDPOINT') },
    security: { cookieMode: bool('USE_HTTPONLY_COOKIES', false), accessTtl: value('ACCESS_TOKEN_TTL', '15m'), refreshTtlDays: Number(value('REFRESH_TOKEN_TTL_DAYS', 30)), encryptionKey: value('TOKEN_ENCRYPTION_KEY') }
  };
}

function assertProductionSecrets(config = productionConfig()) {
  if (config.env !== 'production') return;
  if (value('JWT_SECRET').length < 32 || value('JWT_SECRET') === 'change-me-in-production') throw new Error('JWT_SECRET must be a random value of at least 32 characters');
  if (!config.frontendUrl.startsWith('https://')) throw new Error('FRONTEND_URL must be HTTPS in production');
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for production shared database');
  if (!config.redisUrl) throw new Error('REDIS_URL is required for distributed coordination');
  if (!config.objectStorage.endpoint || !config.objectStorage.bucket || !config.objectStorage.accessKeyId || !config.objectStorage.secretAccessKey) throw new Error('S3/R2 object storage is required for production media durability');
  if (config.security.cookieMode && !config.security.encryptionKey) throw new Error('TOKEN_ENCRYPTION_KEY is required when secure cookie mode is enabled');
}

function encryptionKey() {
  const raw = value('TOKEN_ENCRYPTION_KEY');
  return raw ? crypto.createHash('sha256').update(raw).digest() : null;
}

module.exports = { value, required, bool, productionConfig, assertProductionSecrets, encryptionKey };
