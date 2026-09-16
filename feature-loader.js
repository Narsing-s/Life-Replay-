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
    const productionRoutes = require(path.join(path.dirname(parent.filename), 'production-routes'));
    return function(args) {
      productionRoutes(args);
      loaded(args);
    };
  }
  return loaded;
};
