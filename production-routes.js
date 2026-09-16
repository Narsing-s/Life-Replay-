const crypto = require('crypto');
const { sendEmail, askLLM, embed, randomToken, sha256, providerStatus, env } = require('./production-services');

module.exports = function productionRoutes({ app, db, auth }) {
  const now = () => new Date().toISOString();

  db.exec(`
    CREATE TABLE IF NOT EXISTS account_tokens (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL,
      consumed_at TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_account_tokens_user_type ON account_tokens(user_id,type);
  `);

  const issueToken = (userId, type, ttlMs) => {
    const raw = randomToken(32);
    db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), userId, type, sha256(raw), new Date(Date.now() + ttlMs).toISOString(), null, now());
    return raw;
  };

  const consumeToken = (raw, type) => {
    const row = db.prepare('SELECT * FROM account_tokens WHERE token_hash=? AND type=? AND consumed_at IS NULL AND expires_at>?').get(sha256(raw), type, now());
    if (!row) return null;
    db.prepare('UPDATE account_tokens SET consumed_at=? WHERE id=?').run(now(), row.id);
    return row;
  };

  app.get('/api/health/providers', (_, res) => res.json({ ok: true, providers: providerStatus() }));

  app.post('/api/auth/verify-email/request', auth, async (req, res) => {
    const token = issueToken(req.user.id, 'email-verification', 24 * 60 * 60 * 1000);
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/confirm?token=${encodeURIComponent(token)}`;
    try {
      await sendEmail({
        to: req.user.email,
        subject: 'Verify your Life Replay email',
        html: `<p>Hello ${escapeHtml(req.user.name)},</p><p>Verify your Life Replay email address:</p><p><a href="${escapeHtml(verifyUrl)}">Verify email</a></p><p>This link expires in 24 hours.</p>`
      });
      res.json({ ok: true, delivery: 'email' });
    } catch (e) {
      db.prepare('DELETE FROM account_tokens WHERE token_hash=?').run(sha256(token));
      res.status(503).json({ error: 'Email delivery is not configured', detail: process.env.NODE_ENV === 'production' ? undefined : e.message });
    }
  });

  app.get('/api/auth/verify-email/confirm', async (req, res) => {
    const row = consumeToken(String(req.query.token || ''), 'email-verification');
    if (!row) return res.status(400).json({ error: 'Invalid or expired verification token' });
    res.json({ ok: true, verified: true });
  });

  app.post('/api/auth/password-reset/request', authOptional, async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const user = db.prepare('SELECT id,email,name FROM users WHERE email=?').get(email);
    // Always return the same public response to prevent account enumeration.
    if (!user) return res.json({ ok: true });
    const token = issueToken(user.id, 'password-reset', 30 * 60 * 1000);
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Life Replay password',
        html: `<p>Hello ${escapeHtml(user.name)},</p><p>Reset your Life Replay password:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in 30 minutes and can only be used once.</p>`
      });
    } catch (e) {
      db.prepare('DELETE FROM account_tokens WHERE token_hash=?').run(sha256(token));
      if (process.env.NODE_ENV !== 'production') return res.json({ ok: true, delivery: 'not-configured', developmentToken: token });
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/password-reset/confirm', async (req, res) => {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const row = consumeToken(token, 'password-reset');
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });
    const bcrypt = require('bcryptjs');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(password, 12), row.user_id);
    // Invalidate all existing sessions after a password reset.
    try { db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').run(now(), row.user_id); } catch {}
    res.json({ ok: true });
  });

  app.post('/api/v1/ai/ask/llm', auth, async (req, res) => {
    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    const memories = db.prepare(`SELECT m.*,mm.summary,mm.category,mm.mood FROM memories m LEFT JOIN memory_meta mm ON mm.memory_id=m.id WHERE m.user_id=? AND COALESCE(mm.deleted_at,'')='' ORDER BY m.date DESC`).all(req.user.id);
    try {
      const answer = await askLLM({ question, memories });
      if (!answer) return res.status(503).json({ error: 'LLM provider is not configured' });
      res.json({ answer, provider: 'openai-compatible', count: memories.length });
    } catch (e) {
      res.status(502).json({ error: 'LLM provider request failed' });
    }
  });

  app.post('/api/v1/ai/embeddings', auth, async (req, res) => {
    const ids = Array.isArray(req.body?.memoryIds) ? req.body.memoryIds.slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ error: 'memoryIds is required' });
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT m.id,m.title,m.caption,m.place,m.date,COALESCE(mm.summary,'') summary FROM memories m LEFT JOIN memory_meta mm ON mm.memory_id=m.id WHERE m.user_id=? AND m.id IN (${placeholders})`).all(req.user.id, ...ids);
    try {
      const vectors = await embed(rows.map(m => `${m.title}\n${m.caption}\n${m.place}\n${m.date}\n${m.summary}`));
      if (!vectors) return res.status(503).json({ error: 'Embedding provider is not configured' });
      const insert = db.prepare('INSERT INTO embeddings(memory_id,user_id,text,vector_json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(memory_id) DO UPDATE SET text=excluded.text,vector_json=excluded.vector_json,created_at=excluded.created_at');
      const tx = db.transaction(() => rows.forEach((m, i) => insert.run(m.id, req.user.id, `${m.title}\n${m.caption}\n${m.place}\n${m.date}\n${m.summary}`, JSON.stringify(vectors[i]), now())));
      tx();
      res.json({ ok: true, count: rows.length });
    } catch { res.status(502).json({ error: 'Embedding provider request failed' }); }
  });

  app.get('/api/v1/storage/status', auth, (_, res) => {
    const dataDir = env('DATA_DIR');
    res.json({
      ok: true,
      writable: Boolean(dataDir),
      providers: providerStatus(),
      note: 'Provider configuration is reported here; external services must still be provisioned with deployment credentials.'
    });
  });
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function authOptional(req, res, next) {
  // Password-reset requests are intentionally unauthenticated. This middleware only marks the request as anonymous.
  req.user = null;
  next();
}
