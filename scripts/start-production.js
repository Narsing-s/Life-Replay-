const { spawnSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  const preflight=spawnSync(process.execPath,[require.resolve('./preflight.js')],{stdio:'inherit',env:process.env});
  if(preflight.status!==0)process.exit(preflight.status||1);
  const schema=spawnSync(process.execPath,[require.resolve('./ensure-postgres-schema.js')],{stdio:'inherit',env:process.env});
  if(schema.status!==0)process.exit(schema.status||1);
  require('../server-production.js');
} else {
  require('../server.js');
}
