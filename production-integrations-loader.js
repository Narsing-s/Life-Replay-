const Module = require('module');
const path = require('path');
const originalLoad = Module._load;
let wrapped = false;

Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (!wrapped && request === './production-extended-routes' && parent && path.basename(parent.filename) === 'server-production-v2.js') {
    wrapped = true;
    const integrations = require(path.join(path.dirname(parent.filename), 'production-integrations'));
    return {
      ...loaded,
      installProductionExtendedRoutes(args) {
        loaded.installProductionExtendedRoutes(args);
        integrations.installProductionIntegrations(args);
      }
    };
  }
  return loaded;
};
