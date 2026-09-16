const crypto = require('crypto');

// Process-local limiter. This protects a single instance; use a shared store
// (Redis/managed rate-limit service) when running multiple API replicas.
const buckets = new Map();
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 300);
const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);

function clientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function limiter(limit, prefix) {
  return (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true') return next();
    const key = `${prefix}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.started >= WINDOW_MS) bucket = { started: now, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.started + WINDOW_MS - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count));
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
