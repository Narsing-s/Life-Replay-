const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const backupRoot = process.argv[2];
if (!backupRoot) {
  console.error('Usage: node scripts/restore-check.js <backup-directory>');
  process.exit(2);
}
const manifestPath = path.join(backupRoot, 'manifest.json');
const dbPath = path.join(backupRoot, 'life-replay.db');
if (!fs.existsSync(manifestPath) || !fs.existsSync(dbPath)) {
  console.error('Backup is incomplete: manifest.json and life-replay.db are required.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const db = new Database(dbPath, { readonly: true });
try {
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
  const users = db.prepare('SELECT COUNT(*) count FROM users').get().count;
  const memories = db.prepare('SELECT COUNT(*) count FROM memories').get().count;
  console.log(JSON.stringify({ ok: true, backupRoot, createdAt: manifest.createdAt, users, memories }, null, 2));
} finally { db.close(); }
