const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const { createStorage } = require('../storage-adapter');
const { decrypt, encrypt } = require('../production-integrations');
const { jobFailures } = require('../observability');

if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for Google import worker'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required for Google import worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.GOOGLE_IMPORT_PG_POOL_MAX || 3) });
const mediaQueue = new Queue('media-processing', { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } } });
const storage = createStorage();
const id = () => crypto.randomUUID();
const text = (v, max = 5000) => String(v ?? '').trim().slice(0, max);

async function tokenFor(userId) {
  const r = await pool.query('SELECT * FROM integrations WHERE user_id=$1 AND provider=$2 AND status=$3', [userId, 'google', 'active']);
  if (!r.rowCount) throw new Error('Google Photos is not connected');
  const row = r.rows[0];
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60000) return { row, accessToken: decrypt(row.encrypted_access_token) };
  if (!row.encrypted_refresh_token) throw new Error('Google authorization expired and no refresh token is available');
  const refreshToken = decrypt(row.encrypted_refresh_token);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: refreshToken, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status}`);
  const token = await response.json();
  const accessToken = token.access_token;
  await pool.query('UPDATE integrations SET encrypted_access_token=$1,expires_at=NOW()+($2||\' seconds\')::interval,updated_at=NOW() WHERE id=$3', [encrypt(accessToken), String(Number(token.expires_in || 3600)), row.id]);
  return { row, accessToken };
}

async function lifecycle(job, status, extra = {}) {
  const d = job.data || {};
  await pool.query(`INSERT INTO job_runs(id,user_id,queue,job_name,external_job_id,status,attempts,payload,result,error,started_at,completed_at,updated_at)
    VALUES($1,$2,'google-import',$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,CASE WHEN $5='running' THEN NOW() ELSE NULL END,CASE WHEN $5 IN ('completed','failed') THEN NOW() ELSE NULL END,NOW())
    ON CONFLICT(queue,external_job_id) WHERE external_job_id IS NOT NULL
    DO UPDATE SET status=EXCLUDED.status,attempts=EXCLUDED.attempts,result=EXCLUDED.result,error=EXCLUDED.error,started_at=COALESCE(job_runs.started_at,EXCLUDED.started_at),completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
    [id(), d.userId || null, job.name || 'google-import', String(job.id), status, Number(job.attemptsMade || 0), JSON.stringify({ importJobId: d.importJobId }), extra.result ? JSON.stringify(extra.result) : null, extra.error || null]);
}

async function listPage(accessToken, pageToken) {
  const url = new URL('https://photoslibrary.googleapis.com/v1/mediaItems:search');
  url.searchParams.set('pageSize', String(Math.min(100, Number(process.env.GOOGLE_IMPORT_PAGE_SIZE || 100))));
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Google Photos media search failed: ${response.status}`);
  return response.json();
}

async function downloadMedia(accessToken, item) {
  const baseUrl = text(item?.baseUrl, 4000);
  if (!baseUrl) throw new Error('Google media item has no downloadable baseUrl');
  const response = await fetch(`${baseUrl}=d`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Google media download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const max = Number(process.env.MAX_MEDIA_BYTES || 250 * 1024 * 1024);
  if (!buffer.length || buffer.length > max) throw new Error('Imported media exceeds configured size limit');
  const mime = text(item.mimeType || response.headers.get('content-type') || 'application/octet-stream', 200).split(';')[0];
  return { buffer, mime };
}

function filename(item, mime) {
  const original = text(item?.filename, 300) || `${item.id}`;
  if (path.extname(original)) return original;
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/quicktime': '.mov' }[mime] || '';
  return `${original}${ext}`;
}

async function importItem(jobId, userId, accessToken, item) {
  const existing = await pool.query('SELECT id FROM import_items WHERE user_id=$1 AND provider=$2 AND provider_id=$3', [userId, 'google', item.id]);
  if (existing.rowCount) return { imported: false, skipped: true };
  const downloaded = await downloadMedia(accessToken, item);
  const checksum = crypto.createHash('sha256').update(downloaded.buffer).digest('hex');
  const duplicate = await pool.query('SELECT id FROM media WHERE user_id=$1 AND checksum=$2 LIMIT 1', [userId, checksum]);
  if (duplicate.rowCount) {
    await pool.query('INSERT INTO import_items(id,job_id,user_id,provider,provider_id,memory_id,checksum,status,metadata) VALUES($1,$2,$3,\'google\',$4,NULL,$5,\'skipped\',$6::jsonb) ON CONFLICT(user_id,provider,provider_id) DO NOTHING', [id(), jobId, userId, item.id, checksum, JSON.stringify({ reason: 'duplicate_checksum' })]);
    return { imported: false, skipped: true };
  }
  const created = item.mediaMetadata?.creationTime || new Date().toISOString();
  const date = /^\d{4}-\d{2}-\d{2}/.test(created) ? created.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const memoryId = id();
  const title = text(item.filename, 200) || 'Imported memory';
  const caption = text(item.description, 2000);
  const originalName = filename(item, downloaded.mime);
  const stored = await storage.putBuffer({ userId, id: memoryId, buffer: downloaded.buffer, originalName, mimeType: downloaded.mime, checksum });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO memories(id,user_id,title,caption,place,date,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW())', [memoryId, userId, title, caption, '', date, stored.key]);
    await client.query('INSERT INTO memory_meta(memory_id,source,category,summary) VALUES($1,\'google-photos\',\'memory\',\'\') ON CONFLICT DO NOTHING', [memoryId]);
    const mediaId = id();
    await client.query('INSERT INTO media(id,memory_id,user_id,original_name,mime_type,size,storage_path,checksum,created_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),\'queued\')', [mediaId, memoryId, userId, originalName, downloaded.mime, downloaded.buffer.length, stored.key, checksum]);
    await client.query('INSERT INTO import_items(id,job_id,user_id,provider,provider_id,memory_id,checksum,status,metadata) VALUES($1,$2,$3,\'google\',$4,$5,$6,\'imported\',$7::jsonb)', [id(), jobId, userId, item.id, memoryId, checksum, JSON.stringify({ filename: item.filename || null, creationTime: created })]);
    await client.query('COMMIT');
    await mediaQueue.add('media-processing', { memoryId, userId, objectKey: stored.key, mimeType: downloaded.mime, checksum }, { jobId: `media-${memoryId}` });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    await storage.remove(stored.key).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { imported: true, skipped: false, memoryId };
}

const worker = new Worker('google-import', async job => {
  await lifecycle(job, 'running');
  const { userId, importJobId } = job.data || {};
  try {
    const { accessToken } = await tokenFor(userId);
    const state = await pool.query('SELECT * FROM import_jobs WHERE id=$1 AND user_id=$2', [importJobId, userId]);
    if (!state.rowCount) throw new Error('Import job not found');
    await pool.query('UPDATE import_jobs SET status=$1,started_at=COALESCE(started_at,NOW()),updated_at=NOW() WHERE id=$2', ['running', importJobId]);
    let cursor = state.rows[0].cursor || null;
    let imported = 0, skipped = 0, processed = 0;
    do {
      const page = await listPage(accessToken, cursor);
      for (const item of page.mediaItems || []) {
        const result = await importItem(importJobId, userId, accessToken, item);
        processed++;
        imported += result.imported ? 1 : 0;
        skipped += result.skipped ? 1 : 0;
        await pool.query('UPDATE import_jobs SET cursor=$1,processed_count=$2,imported_count=$3,skipped_count=$4,updated_at=NOW() WHERE id=$5', [page.nextPageToken || null, processed, imported, skipped, importJobId]);
      }
      cursor = page.nextPageToken || null;
      if (!page.mediaItems?.length) await pool.query('UPDATE import_jobs SET cursor=$1,updated_at=NOW() WHERE id=$2', [cursor, importJobId]);
      if (!cursor) break;
    } while (true);
    await pool.query('UPDATE import_jobs SET status=$1,completed_at=NOW(),updated_at=NOW() WHERE id=$2', ['completed', importJobId]);
    await lifecycle(job, 'completed', { result: { importJobId, imported, skipped, processed } });
    return { imported, skipped, processed, completedAt: new Date().toISOString() };
  } catch (error) {
    await pool.query('UPDATE import_jobs SET status=$1,error=$2,updated_at=NOW() WHERE id=$3', ['failed', String(error.message).slice(0, 2000), importJobId]).catch(() => {});
    await lifecycle(job, 'failed', { error: String(error.message).slice(0, 2000) }).catch(() => {});
    throw error;
  }
}, { connection, concurrency: Number(process.env.GOOGLE_IMPORT_CONCURRENCY || 1), autorun: true });

worker.on('failed', () => jobFailures.inc({ queue: 'google-import' }));
worker.on('error', err => console.error('google import worker error', err));
async function shutdown() { await worker.close(); await mediaQueue.close(); await connection.quit(); await pool.end(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
console.log('Life Replay Google Photos import worker started');
