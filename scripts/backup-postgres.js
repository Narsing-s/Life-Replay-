const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawn}=require('child_process');
const databaseUrl=process.env.DATABASE_URL;
const dir=process.env.BACKUP_DIR||path.join(process.env.DATA_DIR||path.join(__dirname,'..','data'),'backups-postgres');
if(!databaseUrl){console.error('DATABASE_URL is required');process.exit(2);}
function run(args){return new Promise((resolve,reject)=>{const p=spawn('pg_dump',args,{stdio:['ignore','pipe','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(err||`pg_dump exited ${c}`)));});}
function digest(file){return new Promise((resolve,reject)=>{const h=crypto.createHash('sha256');const s=fs.createReadStream(file);s.on('data',d=>h.update(d));s.on('error',reject);s.on('end',()=>resolve(h.digest('hex')));});}
(async()=>{fs.mkdirSync(dir,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const out=path.join(dir,`lifereplay-${stamp}.dump`);await run(['--format=custom','--no-owner','--no-privileges','--dbname',databaseUrl,'--file',out]);const stat=fs.statSync(out);if(stat.size<100)throw new Error('Backup is unexpectedly small');const sha256=await digest(out);const manifest={version:2,createdAt:new Date().toISOString(),file:path.basename(out),bytes:stat.size,sha256};fs.writeFileSync(path.join(dir,`${path.basename(out)}.json`),JSON.stringify(manifest,null,2));fs.writeFileSync(`${out}.sha256`,`${sha256}  ${path.basename(out)}\n`);console.log(JSON.stringify({ok:true,backup:out,bytes:stat.size,sha256},null,2));})().catch(e=>{console.error(e.stack||e);process.exit(1);});
