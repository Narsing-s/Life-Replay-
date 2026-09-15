const crypto = require('crypto');
const bcrypt = require('bcryptjs');

module.exports = function productionHardening({ app, db, auth, jwtSecret }) {
  const now = () => new Date().toISOString();
  const id = () => crypto.randomUUID();
  const sha = value => crypto.createHash('sha256').update(value).digest('hex');
  const tokens = new Map();
  const attempts = new Map();
  const limit = Number(process.env.AUTH_RATE_LIMIT || 8);
  const windowMs = Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000);

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS password_resets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS security_events (id TEXT PRIMARY KEY, user_id TEXT, event TEXT NOT NULL, ip TEXT, user_agent TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, user_id TEXT, type TEXT NOT NULL, status TEXT DEFAULT 'queued', payload TEXT, result TEXT, attempts INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  function rate(req, key) {
    const k = `${key}:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
    const t = Date.now();
    const a = attempts.get(k) || [];
    const fresh = a.filter(x => t - x < windowMs);
    fresh.push(t); attempts.set(k, fresh);
    return fresh.length <= limit;
  }
  function security(userId, event, req) {
    db.prepare('INSERT INTO security_events VALUES(?,?,?,?,?,?)').run(id(), userId || null, event, req.ip || '', req.headers['user-agent'] || '', now());
  }

  app.post('/api/v1/auth/change-password', auth, async (req, res) => {
    const current = String(req.body?.currentPassword || '');
    const next = String(req.body?.newPassword || '');
    if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    if (!(await bcrypt.compare(current, req.user.password_hash))) return res.status(401).json({ error: 'Current password is incorrect' });
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(next, 12), req.user.id);
    db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').run(now(), req.user.id);
    security(req.user.id, 'password.changed', req);
    res.json({ ok: true, message: 'Password changed. Other sessions were signed out.' });
  });

  app.post('/api/v1/auth/verify/request', auth, (req, res) => {
    const raw = crypto.randomBytes(32).toString('base64url');
    const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM email_verifications WHERE user_id=? AND verified_at IS NULL').run(req.user.id);
    db.prepare('INSERT INTO email_verifications VALUES(?,?,?,?,?,?)').run(id(), req.user.id, sha(raw), exp, null, now());
    security(req.user.id, 'verification.requested', req);
    const response = { ok: true, expiresAt: exp };
    if (process.env.NODE_ENV !== 'production') response.developmentToken = raw;
    res.status(202).json(response);
  });

  app.post('/api/v1/auth/verify', (req, res) => {
    const row = db.prepare('SELECT * FROM email_verifications WHERE token_hash=? AND verified_at IS NULL').get(sha(String(req.body?.token || '')));
    if (!row || new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Verification token is invalid or expired' });
    db.prepare('UPDATE email_verifications SET verified_at=? WHERE id=?').run(now(), row.id);
    res.json({ ok: true, verified: true });
  });

  app.post('/api/v1/auth/password-reset/request', (req, res) => {
    if (!rate(req, 'password-reset')) return res.status(429).json({ error: 'Too many reset requests. Try again later.' });
    const email = String(req.body?.email || '').toLowerCase().trim();
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    const response = { ok: true, message: 'If an account exists, reset instructions have been created.' };
    if (user) {
      const raw = crypto.randomBytes(32).toString('base64url');
      const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('DELETE FROM password_resets WHERE user_id=? AND used_at IS NULL').run(user.id);
      db.prepare('INSERT INTO password_resets VALUES(?,?,?,?,?,?)').run(id(), user.id, sha(raw), exp, null, now());
      if (process.env.NODE_ENV !== 'production') response.developmentToken = raw;
      security(user.id, 'password.reset.requested', req);
    }
    res.status(202).json(response);
  });

  app.post('/api/v1/auth/password-reset/confirm', async (req, res) => {
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL').get(sha(String(req.body?.token || '')));
    const password = String(req.body?.newPassword || '');
    if (!row || new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Reset token is invalid or expired' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(password, 12), row.user_id);
    db.prepare('UPDATE password_resets SET used_at=? WHERE id=?').run(now(), row.id);
    db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').run(now(), row.user_id);
    security(row.user_id, 'password.reset.completed', req);
    res.json({ ok: true });
  });

  app.get('/api/v1/security/events', auth, (req, res) => res.json({ events: db.prepare('SELECT event,ip,user_agent userAgent,created_at createdAt FROM security_events WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id) }));
  app.get('/api/v1/jobs', auth, (req, res) => res.json({ jobs: db.prepare('SELECT id,type,status,attempts,created_at createdAt,updated_at updatedAt FROM jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id) }));
  app.get('/api/v1/map', auth, (req, res) => res.json({ locations: db.prepare('SELECT l.*,COUNT(ml.memory_id) memoryCount FROM locations l LEFT JOIN memory_locations ml ON ml.location_id=l.id WHERE l.user_id=? GROUP BY l.id ORDER BY l.name').all(req.user.id) }));
  app.get('/api/v1/trash', auth, (req, res) => res.json({ memories: db.prepare(`SELECT m.*,mm.deleted_at deletedAt FROM memories m JOIN memory_meta mm ON mm.memory_id=m.id WHERE m.user_id=? AND mm.deleted_at IS NOT NULL ORDER BY mm.deleted_at DESC`).all(req.user.id) }));

  app.get('/api/v1/backup/status', auth, (req, res) => res.json({ enabled: process.env.BACKUP_ENABLED === 'true', provider: process.env.BACKUP_PROVIDER || 'filesystem', note: 'Production backups should target managed object storage or database backups; container-local storage is not durable.' }));
  app.get('/api/v1/storage/status', auth, (req, res) => res.json({ provider: process.env.STORAGE_PROVIDER || 'local', objectStorageConfigured: Boolean(process.env.OBJECT_STORAGE_BUCKET), note: 'Configure S3-compatible object storage for durable production media.' }));
  app.get('/api/v1/ai/status', auth, (req, res) => res.json({ configured: Boolean(process.env.OPENAI_API_KEY), provider: process.env.AI_PROVIDER || 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', authorizedUserScope: true }));

  app.use((err, req, res, next) => {
    console.error(JSON.stringify({ requestId: req.requestId, error: err.message, path: req.path }));
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error', requestId: req.requestId });
  });
};
