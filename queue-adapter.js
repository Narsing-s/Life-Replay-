const { Queue } = require('bullmq');
const IORedis = require('ioredis');

let connection = null;
const queues = new Map();

function getConnection() {
  if (!process.env.REDIS_URL) return null;
  if (!connection) connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
  return connection;
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
  return queue.add(name, data, { ...opts, jobId });
}

async function closeQueues() {
  await Promise.all([...queues.values()].map(q => q.close()));
  queues.clear();
  if (connection) { await connection.quit(); connection = null; }
}

module.exports = { getConnection, getQueue, enqueue, closeQueues };
