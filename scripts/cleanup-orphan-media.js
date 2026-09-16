const { Pool } = require('pg');
const { createStorage } = require('../storage-adapter');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL is required'); process.exit(2); }
const olderThanHours = Math.max(1, Number(process.env.ORPHAN_MEDIA_AGE_HOURS || 24));
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const storage = createStorage();

(async () => {
  try {
    const rows = await pool.query(`SELECT id,storage_path,processed_storage_path FROM media WHERE memory_id IS NULL AND created_at < NOW() - ($1::text || ' hours')::interval LIMIT 500`, [String(olderThanHours)]);
    let removed = 0;
    for (const row of rows.rows) {
      for (const key of [row.storage_path, row.processed_storage_path].filter(Boolean)) {
        try { await storage.remove(key); } catch (e) { console.warn('object removal warning', key, e.message); }
      }
      await pool.query('DELETE FROM media WHERE id=$1 AND memory_id IS NULL', [row.id]);
      removed++;
    }
    console.log(JSON.stringify({ ok: true, scanned: rows.rowCount, removed, olderThanHours }, null, 2));
  } finally {
    await pool.end();
  }
})().catch(error => { console.error(error.stack || error); process.exit(1); });
