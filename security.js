const crypto = require('crypto');
const { productionConfig } = require('./platform-config');

const buckets = new Map();
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 300);
const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
let redis = null;
let redisFailed = false;

function clientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function getRedis() {
  if (!process.env.REDIS_URL || redisFailed) return null;
  if (!redis) {
    try {
      const IORedis = require('ioredis');
      redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
      redis.on('error', () => { redisFailed = true; });
    } catch { redisFailed = true; }
  }
  return redis;
}

async function redisCount(key, limit) {
  const r = getRedis();
  if (!r) return null;
  try {
    if (r.status === 'wait') await r.connect();
    const script = `local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return {c,redis.call('PTTL',KEYS[1])}`;
    const result = await r.eval(script, 1, key, String(WINDOW_MS));
    return { count: Number(result[0]), ttl: Number(result[1]) };
  } catch { redisFailed = true; return null; }
}

function localCount(key) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.started >= WINDOW_MS) bucket = { started: now, count: 0 };
  bucket.count += 1; buckets.set(key, bucket);
  return { count: bucket.count, ttl: Math.max(1, bucket.started + WINDOW_MS - now) };
}

function limiter(limit, prefix) {
  return async (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true') return next();
    const key = `life-replay:ratelimit:${prefix}:${clientKey(req)}`;
    const result = await redisCount(key, limit) || localCount(key);
    if (result.count > limit) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(result.ttl / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - result.count));
    next();
  };
}

function requestId(req, res, next) {
  const supplied = String(req.headers['x-request-id'] || '').trim();
  const id = /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}

function cleanup() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, bucket] of buckets) if (bucket.started < cutoff) buckets.delete(key);
}
setInterval(cleanup, WINDOW_MS).unref();

module.exports = { requestId, securityHeaders, apiLimiter: limiter(MAX_REQUESTS, 'api'), authLimiter: limiter(AUTH_MAX, 'auth') };
