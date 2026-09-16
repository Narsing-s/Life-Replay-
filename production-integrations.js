const crypto = require('crypto');
const { encryptionKey, productionConfig } = require('./platform-config');

function encrypt(value) {
  const key = encryptionKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is required');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}
function decrypt(value) {
  const key = encryptionKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is required');
  const b = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const iv = b.subarray(0, 12), tag = b.subarray(12, 28), data = b.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function installProductionIntegrations({ app, q, auth, id, now, storage, enqueue }) {
  const cfg = productionConfig();
  app.post('/api/v1/integrations/google/import', auth, async (req, res) => {
    const configured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI;
    if (!configured) return res.status(503).json({ error: 'Google OAuth is not configured' });
    const integration = await q('SELECT provider,status FROM integrations WHERE user_id=$1 AND provider=$2 AND status=$3', [req.user.id, 'google', 'active']);
    if (!integration.rowCount) return res.status(409).json({ error: 'Google Photos is not connected to this account' });
    const jobId = id();
    await q(`INSERT INTO import_jobs(id,user_id,provider,status,created_at) VALUES($1,$2,'google','queued',NOW())`, [jobId, req.user.id]);
    try {
      await enqueue('google-import', { userId: req.user.id, importJobId: jobId }, { jobId: `google-import-${jobId}` });
    } catch (error) {
      await q('UPDATE import_jobs SET status=$1,error=$2,updated_at=NOW() WHERE id=$3', ['failed', String(error.message).slice(0, 2000), jobId]).catch(() => {});
      return res.status(503).json({ error: 'Import queue is unavailable' });
    }
    res.status(202).json({ import: { id: jobId, provider: 'google', status: 'queued' } });
  });

  app.get('/api/v1/integrations/google/start', auth, async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) return res.status(503).json({ error: 'Google OAuth is not configured' });
    if (!encryptionKey()) return res.status(503).json({ error: 'TOKEN_ENCRYPTION_KEY is not configured' });
    const state = crypto.randomBytes(32).toString('base64url');
    await q(`CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL)`);
    await q('INSERT INTO oauth_states(state,user_id,provider,expires_at,created_at) VALUES($1,$2,$3,NOW()+INTERVAL \'10 minutes\',NOW())', [state, req.user.id, 'google']);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', process.env.GOOGLE_OAUTH_SCOPE || 'https://www.googleapis.com/auth/photoslibrary.readonly');
    url.searchParams.set('state', state);
    res.json({ url: url.toString() });
  });

  app.get('/api/v1/integrations/google/callback', async (req, res) => {
    const state = String(req.query.state || ''), code = String(req.query.code || '');
    if (!state || !code) return res.status(400).send('Invalid OAuth callback');
    const stateRow = await q('SELECT * FROM oauth_states WHERE state=$1 AND provider=$2 AND expires_at>NOW()', [state, 'google']);
    if (!stateRow.rowCount) return res.status(400).send('Invalid or expired OAuth state');
    await q('DELETE FROM oauth_states WHERE state=$1', [state]);
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }), signal: AbortSignal.timeout(15000) });
      if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
      const token = await tokenResponse.json();
      const access = encrypt(token.access_token);
      const refresh = token.refresh_token ? encrypt(token.refresh_token) : null;
      await q(`INSERT INTO integrations(id,user_id,provider,status,encrypted_access_token,encrypted_refresh_token,expires_at,scopes,created_at,updated_at)
        VALUES($1,$2,'google','active',$3,$4,NOW()+($5||' seconds')::interval,$6,NOW(),NOW())
        ON CONFLICT(user_id,provider) DO UPDATE SET status='active',encrypted_access_token=EXCLUDED.encrypted_access_token,encrypted_refresh_token=COALESCE(EXCLUDED.encrypted_refresh_token,integrations.encrypted_refresh_token),expires_at=EXCLUDED.expires_at,scopes=EXCLUDED.scopes,updated_at=NOW()`,
        [id(), stateRow.rows[0].user_id, access, refresh, String(Number(token.expires_in || 3600)), String(token.scope || '')]);
      res.redirect(`${cfg.frontendUrl.replace(/\/$/, '')}/?google=connected`);
    } catch (error) {
      res.status(502).send('Google authorization could not be completed');
    }
  });

  app.delete('/api/v1/integrations/google', auth, async (req, res) => {
    await q('DELETE FROM integrations WHERE user_id=$1 AND provider=$2', [req.user.id, 'google']);
    res.status(204).end();
  });
}

module.exports = { installProductionIntegrations, encrypt, decrypt };
