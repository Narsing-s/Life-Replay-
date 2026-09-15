const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const featureRoutes = require('./feature-routes');

const PORT = process.env.PORT || 4173;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length ? configuredOrigins : [
  'https://narsing-s.github.io',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:3000'
];
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'change-me-in-production') throw new Error('JWT_SECRET must be configured in production');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'life-replay.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, caption TEXT NOT NULL, place TEXT NOT NULL, date TEXT NOT NULL, media_url TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS share_links (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
`);

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = !origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) || /^https?:\/\/localhost(?::\d+)?$/.test(origin);
  if (origin && allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

const upload = multer({
  storage: multer.diskStorage({ destination: (_, __, cb) => cb(null, UPLOAD_DIR), filename: (_, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 100 * 1024 * 1024) },
  fileFilter: (_, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif|heic|heif)|video\/|audio\/|application\/pdf)$/.test(file.mimetype))
});
const publicUser = row => ({ id: row.id, email: row.email, name: row.name, createdAt: row.created_at });
function tokenFor(user) { return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' }); }
function auth(req, res, next) {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = db.prepare('SELECT * FROM users WHERE id=?').get(jwt.verify(value.slice(7), JWT_SECRET).sub); if (!req.user) throw new Error(); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired session' }); }
}

app.get('/api/config', (_, res) => res.json({ googleClientId: GOOGLE_CLIENT_ID }));
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'life-replay', time: new Date().toISOString() }));
app.get('/api/health/ready', (_, res) => { try { db.prepare('SELECT 1').get(); res.json({ ok: true, database: true }); } catch { res.status(503).json({ ok: false, database: false }); } });
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '') || !password || password.length < 8 || !(name || '').trim()) return res.status(400).json({ error: 'Name, valid email and password (8+ characters) are required' });
  const normalizedEmail = email.toLowerCase().trim();
  if (db.prepare('SELECT id FROM users WHERE email=?').get(normalizedEmail)) return res.status(409).json({ error: 'An account already exists for this email' });
  const user = { id: crypto.randomUUID(), email: normalizedEmail, name: name.trim(), password_hash: await bcrypt.hash(password, 12), created_at: new Date().toISOString() };
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(user.id, user.email, user.password_hash, user.name, user.created_at);
  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
});
app.post('/api/auth/login', async (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body?.email || '').toLowerCase().trim());
  if (!row || !(await bcrypt.compare(req.body?.password || '', row.password_hash))) return res.status(401).json({ error: 'Incorrect email or password' });
  res.json({ user: publicUser(row), token: tokenFor(row) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/memories', auth, (req, res) => res.json({ memories: db.prepare('SELECT id,title,caption,place,date,media_url AS mediaUrl,created_at AS createdAt FROM memories WHERE user_id=? ORDER BY date DESC,created_at DESC').all(req.user.id) }));
app.post('/api/memories', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A media file is required' });
  const memory = { id: crypto.randomUUID(), title: (req.body.title || 'A moment worth remembering').slice(0,120), caption: (req.body.caption || 'Captured and kept.').slice(0,500), place: (req.body.place || 'My memories').slice(0,120), date: /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : new Date().toISOString().slice(0,10), media_url: `/uploads/${req.file.filename}`, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO memories VALUES (?,?,?,?,?,?,?,?)').run(memory.id, req.user.id, memory.title, memory.caption, memory.place, memory.date, memory.media_url, memory.created_at);
  res.status(201).json({ memory: { ...memory, mediaUrl: memory.media_url, createdAt: memory.created_at } });
});
app.delete('/api/memories/:id', auth, (req, res) => {
  const row = db.prepare('SELECT media_url FROM memories WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Memory not found' });
  db.prepare('DELETE FROM memories WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  const file = path.join(UPLOAD_DIR, path.basename(row.media_url)); if (fs.existsSync(file)) fs.unlinkSync(file);
  res.status(204).end();
});
app.post('/api/share', auth, (req, res) => { const token = crypto.randomBytes(18).toString('base64url'); db.prepare('INSERT INTO share_links VALUES (?,?,?,?)').run(token, req.user.id, new Date().toISOString(), null); res.status(201).json({ token, url: `${req.protocol}://${req.get('host')}/share/${token}` }); });
app.get('/api/share/:token', (req, res) => { const link = db.prepare('SELECT * FROM share_links WHERE token=?').get(req.params.token); if (!link) return res.status(404).json({ error: 'Story not found' }); const owner = db.prepare('SELECT id,name FROM users WHERE id=?').get(link.user_id); const memories = db.prepare('SELECT title,caption,place,date,media_url AS mediaUrl FROM memories WHERE user_id=? ORDER BY date DESC').all(link.user_id); res.json({ owner, memories }); });
app.get('/share/:token', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Install the full v1 feature surface explicitly. This replaces the old fragile Express listen monkey-patch.
featureRoutes({ app, db, auth });

// Stable v1 compatibility endpoints used by the enhanced UI.
app.get('/api/v1/export', auth, (req, res) => {
  const memories = db.prepare('SELECT * FROM memories WHERE user_id=? ORDER BY date DESC, created_at DESC').all(req.user.id);
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(req.user.id) || null;
  const tags = db.prepare('SELECT * FROM tags WHERE user_id=?').all(req.user.id);
  const people = db.prepare('SELECT * FROM people WHERE user_id=?').all(req.user.id);
  const locations = db.prepare('SELECT * FROM locations WHERE user_id=?').all(req.user.id);
  res.json({ exportedAt: new Date().toISOString(), user: publicUser(req.user), profile, memories, tags, people, locations });
});

app.post('/api/v1/ai/ask', auth, (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });
  const rows = db.prepare(`SELECT m.*, mm.summary, mm.category, mm.mood FROM memories m LEFT JOIN memory_meta mm ON mm.memory_id=m.id WHERE m.user_id=? AND COALESCE(mm.deleted_at,'')='' ORDER BY m.date DESC`).all(req.user.id);
  const q = question.toLowerCase();
  let selected = rows;
  const year = q.match(/\b(20\d{2})\b/)?.[1];
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month = monthNames.findIndex(m => q.includes(m));
  if (year) selected = selected.filter(m => String(m.date).startsWith(year));
  if (month >= 0) selected = selected.filter(m => Number(String(m.date).slice(5,7)) === month + 1);
  const terms = q.replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x => x.length > 2 && !['show','find','what','did','with','from','about','my','life','memories','memory','this','that','have'].includes(x));
  if (terms.length) {
    const filtered = selected.filter(m => terms.some(t => `${m.title} ${m.caption} ${m.place} ${m.summary||''} ${m.category||''} ${m.mood||''}`.toLowerCase().includes(t)));
    if (filtered.length) selected = filtered;
  }
  const answer = selected.length
    ? `I found ${selected.length} matching memor${selected.length === 1 ? 'y' : 'ies'}. ` + selected.slice(0,8).map(m => `${m.title} (${m.date}${m.place ? `, ${m.place}` : ''})`).join('; ')
    : 'I could not find a matching memory in your timeline yet.';
  res.json({ answer, count: selected.length, memories: selected.slice(0,50) });
});

app.get('/api/v1/map', auth, (req, res) => {
  const locations = db.prepare(`SELECT DISTINCT COALESCE(mm.address,m.place) name, mm.lat, mm.lng, m.date, m.title FROM memories m LEFT JOIN memory_meta mm ON mm.memory_id=m.id WHERE m.user_id=? AND mm.deleted_at IS NULL AND (mm.lat IS NOT NULL OR mm.lng IS NOT NULL OR mm.address IS NOT NULL OR m.place<>'') ORDER BY m.date DESC`).all(req.user.id);
  res.json({ locations });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large. Please choose an image/video/audio file within the upload limit.' });
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' }); res.sendFile(path.join(__dirname, 'index.html')); });
app.listen(PORT, '0.0.0.0', () => console.log(`Life Replay listening on 0.0.0.0:${PORT}`));
