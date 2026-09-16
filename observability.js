const pino = require('pino');
const client = require('prom-client');

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'life-replay-api' } });
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'life_replay_' });
const httpDuration = new client.Histogram({ name: 'life_replay_http_request_duration_seconds', help: 'HTTP request duration', labelNames: ['method','route','status'], buckets: [0.05,0.1,0.25,0.5,1,2,5,10] });
const httpRequests = new client.Counter({ name: 'life_replay_http_requests_total', help: 'HTTP requests', labelNames: ['method','route','status'] });
const jobFailures = new client.Counter({ name: 'life_replay_job_failures_total', help: 'Background job failures', labelNames: ['queue'] });
registry.registerMetric(httpDuration); registry.registerMetric(httpRequests); registry.registerMetric(jobFailures);

function observabilityMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown';
    const status = String(res.statusCode);
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    httpDuration.observe({ method: req.method, route, status }, seconds);
    httpRequests.inc({ method: req.method, route, status });
    logger.info({ requestId: req.requestId, method: req.method, route, status: res.statusCode, durationMs: Math.round(seconds * 1000) }, 'request complete');
  });
  next();
}

async function metricsHandler(req, res) {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}

module.exports = { logger, registry, observabilityMiddleware, metricsHandler, jobFailures };
