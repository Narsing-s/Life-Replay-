// Compatibility preload used by the existing npm scripts.
// Production routes are installed before feature routes so security-sensitive
// replacements such as rotating refresh tokens take precedence.
const Module = require('module');
const path = require('path');
const originalLoad = Module._load;
let wrapped = false;

Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (!wrapped && request === './feature-routes' && parent && path.basename(parent.filename) === 'server.js') {
    wrapped = true;
    const base = path.dirname(parent.filename);
    const productionRoutes = require(path.join(base, 'production-routes'));
    const integrationRoutes = require(path.join(base, 'integration-routes'));
    const { observabilityMiddleware, metricsHandler } = require(path.join(base, 'observability'));
    return function(args) {
      args.app.use(observabilityMiddleware);
      productionRoutes(args);
      integrationRoutes(args);
      args.app.get('/metrics', async (req, res) => {
        const token = String(process.env.METRICS_TOKEN || '');
        if (token && req.headers.authorization !== `Bearer ${token}`) return res.status(401).end();
        if (!token && process.env.NODE_ENV === 'production') return res.status(404).end();
        return metricsHandler(req, res);
      });
      loaded(args);
    };
  }
  return loaded;
};
