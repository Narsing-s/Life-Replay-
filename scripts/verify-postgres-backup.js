const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const dump = process.argv[2];
if (!dump || !fs.existsSync(dump)) { console.error('Usage: node scripts/verify-postgres-backup.js <dump-file>'); process.exit(2); }

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('pg_restore', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `pg_restore exited ${code}`)));
  });
}
function sha256(file) { return new Promise((resolve, reject) => { const h=crypto.createHash('sha256'); const s=fs.createReadStream(file); s.on('data',d=>h.update(d)); s.on('error',reject); s.on('end',()=>resolve(h.digest('hex'))); }); }

(async () => {
  const stat = fs.statSync(dump);
  if (stat.size < 100) throw new Error('Backup is unexpectedly small');
  const listing = await run(['--list', dump]);
  const required = ['TABLE public.users', 'TABLE public.memories', 'TABLE public.media'];
  const missing = required.filter(x => !listing.includes(x));
  const sha = await sha256(dump);
  const sidecar = `${dump}.sha256`;
  let sidecarOk = true;
  if (fs.existsSync(sidecar)) sidecarOk = fs.readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0] === sha;
  const result = { ok: missing.length === 0 && sidecarOk, file: dump, bytes: stat.size, sha256: sha, requiredObjects: required, missing, sidecarOk, verifiedAt: new Date().toISOString() };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exit(1); });
