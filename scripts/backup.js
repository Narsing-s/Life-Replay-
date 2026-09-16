const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const backupDir = process.env.BACKUP_DIR || path.join(dataDir, 'backups');
const sourceDb = path.join(dataDir, 'life-replay.db');
const sourceUploads = path.join(dataDir, 'uploads');
const sourceMedia = path.join(dataDir, 'media');

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

for (const name of ['uploads', 'media']) {
  const source = path.join(dataDir, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(target, name), { recursive: true });
}

const manifest = {
  createdAt: new Date().toISOString(),
  sourceDataDir: dataDir,
  database: 'life-replay.db',
  included: ['life-replay.db', 'uploads/', 'media/']
};
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Backup created: ${target}`);
