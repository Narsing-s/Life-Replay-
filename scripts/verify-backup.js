const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const backupDir = process.argv[2];
if (!backupDir) {
  console.error('Usage: node scripts/verify-backup.js <backup-directory>');
  process.exit(2);
}

const root = path.resolve(backupDir);
const manifestPath = path.join(root, 'manifest.json');
const dbPath = path.join(root, 'life-replay.db');
if (!fs.existsSync(manifestPath) || !fs.existsSync(dbPath)) {
  console.error('Backup is incomplete: manifest.json and life-replay.db are required');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const db = new Database(dbPath, { readonly: true });
const integrity = db.pragma('integrity_check', { simple: true });
const users = db.prepare('SELECT COUNT(*) count FROM users').get().count;
const memories = db.prepare('SELECT COUNT(*) count FROM memories').get().count;
db.close();

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const checksumResults = [];
for (const [relative, expected] of Object.entries(manifest.checksums || {})) {
  const file = path.join(root, relative);
  const actual = fs.existsSync(file) ? sha256(file) : null;
  checksumResults.push({ file: relative, expected, actual, ok: actual === expected });
}
const checksumOk = checksumResults.every(x => x.ok) && checksumResults.length === Number(manifest.fileCount || checksumResults.length);

const mediaRoots = ['uploads', 'media'];
const mediaFiles = mediaRoots.reduce((total, dir) => {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return total;
  const walk = p => fs.readdirSync(p, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? walk(path.join(p, e.name)) : 1), 0);
  return total + walk(full);
}, 0);

const result = {
  ok: integrity === 'ok' && checksumOk,
  backup: root,
  manifest,
  sqliteIntegrity: integrity,
  users,
  memories,
  mediaFiles,
  checksumOk,
  checksumFailures: checksumResults.filter(x => !x.ok),
  verifiedAt: new Date().toISOString()
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
