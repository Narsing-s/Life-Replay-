const fs=require('fs');
const path=require('path');
const {Client}=require('pg');
const url=process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL is required');process.exit(2);}
const schema=fs.readFileSync(path.join(__dirname,'..','packages/database/migrations/001_initial.sql'),'utf8');
(async()=>{const db=new Client({connectionString:url,connectionTimeoutMillis:10000});await db.connect();try{await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');const version='001_initial';const exists=await db.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);if(!exists.rowCount){await db.query('BEGIN');await db.query(schema);await db.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);await db.query('COMMIT');console.log('PostgreSQL schema applied:',version);}else console.log('PostgreSQL schema already applied:',version);}catch(e){try{await db.query('ROLLBACK');}catch{}throw e;}finally{await db.end();}})().catch(e=>{console.error(e.stack||e);process.exit(1);});
