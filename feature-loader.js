// Feature routes are installed explicitly by server.js.
// This preload also installs optional production integrations without changing
// the existing feature-routes API surface.
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
      loaded(args);
      productionRoutes(args);
    };
  }
  return loaded;
};
