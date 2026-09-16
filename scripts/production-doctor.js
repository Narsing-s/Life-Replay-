const { providerStatus, connectivityStatus } = require('../production-services');

(async () => {
  const status = providerStatus();
  const connectivity = await connectivityStatus();
  const checks = [
    ['PostgreSQL configured', status.database.configured],
    ['PostgreSQL reachable', connectivity.connectivity.postgres.reachable],
    ['Object storage configured', status.objectStorage.configured],
    ['Email delivery configured', status.email.configured],
    ['LLM configured', status.ai.configured],
    ['Embeddings configured', status.embeddings.configured],
    ['Redis configured', status.distributedRateLimit.configured],
    ['Redis reachable', connectivity.connectivity.redis.reachable],
    ['Video transcoding configured', status.transcoding.configured],
    ['Malware scanning configured', status.malwareScanning.configured],
    ['Observability exporter configured', status.observability.configured]
  ];
  const required = ['DATABASE_URL','S3_BUCKET','REDIS_URL'];
  const missing = process.env.NODE_ENV === 'production' ? required.filter(k => !String(process.env[k] || '').trim()) : [];
  const failedConnectivity = process.env.NODE_ENV === 'production' && (!connectivity.connectivity.postgres.reachable || !connectivity.connectivity.redis.reachable || !status.objectStorage.configured);
  const result = { generatedAt:new Date().toISOString(), providers:connectivity, checks, missing, ok:missing.length===0 && !failedConnectivity };
  console.log(JSON.stringify(result,null,2));
  if (!result.ok) process.exitCode=1;
})().catch(err => { console.error(err.stack || err); process.exitCode=1; });
