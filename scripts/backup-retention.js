const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const dir=process.env.BACKUP_DIR||path.join(process.env.DATA_DIR||path.join(__dirname,'..','data'),'backups-postgres');
const keep=Math.max(1,Number(process.env.BACKUP_RETENTION_COUNT||14));
if(!fs.existsSync(dir)){console.log(JSON.stringify({ok:true,removed:0,reason:'backup directory does not exist'}));process.exit(0);}
function checksum(file){return new Promise((resolve,reject)=>{const h=crypto.createHash('sha256');const s=fs.createReadStream(file);s.on('data',d=>h.update(d));s.on('error',reject);s.on('end',()=>resolve(h.digest('hex')));});}
(async()=>{
 const dumps=fs.readdirSync(dir).filter(x=>/^lifereplay-.+\.dump$/.test(x)).sort().reverse();
 let verified=0;
 for(const file of dumps){const p=path.join(dir,file);if(fs.statSync(p).size<100)throw new Error(`Invalid backup: ${file}`);await checksum(p);verified++;}
 const removed=[];
 for(const file of dumps.slice(keep)){for(const suffix of ['', '.json']){const p=path.join(dir,file+suffix);if(fs.existsSync(p)){fs.unlinkSync(p);removed.push(path.basename(p));}}}
 console.log(JSON.stringify({ok:true,verified,kept:Math.min(keep,dumps.length),removed},null,2));
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
