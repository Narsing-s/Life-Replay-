const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 4173;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'life-replay.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, caption TEXT NOT NULL, place TEXT NOT NULL, date TEXT NOT NULL, media_url TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS share_links (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
`);

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
app.use(express.static(__dirname, { extensions: ['html'] }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.mimetype))
});

const publicUser = row => ({ id: row.id, email: row.email, name: row.name, createdAt: row.created_at });
function tokenFor(user) { return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' }); }
function auth(req, res, next) {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = db.prepare('SELECT * FROM users WHERE id=?').get(jwt.verify(value.slice(7), JWT_SECRET).sub); if (!req.user) throw new Error(); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired session' }); }
}

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'life-replay', time: new Date().toISOString() }));
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '') || !password || password.length < 8 || !(name || '').trim()) return res.status(400).json({ error: 'Name, valid email and password (8+ characters) are required' });
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'An account already exists for this email' });
  const user = { id: crypto.randomUUID(), email: email.toLowerCase(), name: name.trim(), password_hash: await bcrypt.hash(password, 12), created_at: new Date().toISOString() };
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(user.id, user.email, user.password_hash, user.name, user.created_at);
  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
});
app.post('/api/auth/login', async (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body?.email || '').toLowerCase());
  if (!row || !(await bcrypt.compare(req.body?.password || '', row.password_hash))) return res.status(401).json({ error: 'Incorrect email or password' });
  res.json({ user: publicUser(row), token: tokenFor(row) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/memories', auth, (req, res) => res.json({ memories: db.prepare('SELECT id,title,caption,place,date,media_url AS mediaUrl,created_at AS createdAt FROM memories WHERE user_id=? ORDER BY date DESC,created_at DESC').all(req.user.id) }));
app.post('/api/memories', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An image is required' });
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
app.post('/api/share', auth, (req, res) => {
  const token = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO share_links VALUES (?,?,?,?)').run(token, req.user.id, new Date().toISOString(), null);
  res.status(201).json({ token, url: `${req.protocol}://${req.get('host')}/share/${token}` });
});
app.get('/api/share/:token', (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE token=?').get(req.params.token);
  if (!link) return res.status(404).json({ error: 'Story not found' });
  const user = db.prepare('SELECT id,name FROM users WHERE id=?').get(link.user_id);
  const memories = db.prepare('SELECT title,caption,place,date,media_url AS mediaUrl FROM memories WHERE user_id=? ORDER BY date DESC').all(link.user_id);
  res.json({ owner: user, memories });
});

app.get('/share/:token', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`Life Replay listening on :${PORT}`));
