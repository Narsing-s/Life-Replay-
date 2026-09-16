const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { productionConfig } = require('../platform-config');
const { jobFailures } = require('../observability');

const cfg = productionConfig();
if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for media worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore','pipe','pipe'] });
    let stderr = ''; p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('error', reject); p.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`)));
  });
}

async function scan(filePath) {
  if (!cfg.media.clamavUrl) return { skipped: true };
  const url = `${cfg.media.clamavUrl.replace(/\/$/, '')}/scan`;
  const body = await fs.promises.readFile(filePath);
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
  if (!r.ok) throw new Error(`ClamAV HTTP ${r.status}`);
  const result = await r.json().catch(() => ({}));
  if (result.infected || result.status === 'FOUND') throw new Error('Malware scan rejected the uploaded file');
  return result;
}

const worker = new Worker('media-processing', async job => {
  const { filePath, mimeType, outputPath } = job.data;
  if (!filePath || !fs.existsSync(filePath)) throw new Error('Media source does not exist');
  await scan(filePath);
  if (mimeType?.startsWith('video/') && outputPath) {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await run(cfg.media.ffmpeg, ['-y','-i',filePath,'-map_metadata','-1','-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-movflags','+faststart',outputPath]);
  }
  return { scanned: true, transcoded: Boolean(mimeType?.startsWith('video/') && outputPath), completedAt: new Date().toISOString() };
}, { connection, concurrency: Number(process.env.MEDIA_WORKER_CONCURRENCY || 2) });

worker.on('failed', (job, err) => jobFailures.inc({ queue: 'media-processing' }));
worker.on('error', err => console.error('media worker error', err));
console.log('Life Replay media worker started');
