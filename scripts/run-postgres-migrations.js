const fs=require('fs');
const path=require('path');
const {Client}=require('pg');
const url=process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL is required');process.exit(2);}
const dir=path.join(__dirname,'..','packages','database','migrations');
const files=fs.readdirSync(dir).filter(f=>/^\d+_.+\.sql$/.test(f)).sort();
(async()=>{
  const db=new Client({connectionString:url,connectionTimeoutMillis:10000});
  await db.connect();
  try{
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    for(const file of files){
      const version=file.replace(/\.sql$/,'');
      const exists=await db.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);
      if(exists.rowCount){console.log(`migration already applied: ${version}`);continue;}
      const sql=fs.readFileSync(path.join(dir,file),'utf8');
      await db.query('BEGIN');
      try{
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);
        await db.query('COMMIT');
        console.log(`migration applied: ${version}`);
      }catch(e){await db.query('ROLLBACK');throw e;}
    }
  }finally{await db.end();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
