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
    [id(), data.userId || null, job.name || 'ai', String(job.id), status, Number(job.attemptsMade || 0), JSON.stringify({ memoryId: data.memoryId, replayId: data.replayId, question: String(data.question || '').slice(0, 4000), textCount: Array.isArray(data.texts) ? data.texts.length : 0 }), extra.result ? JSON.stringify(extra.result) : null, extra.error || null]);
}

async function completeReplay(data, narrative) {
  if (!data.replayId || !data.userId) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const replay = await client.query('SELECT id FROM replays WHERE id=$1 AND user_id=$2 FOR UPDATE', [data.replayId, data.userId]);
    if (!replay.rowCount) throw new Error('Replay not found or not owned by this account');
    await client.query('UPDATE replays SET status=$1,narrative=$2 WHERE id=$3 AND user_id=$4', ['completed', String(narrative || '').slice(0, 100000), data.replayId, data.userId]);
    if (data.jobId) await client.query('UPDATE ai_jobs SET status=$1,output_json=$2::jsonb,completed_at=NOW(),error=NULL WHERE id=$3 AND user_id=$4', ['completed', JSON.stringify({ narrative }), data.jobId, data.userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

const worker = new Worker('ai-processing', async job => {
  await lifecycle(job, 'running');
  try {
    let result;
    if (job.name === 'embed') {
      const vectors = await embed(job.data.texts || []);
      if (!vectors) throw new Error('Embedding provider is not configured');
      result = { embeddings: vectors };
    } else if (job.name === 'ask') {
      const answer = await askLLM({ question: job.data.question, memories: job.data.memories || [] });
      if (!answer) throw new Error('LLM provider is not configured');
      result = { answer };
    } else if (job.name === 'replay' || job.data?.type === 'replay') {
      const data = job.data || {};
      const replay = await pool.query('SELECT id,title,period_start,period_end FROM replays WHERE id=$1 AND user_id=$2', [data.replayId, data.userId]);
      if (!replay.rowCount) throw new Error('Replay not found or not owned by this account');
      const r = replay.rows[0];
      const memories = await pool.query(`SELECT m.id,m.title,m.caption,m.place,m.date,COALESCE(mm.summary,'') summary,COALESCE(mm.category,'') category,COALESCE(mm.mood,'') mood
        FROM memories m LEFT JOIN memory_meta mm ON mm.memory_id=m.id
        WHERE m.user_id=$1 AND COALESCE(mm.deleted_at IS NULL,true)
          AND ($2::date IS NULL OR m.date >= $2::date) AND ($3::date IS NULL OR m.date <= $3::date)
        ORDER BY m.date ASC,m.created_at ASC LIMIT 500`, [data.userId, r.period_start, r.period_end]);
      const narrative = await askLLM({ question: `Create a factual Life Replay narrative titled "${r.title}" for the supplied period. Summarize only the authenticated user's memories; do not invent details.`, memories: memories.rows });
      if (!narrative) throw new Error('LLM provider is not configured');
      await completeReplay(data, narrative);
      result = { narrative, memoryCount: memories.rowCount, replayId: data.replayId };
    } else throw new Error(`Unsupported AI job: ${job.name}`);
    await lifecycle(job, 'completed', { result: { completed: true, type: job.name || job.data?.type, count: Array.isArray(result.embeddings) ? result.embeddings.length : result.memoryCount } });
    return result;
  } catch (error) {
    if (job.data?.type === 'replay' || job.name === 'replay') {
      await pool.query('UPDATE replays SET status=$1 WHERE id=$2 AND user_id=$3', ['failed', job.data.replayId, job.data.userId]).catch(() => {});
      if (job.data.jobId) await pool.query('UPDATE ai_jobs SET status=$1,error=$2 WHERE id=$3 AND user_id=$4', ['failed', String(error.message).slice(0, 2000), job.data.jobId, job.data.userId]).catch(() => {});
    }
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
