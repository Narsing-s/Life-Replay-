const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const crypto = require('crypto');

let connection = null;
let pool = null;
const queues = new Map();

function getConnection() {
  if (!process.env.REDIS_URL) return null;
  if (!connection) connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
  return connection;
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.QUEUE_PG_POOL_MAX || 3) });
  return pool;
}

function getQueue(name) {
  const conn = getConnection();
  if (!conn) return null;
  if (!queues.has(name)) queues.set(name, new Queue(name, { connection: conn, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } } }));
  return queues.get(name);
}

async function enqueue(name, data, opts = {}) {
  const queue = getQueue(name);
  if (!queue) throw new Error('REDIS_URL is required for durable jobs');
  const jobId = opts.jobId || undefined;
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL is required for durable jobs');
  const externalId = String(jobId || `${name}-${crypto.randomUUID()}`);
  const runId = crypto.randomUUID();
  await db.query(`INSERT INTO job_runs(id,user_id,queue,job_name,external_job_id,status,attempts,payload,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,'queued',0,$6::jsonb,NOW(),NOW())
    ON CONFLICT(queue,external_job_id) WHERE external_job_id IS NOT NULL DO UPDATE SET status='queued',error=NULL,updated_at=NOW()`,
    [runId, data.userId || null, name, name, externalId, JSON.stringify(data)]);
  try {
    return await queue.add(name, data, { ...opts, jobId: externalId });
  } catch (error) {
    await db.query('UPDATE job_runs SET status=$1,error=$2,updated_at=NOW() WHERE queue=$3 AND external_job_id=$4', ['failed', String(error.message).slice(0, 2000), name, externalId]).catch(() => {});
    throw error;
  }
}

async function closeQueues() {
  await Promise.all([...queues.values()].map(q => q.close()));
  queues.clear();
  if (connection) { await connection.quit(); connection = null; }
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { getConnection, getQueue, enqueue, closeQueues };
