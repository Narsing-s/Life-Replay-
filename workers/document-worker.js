const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createStorage } = require('../storage-adapter');

if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for document worker'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required for document worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DOCUMENT_WORKER_PG_POOL_MAX || 3) });
const storage = createStorage();
const id = () => crypto.randomUUID();
const ocrCommand = process.env.OCR_COMMAND || '';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `OCR exited ${code}`)));
  });
}

async function lifecycle(job, status, extra = {}) {
  const data = job.data || {};
  await pool.query(`INSERT INTO job_runs(id,user_id,queue,job_name,external_job_id,status,attempts,payload,result,error,started_at,completed_at,updated_at)
    VALUES($1,$2,'document-processing',$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,CASE WHEN $5='running' THEN NOW() ELSE NULL END,CASE WHEN $5 IN ('completed','failed') THEN NOW() ELSE NULL END,NOW())
    ON CONFLICT(queue,external_job_id) WHERE external_job_id IS NOT NULL
    DO UPDATE SET status=EXCLUDED.status,attempts=EXCLUDED.attempts,payload=EXCLUDED.payload,result=EXCLUDED.result,error=EXCLUDED.error,started_at=COALESCE(job_runs.started_at,EXCLUDED.started_at),completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
    [id(), data.userId || null, job.name || 'document', String(job.id), status, Number(job.attemptsMade || 0), JSON.stringify({ documentId: data.documentId, memoryId: data.memoryId, objectKey: data.objectKey, mimeType: data.mimeType }), extra.result ? JSON.stringify(extra.result) : null, extra.error || null]);
}

const worker = new Worker('document-processing', async job => {
  await lifecycle(job, 'running');
  const { filePath: supplied, objectKey, mimeType, memoryId, documentId } = job.data || {};
  let filePath = supplied;
  const temporary = !filePath || !fs.existsSync(filePath);
  if (temporary) {
    if (!objectKey) throw new Error('filePath or objectKey is required');
    filePath = path.join(os.tmpdir(), `life-replay-doc-${job.id}-${path.basename(objectKey)}`);
    await storage.downloadToFile(objectKey, filePath);
  }
  await pool.query('UPDATE documents SET status=$1,updated_at=NOW(),error=NULL WHERE id=$2 AND user_id=$3', ['processing', documentId, job.data.userId]);
  try {
    if (!ocrCommand) throw new Error('OCR provider is not configured; set OCR_COMMAND before deploying the document worker');
    const args = JSON.parse(process.env.OCR_ARGS_JSON || '["{input}"]').map(x => String(x).replace('{input}', filePath));
    const text = await run(ocrCommand, args);
    const extracted = text.slice(0, 500000);
    await pool.query('UPDATE documents SET status=$1,extracted_text=$2,error=NULL,completed_at=NOW(),updated_at=NOW() WHERE id=$3 AND user_id=$4', ['completed', extracted, documentId, job.data.userId]);
    const result = { status: 'completed', characters: extracted.length, completedAt: new Date().toISOString() };
    await lifecycle(job, 'completed', { result: { ...result, memoryId } });
    return result;
  } catch (error) {
    await pool.query('UPDATE documents SET status=$1,error=$2,updated_at=NOW() WHERE id=$3 AND user_id=$4', ['failed', String(error.message).slice(0, 2000), documentId, job.data.userId]).catch(() => {});
    await lifecycle(job, 'failed', { error: String(error.message).slice(0, 2000) }).catch(() => {});
    throw error;
  } finally {
    if (temporary) { try { await fs.promises.unlink(filePath); } catch {} }
  }
}, { connection, concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY || 2) });

worker.on('failed', (job, err) => console.error('document job failed', job?.id, err));
worker.on('error', err => console.error('document worker error', err));
async function shutdown() { await worker.close(); await connection.quit(); await pool.end(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
console.log('Life Replay document worker started');
