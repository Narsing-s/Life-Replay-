const { Pool } = require('pg');
const { createStorage } = require('../storage-adapter');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL is required'); process.exit(2); }
const olderThanHours = Math.max(1, Number(process.env.ORPHAN_MEDIA_AGE_HOURS || 24));
const maxObjects = Math.max(1, Math.min(1000, Number(process.env.ORPHAN_MEDIA_MAX_OBJECTS || 500)));
const dryRun = process.env.ORPHAN_MEDIA_DRY_RUN !== 'false';
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const storage = createStorage();

(async () => {
  try {
    const referenced = await pool.query(`SELECT storage_path AS key FROM media WHERE storage_path IS NOT NULL UNION SELECT processed_storage_path AS key FROM media WHERE processed_storage_path IS NOT NULL`);
    const referencedKeys = new Set(referenced.rows.map(r => String(r.key)));

    const staleRows = await pool.query(`SELECT id,storage_path,processed_storage_path FROM media WHERE memory_id IS NULL AND created_at < NOW() - ($1::text || ' hours')::interval LIMIT $2`, [String(olderThanHours), maxObjects]);
    let removedRows = 0;
    for (const row of staleRows.rows) {
      for (const key of [row.storage_path, row.processed_storage_path].filter(Boolean)) {
        if (dryRun) continue;
        try { await storage.remove(key); } catch (e) { console.warn('object removal warning', key, e.message); }
      }
      if (!dryRun) {
        await pool.query('DELETE FROM media WHERE id=$1 AND memory_id IS NULL', [row.id]);
        removedRows++;
      }
    }

    let scannedObjects = 0;
    let removedObjects = 0;
    const orphanObjects = [];
    if (storage.remote) {
      const objects = await storage.list('', maxObjects);
      scannedObjects = objects.length;
      for (const object of objects) {
        if (!object.key || referencedKeys.has(object.key)) continue;
        const age = object.lastModified ? Date.now() - new Date(object.lastModified).getTime() : 0;
        if (age < olderThanHours * 60 * 60 * 1000) continue;
        orphanObjects.push(object.key);
        if (!dryRun) {
          try { await storage.remove(object.key); removedObjects++; } catch (e) { console.warn('orphan object removal warning', object.key, e.message); }
        }
      }
    }

    console.log(JSON.stringify({ ok: true, dryRun, olderThanHours, staleMediaRows: staleRows.rowCount, removedRows, scannedObjects, orphanObjects: orphanObjects.slice(0, 100), removedObjects }, null, 2));
  } finally {
    await pool.end();
  }
})().catch(error => { console.error(error.stack || error); process.exit(1); });
