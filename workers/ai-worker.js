const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const crypto = require('crypto');
const { embed, askLLM } = require('../production-services');
const { jobFailures } = require('../observability');

if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for AI worker'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required for AI worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.AI_WORKER_PG_POOL_MAX || 4) });
const id = () => crypto.randomUUID();

async function lifecycle(job, status, extra = {}) {
  const data = job.data || {};
  await pool.query(`INSERT INTO job_runs(id,user_id,queue,job_name,external_job_id,status,attempts,payload,result,error,started_at,completed_at,updated_at)
    VALUES($1,$2,'ai-processing',$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,CASE WHEN $5='running' THEN NOW() ELSE NULL END,CASE WHEN $5 IN ('completed','failed') THEN NOW() ELSE NULL END,NOW())
    ON CONFLICT(queue,external_job_id) WHERE external_job_id IS NOT NULL
    DO UPDATE SET status=EXCLUDED.status,attempts=EXCLUDED.attempts,payload=EXCLUDED.payload,result=EXCLUDED.result,error=EXCLUDED.error,started_at=COALESCE(job_runs.started_at,EXCLUDED.started_at),completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
    [id(), data.userId || null, job.name || 'ai', String(job.id), status, Number(job.attemptsMade || 0), JSON.stringify({ memoryId: data.memoryId, question: String(data.question || '').slice(0, 4000), textCount: Array.isArray(data.texts) ? data.texts.length : 0 }), extra.result ? JSON.stringify(extra.result) : null, extra.error || null]);
}

const worker = new Worker('ai-processing', async job => {
  await lifecycle(job, 'running');
  try {
    let result;
    if (job.name === 'embed') {
      const vectors = await embed(job.data.texts || []);
      result = { embeddings: vectors };
    } else if (job.name === 'ask') {
      const answer = await askLLM({ question: job.data.question, memories: job.data.memories || [] });
      result = { answer };
    } else throw new Error(`Unsupported AI job: ${job.name}`);
    await lifecycle(job, 'completed', { result: { completed: true, type: job.name, count: Array.isArray(result.embeddings) ? result.embeddings.length : undefined } });
    return result;
  } catch (error) {
    await lifecycle(job, 'failed', { error: String(error.message).slice(0, 2000) }).catch(() => {});
    throw error;
  }
}, { connection, concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 4) });

worker.on('failed', () => jobFailures.inc({ queue: 'ai-processing' }));
worker.on('error', err => console.error('ai worker error', err));

async function shutdown() { await worker.close(); await connection.quit(); await pool.end(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
console.log('Life Replay AI worker started');
