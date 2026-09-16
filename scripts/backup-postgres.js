const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const databaseUrl=process.env.DATABASE_URL;
const dir=process.env.BACKUP_DIR||path.join(process.env.DATA_DIR||path.join(__dirname,'..','data'),'backups-postgres');
if(!databaseUrl){console.error('DATABASE_URL is required');process.exit(2);}
function run(args){return new Promise((resolve,reject)=>{const p=spawn('pg_dump',args,{stdio:['ignore','pipe','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(err||`pg_dump exited ${c}`)));});}
(async()=>{fs.mkdirSync(dir,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const out=path.join(dir,`lifereplay-${stamp}.dump`);await run(['--format=custom','--no-owner','--no-privileges','--dbname',databaseUrl,'--file',out]);const stat=fs.statSync(out);if(stat.size<100)throw new Error('Backup is unexpectedly small');const manifest={version:1,createdAt:new Date().toISOString(),file:path.basename(out),bytes:stat.size};fs.writeFileSync(path.join(dir,`${path.basename(out)}.json`),JSON.stringify(manifest,null,2));console.log(JSON.stringify({ok:true,backup:out,bytes:stat.size},null,2));})().catch(e=>{console.error(e.stack||e);process.exit(1);});
