const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { sendEmail } = require('../production-services');
const { jobFailures } = require('../observability');

if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for notification worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker('notifications', async job => {
  if (job.name !== 'email') throw new Error(`Unsupported notification job: ${job.name}`);
  return sendEmail(job.data);
}, { connection, concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 4) });
worker.on('failed', () => jobFailures.inc({ queue: 'notifications' }));
worker.on('error', err => console.error('notification worker error', err));
console.log('Life Replay notification worker started');
