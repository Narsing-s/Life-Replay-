const crypto = require('crypto');
const jwt = require('jsonwebtoken');

module.exports = function integrationRoutes({ app, db, auth }) {
  const now=()=>new Date().toISOString();
  const cfg=()=>({ clientId:String(process.env.GOOGLE_CLIENT_ID||''),clientSecret:String(process.env.GOOGLE_CLIENT_SECRET||''),redirectUri:String(process.env.GOOGLE_REDIRECT_URI||''),frontend:String(process.env.FRONTEND_URL||'').replace(/\/$/,'') });
  const key=()=>{const raw=String(process.env.TOKEN_ENCRYPTION_KEY||'');return raw?crypto.createHash('sha256').update(raw).digest():null;};
  const encrypt=value=>{const k=key();if(!k)throw new Error('TOKEN_ENCRYPTION_KEY is required');const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv);const data=Buffer.concat([c.update(String(value),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');};
  const decrypt=value=>{const k=key();if(!k)throw new Error('TOKEN_ENCRYPTION_KEY is required');const b=Buffer.from(value,'base64'),iv=b.subarray(0,12),tag=b.subarray(12,28),data=b.subarray(28),d=crypto.createDecipheriv('aes-256-gcm',k,iv);d.setAuthTag(tag);return Buffer.concat([d.update(data),d.final()]).toString('utf8');};

  db.exec(`CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY,user_id TEXT NOT NULL,provider TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS integrations (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,provider TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',encrypted_access_token TEXT,encrypted_refresh_token TEXT,expires_at TEXT,scopes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,provider));`);

  app.get('/api/v1/integrations/google/start',auth,(req,res)=>{
    const c=cfg(); if(!c.clientId||!c.redirectUri)return res.status(503).json({error:'Google OAuth is not configured'});
    if(!key())return res.status(503).json({error:'TOKEN_ENCRYPTION_KEY is not configured'});
    const state=crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO oauth_states VALUES(?,?,?,?,?)').run(state,req.user.id,'google',new Date(Date.now()+10*60*1000).toISOString(),now());
    const scope=process.env.GOOGLE_OAUTH_SCOPE||'https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly';
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id',c.clientId);url.searchParams.set('redirect_uri',c.redirectUri);url.searchParams.set('response_type','code');url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');url.searchParams.set('scope',scope);url.searchParams.set('state',state);
    res.json({url:url.toString()});
  });

  app.get('/api/v1/integrations/google/callback',async(req,res)=>{
    const state=String(req.query.state||''),code=String(req.query.code||'');
    const s=db.prepare('SELECT * FROM oauth_states WHERE state=? AND provider=? AND expires_at>?').get(state,'google',now());
    if(!s||!code)return res.status(400).send('Invalid or expired OAuth state');
    db.prepare('DELETE FROM oauth_states WHERE state=?').run(state);
    const c=cfg();
    try{
      const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw new Error(`Google token exchange failed: ${r.status}`);
      const t=await r.json(); const created=now();
      db.prepare(`INSERT INTO integrations(id,user_id,provider,status,encrypted_access_token,encrypted_refresh_token,expires_at,scopes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET status='active',encrypted_access_token=excluded.encrypted_access_token,encrypted_refresh_token=COALESCE(excluded.encrypted_refresh_token,integrations.encrypted_refresh_token),expires_at=excluded.expires_at,scopes=excluded.scopes,updated_at=excluded.updated_at`).run(crypto.randomUUID(),s.user_id,'google','active',encrypt(t.access_token),t.refresh_token?encrypt(t.refresh_token):null,new Date(Date.now()+Number(t.expires_in||3600)*1000).toISOString(),String(t.scope||''),created,created);
      res.redirect(`${c.frontend||c.redirectUri}?google=connected`);
    }catch{res.status(502).send('Google authorization could not be completed');}
  });

  app.get('/api/v1/integrations',auth,(req,res)=>res.json({integrations:db.prepare('SELECT provider,status,expires_at expiresAt,scopes,created_at createdAt,updated_at updatedAt FROM integrations WHERE user_id=?').all(req.user.id)}));
  app.delete('/api/v1/integrations/google',auth,(req,res)=>{db.prepare('DELETE FROM integrations WHERE user_id=? AND provider=?').run(req.user.id,'google');res.status(204).end();});

  app.post('/api/v1/realtime/token',auth,(req,res)=>{
    const secret=String(process.env.JWT_SECRET||'');
    if(secret.length<32||secret==='change-me-in-production')return res.status(503).json({error:'JWT_SECRET is not configured'});
    const token=jwt.sign({sub:req.user.id,purpose:'realtime'},secret,{expiresIn:'60s'});
    res.json({token,expiresIn:60});
  });

  // Internal helper for future Google import workers. Tokens never leave the server in API responses.
  app.locals.getGoogleIntegration=async userId=>{const row=db.prepare('SELECT * FROM integrations WHERE user_id=? AND provider=? AND status=?').get(userId,'google','active');if(!row)return null;return {...row,accessToken:decrypt(row.encrypted_access_token),refreshToken:row.encrypted_refresh_token?decrypt(row.encrypted_refresh_token):null};};
};
