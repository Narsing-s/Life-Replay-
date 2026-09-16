const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const backupDir = process.env.BACKUP_DIR || path.join(dataDir, 'backups');
const sourceDb = path.join(dataDir, 'life-replay.db');
const retention = Math.max(1, Number(process.env.BACKUP_RETENTION || 14));
const sourceFiles = ['uploads', 'media'];

if (!fs.existsSync(sourceDb)) {
  console.error(`Database not found: ${sourceDb}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, stamp);
fs.mkdirSync(target, { recursive: true });

const db = new Database(sourceDb, { readonly: true });
try {
  db.backup(path.join(target, 'life-replay.db'));
} finally {
  db.close();
}

for (const name of sourceFiles) {
  const source = path.join(dataDir, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(target, name), { recursive: true });
}

function walk(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, rel) : [rel];
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const files = walk(target).filter(name => name !== 'manifest.json').sort();
const checksums = Object.fromEntries(files.map(name => [name.replace(/\\/g, '/'), sha256(path.join(target, name))]));
const manifest = {
  version: 2,
  createdAt: new Date().toISOString(),
  sourceDataDir: dataDir,
  database: 'life-replay.db',
  included: ['life-replay.db', 'uploads/', 'media/'],
  fileCount: files.length,
  checksums
};
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));

const backups = fs.readdirSync(backupDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .sort((a, b) => b.name.localeCompare(a.name));
for (const old of backups.slice(retention)) {
  fs.rmSync(path.join(backupDir, old.name), { recursive: true, force: true });
}

console.log(JSON.stringify({ backup: target, fileCount: files.length, retention }, null, 2));
