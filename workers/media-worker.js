const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const { productionConfig } = require('../platform-config');
const { createStorage } = require('../storage-adapter');
const { jobFailures } = require('../observability');

const cfg = productionConfig();
if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for media worker'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required for media worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.MEDIA_WORKER_PG_POOL_MAX || 4) });
const storage = createStorage();
const id = () => crypto.randomUUID();

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => stderr += d);
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`)));
  });
}

function signatureMatches(buffer, mime) {
  if (!buffer || buffer.length < 8) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/gif') return buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a';
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'image/heic' || mime === 'image/heif') return buffer.subarray(4, 8).toString() === 'ftyp' || buffer.subarray(4, 12).toString().includes('ftyp');
  if (mime?.startsWith('video/') || mime?.startsWith('audio/')) return buffer.subarray(4, 8).toString() === 'ftyp' || buffer.subarray(0, 4).toString() === 'OggS' || buffer.subarray(0, 4).toString() === 'RIFF' || buffer.subarray(0, 4).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  return true;
}

async function updateMedia(memoryId, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const values = keys.map(k => patch[k]);
  const set = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
  values.push(memoryId);
  await pool.query(`UPDATE media SET ${set},updated_at=NOW() WHERE memory_id=$${values.length}`, values);
}

async function jobRun(job, status, patch = {}) {
  const data = job.data || {};
  await pool.query(`INSERT INTO job_runs(id,user_id,queue,job_name,external_job_id,status,attempts,payload,started_at,completed_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,CASE WHEN $6='running' THEN NOW() ELSE NULL END,CASE WHEN $6 IN ('completed','failed') THEN NOW() ELSE NULL END,NOW())
    ON CONFLICT(queue,external_job_id) WHERE external_job_id IS NOT NULL
    DO UPDATE SET status=EXCLUDED.status,attempts=EXCLUDED.attempts,payload=EXCLUDED.payload,error=$9,started_at=COALESCE(job_runs.started_at,EXCLUDED.started_at),completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
    [id(), data.userId || null, 'media-processing', job.name || 'media-processing', String(job.id), status, Number(job.attemptsMade || 0), JSON.stringify({ memoryId: data.memoryId, objectKey: data.objectKey, mimeType: data.mimeType }), patch.error || null]);
}

async function scan(filePath) {
  if (!cfg.media.clamavUrl) return { skipped: true };
  const body = await fs.promises.readFile(filePath);
  const r = await fetch(`${cfg.media.clamavUrl.replace(/\/$/, '')}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
  if (!r.ok) throw new Error(`ClamAV HTTP ${r.status}`);
  const result = await r.json().catch(() => ({}));
  if (result.infected || result.status === 'FOUND') throw new Error('Malware scan rejected the uploaded file');
  return result;
}

const worker = new Worker('media-processing', async job => {
  const { filePath: supplied, objectKey, mimeType, memoryId } = job.data;
  let filePath = supplied;
  const temporary = !filePath || !fs.existsSync(filePath);
  await jobRun(job, 'running');
  await updateMedia(memoryId, { status: 'scanning', scan_status: 'pending', processing_error: null });
  if (temporary) {
    if (!objectKey) throw new Error('Media source does not exist');
    filePath = path.join(os.tmpdir(), `life-replay-${job.id}-${path.basename(objectKey)}`);
    await storage.downloadToFile(objectKey, filePath);
  }
  try {
    const head = await fs.promises.readFile(filePath, { encoding: null });
    if (!signatureMatches(head, mimeType)) throw new Error('Media content does not match its declared MIME type');
    await updateMedia(memoryId, { scan_status: 'running' });
    await scan(filePath);
    await updateMedia(memoryId, { scan_status: 'clean', status: 'processing' });
    let outputPath = null;
    if (mimeType?.startsWith('video/') && cfg.media.ffmpeg) {
      outputPath = `${filePath}.processed.mp4`;
      await run(cfg.media.ffmpeg, ['-y', '-i', filePath, '-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outputPath]);
      if (storage.remote && objectKey) {
        const processed = await storage.putFile({ userId: job.data.userId, id: job.data.memoryId, filePath: outputPath, originalName: `${job.data.memoryId}.mp4`, mimeType: 'video/mp4', checksum: job.data.checksum });
        await updateMedia(memoryId, { processed_storage_path: processed.key });
      }
    }
    await updateMedia(memoryId, { status: 'ready', processing_error: null });
    await jobRun(job, 'completed', { result: { scanned: true, transcoded: Boolean(outputPath) } });
    return { scanned: true, transcoded: Boolean(outputPath), completedAt: new Date().toISOString() };
  } catch (error) {
    const rejected = /Malware|content does not match/.test(error.message);
    await updateMedia(memoryId, { status: rejected ? 'rejected' : 'failed', scan_status: rejected ? 'rejected' : 'failed', processing_error: String(error.message).slice(0, 2000) }).catch(() => {});
    await jobRun(job, 'failed', { error: String(error.message).slice(0, 2000) }).catch(() => {});
    throw error;
  } finally {
    if (temporary) {
      try { await fs.promises.unlink(filePath); } catch {}
      try { await fs.promises.unlink(`${filePath}.processed.mp4`); } catch {}
    }
  }
}, { connection, concurrency: Number(process.env.MEDIA_WORKER_CONCURRENCY || 2), autorun: true });

worker.on('failed', () => jobFailures.inc({ queue: 'media-processing' }));
worker.on('error', err => console.error('media worker error', err));

async function shutdown() {
  await worker.close();
  await connection.quit();
  await pool.end();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
console.log('Life Replay media worker started');
