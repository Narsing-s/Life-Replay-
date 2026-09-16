const { spawnSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  const preflight=spawnSync(process.execPath,[require.resolve('./preflight.js')],{stdio:'inherit',env:process.env});
  if(preflight.status!==0)process.exit(preflight.status||1);
  const migrations=spawnSync(process.execPath,[require.resolve('./run-postgres-migrations.js')],{stdio:'inherit',env:process.env});
  if(migrations.status!==0)process.exit(migrations.status||1);
  require('../server-production-v2.js');
} else {
  require('../server.js');
}
