const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const sqlitePath = process.argv[2] || path.join(dataDir, 'life-replay.db');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL is required'); process.exit(2); }
if (!fs.existsSync(sqlitePath)) { console.error(`SQLite database not found: ${sqlitePath}`); process.exit(2); }

const schema = fs.readFileSync(path.join(__dirname, '..', 'packages/database/migrations/001_initial.sql'), 'utf8');
const tables = ['users','memories','profiles','sessions','memory_meta','media','tags','memory_tags','people','memory_people','locations','memory_locations','shares','share_items','collaborators','comments','reactions','calendar_events','notifications','ai_jobs','embeddings','replays','audit_logs','account_tokens'];
const booleanColumns = new Set(['favorite','pinned']);

(async () => {
  const sqlite = new Database(sqlitePath, { readonly:true });
  const pg = new Client({ connectionString: databaseUrl });
  await pg.connect();
  await pg.query(schema);
  await pg.query('BEGIN');
  try {
    for (const table of tables) {
      const exists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) continue;
      const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!columns.length) continue;
      const rows = sqlite.prepare(`SELECT ${columns.map(c => `\"${c}\"`).join(',')} FROM ${table}`).all();
      for (const row of rows) {
        let targetColumns = [...columns];
        let values = targetColumns.map(c => booleanColumns.has(c) ? Boolean(row[c]) : row[c]);
        if (table === 'embeddings' && columns.includes('vector_json')) {
          targetColumns = columns.filter(c => c !== 'vector_json');
          const vectorIndex = targetColumns.length;
          values = targetColumns.map(c => booleanColumns.has(c) ? Boolean(row[c]) : row[c]);
          let vector = null;
          try { const parsed = JSON.parse(row.vector_json || 'null'); if (Array.isArray(parsed)) vector = `[${parsed.join(',')}]`; } catch {}
          targetColumns.push('vector'); values.push(vector);
        }
        const quoted = targetColumns.map(c => `\"${c}\"`).join(',');
        const params = values.map((_,i)=>`$${i+1}`).join(',');
        const sql = `INSERT INTO ${table} (${quoted}) VALUES (${params}) ON CONFLICT DO NOTHING`;
        await pg.query(sql, values);
      }
      console.log(`${table}: ${rows.length} rows considered`);
    }
    await pg.query('COMMIT');
    console.log(JSON.stringify({ ok:true, sqlitePath, migratedAt:new Date().toISOString() },null,2));
  } catch (err) {
    await pg.query('ROLLBACK');
    console.error(err.stack || err); process.exitCode=1;
  } finally { sqlite.close(); await pg.end(); }
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
