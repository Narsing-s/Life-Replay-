const { spawnSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  const result = spawnSync(process.execPath, [require.resolve('./preflight.js')], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}

require('../server.js');
