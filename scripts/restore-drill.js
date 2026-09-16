const { spawn } = require('child_process');
const { Client } = require('pg');

const dump = process.argv[2];
const restoreUrl = process.env.RESTORE_DATABASE_URL;
if (!dump || !restoreUrl) { console.error('Usage: RESTORE_DATABASE_URL=<isolated-db> node scripts/restore-drill.js <dump-file>'); process.exit(2); }
if (process.env.ALLOW_RESTORE_DRILL !== 'true') { console.error('Set ALLOW_RESTORE_DRILL=true to explicitly permit restore into the configured isolated database.'); process.exit(2); }

function run(args) { return new Promise((resolve,reject)=>{ const p=spawn('pg_restore',args,{stdio:['ignore','pipe','pipe']}); let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(err||`pg_restore exited ${code}`))); }); }
(async()=>{
  await run(['--clean','--if-exists','--no-owner','--no-privileges','--dbname',restoreUrl,dump]);
  const db=new Client({connectionString:restoreUrl}); await db.connect();
  const users=await db.query('SELECT COUNT(*)::int count FROM users');
  const memories=await db.query('SELECT COUNT(*)::int count FROM memories');
  const media=await db.query('SELECT COUNT(*)::int count FROM media');
  const result={ok:true,restoredAt:new Date().toISOString(),users:users.rows[0].count,memories:memories.rows[0].count,media:media.rows[0].count};
  console.log(JSON.stringify(result,null,2)); await db.end();
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
