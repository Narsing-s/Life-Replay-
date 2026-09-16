const { providerStatus } = require('../production-services');

const status = providerStatus();
const checks = [
  ['PostgreSQL', status.database.configured],
  ['Object storage', status.objectStorage.configured],
  ['Email delivery', status.email.configured],
  ['LLM', status.ai.configured],
  ['Embeddings', status.embeddings.configured],
  ['Distributed rate limiting', status.distributedRateLimit.configured],
  ['Video transcoding', status.transcoding.configured],
  ['Malware scanning', status.malwareScanning.configured],
  ['Observability exporter', status.observability.configured]
];
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), providers: status, checks }, null, 2));
const required = ['DATABASE_URL','S3_ENDPOINT','S3_BUCKET','REDIS_URL'];
if (process.env.NODE_ENV === 'production') {
  const missing = required.filter(k => !String(process.env[k] || '').trim());
  if (missing.length) {
    console.error(`Missing production infrastructure variables: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}
