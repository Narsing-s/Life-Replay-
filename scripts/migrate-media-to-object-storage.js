const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createStorage } = require('../storage-adapter');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const db = new Database(path.join(dataDir, 'life-replay.db'));
const storage = createStorage();
if (!storage.remote) { console.error('S3/R2 object storage must be configured before media migration'); process.exit(2); }

(async()=>{
  const rows=db.prepare('SELECT id,user_id,original_name,mime_type,storage_path,checksum FROM media WHERE storage_path IS NOT NULL').all();
  let migrated=0,missing=0;
  for(const row of rows){
    if(!fs.existsSync(row.storage_path)){ missing++; console.warn(`missing: ${row.id} ${row.storage_path}`); continue; }
    const result=await storage.putFile({userId:row.user_id,id:row.id,filePath:row.storage_path,originalName:row.original_name,mimeType:row.mime_type,checksum:row.checksum});
    db.prepare('UPDATE media SET storage_path=? WHERE id=?').run(result.key,row.id);
    migrated++;
  }
  console.log(JSON.stringify({ok:true,migrated,missing,total:rows.length,provider:storage.provider,migratedAt:new Date().toISOString()},null,2));
  db.close();
})().catch(e=>{console.error(e.stack||e);db.close();process.exitCode=1;});
