const { Pool } = require('pg');

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(2); }
const staleMinutes = Math.max(10, Number(process.env.STALE_JOB_MINUTES || 60));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

(async () => {
  try {
    const jobs = await pool.query(`UPDATE job_runs SET status='failed',error=COALESCE(error,'Worker heartbeat expired'),updated_at=NOW(),completed_at=NOW()
      WHERE status='running' AND updated_at < NOW() - ($1::text || ' minutes')::interval
      RETURNING id,queue,job_name,external_job_id`, [String(staleMinutes)]);
    const imports = await pool.query(`UPDATE import_jobs SET status='failed',error=COALESCE(error,'Import worker heartbeat expired'),updated_at=NOW()
      WHERE status='running' AND updated_at < NOW() - ($1::text || ' minutes')::interval
      RETURNING id,provider`, [String(staleMinutes)]);
    const documents = await pool.query(`UPDATE documents SET status='failed',error=COALESCE(error,'Document worker heartbeat expired'),updated_at=NOW()
      WHERE status='processing' AND updated_at < NOW() - ($1::text || ' minutes')::interval
      RETURNING id`, [String(staleMinutes)]).catch(() => ({ rowCount: 0, rows: [] }));
    console.log(JSON.stringify({ ok: true, staleMinutes, failedJobs: jobs.rows, failedImports: imports.rows, failedDocuments: documents.rows }, null, 2));
  } finally { await pool.end(); }
})().catch(error => { console.error(error.stack || error); process.exit(1); });
