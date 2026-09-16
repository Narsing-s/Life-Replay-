const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const crypto = require('crypto');
const { sendEmail } = require('../production-services');
const { jobFailures } = require('../observability');

if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for notification worker'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required for notification worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.NOTIFICATION_WORKER_PG_POOL_MAX || 3) });
const id = () => crypto.randomUUID();

async function lifecycle(job, status, extra = {}) {
  const d = job.data || {};
  await pool.query(`INSERT INTO job_runs(id,user_id,queue,job_name,external_job_id,status,attempts,payload,result,error,started_at,completed_at,updated_at)
    VALUES($1,$2,'notifications',$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,CASE WHEN $5='running' THEN NOW() ELSE NULL END,CASE WHEN $5 IN ('completed','failed') THEN NOW() ELSE NULL END,NOW())
    ON CONFLICT(queue,external_job_id) WHERE external_job_id IS NOT NULL
    DO UPDATE SET status=EXCLUDED.status,attempts=EXCLUDED.attempts,payload=EXCLUDED.payload,result=EXCLUDED.result,error=EXCLUDED.error,started_at=COALESCE(job_runs.started_at,EXCLUDED.started_at),completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
    [id(), d.userId || null, job.name || 'notification', String(job.id), status, Number(job.attemptsMade || 0), JSON.stringify({ to: d.to, subject: String(d.subject || '').slice(0, 300) }), extra.result ? JSON.stringify(extra.result) : null, extra.error || null]);
}

const worker = new Worker('notifications', async job => {
  if (job.name !== 'email') throw new Error(`Unsupported notification job: ${job.name}`);
  await lifecycle(job, 'running');
  try {
    const result = await sendEmail(job.data);
    await lifecycle(job, 'completed', { result: { sent: true } });
    return result;
  } catch (error) {
    await lifecycle(job, 'failed', { error: String(error.message).slice(0, 2000) }).catch(() => {});
    throw error;
  }
}, { connection, concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 4) });

worker.on('failed', () => jobFailures.inc({ queue: 'notifications' }));
worker.on('error', err => console.error('notification worker error', err));
async function shutdown() { await worker.close(); await connection.quit(); await pool.end(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
console.log('Life Replay notification worker started');
