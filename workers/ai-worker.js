const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { embed, askLLM } = require('../production-services');
const { jobFailures } = require('../observability');

if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for AI worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker('ai-processing', async job => {
  if (job.name === 'embed') return { embeddings: await embed(job.data.texts || []) };
  if (job.name === 'ask') return { answer: await askLLM({ question: job.data.question, memories: job.data.memories || [] }) };
  throw new Error(`Unsupported AI job: ${job.name}`);
}, { connection, concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 4) });

worker.on('failed', () => jobFailures.inc({ queue: 'ai-processing' }));
worker.on('error', err => console.error('ai worker error', err));
console.log('Life Replay AI worker started');
