const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { productionConfig } = require('../platform-config');
const { createStorage } = require('../storage-adapter');
const { jobFailures } = require('../observability');

const cfg = productionConfig();
if (!process.env.REDIS_URL) { console.error('REDIS_URL is required for media worker'); process.exit(1); }
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const storage = createStorage();
function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{stdio:['ignore','pipe','pipe']});let stderr='';p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`)));});}
async function scan(filePath){if(!cfg.media.clamavUrl)return{skipped:true};const body=await fs.promises.readFile(filePath);const r=await fetch(`${cfg.media.clamavUrl.replace(/\/$/,'')}/scan`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body});if(!r.ok)throw new Error(`ClamAV HTTP ${r.status}`);const result=await r.json().catch(()=>({}));if(result.infected||result.status==='FOUND')throw new Error('Malware scan rejected the uploaded file');return result;}
const worker=new Worker('media-processing',async job=>{const {filePath:supplied,objectKey,mimeType}=job.data;let filePath=supplied;const temporary=!filePath||!fs.existsSync(filePath);if(temporary){if(!objectKey)throw new Error('Media source does not exist');filePath=path.join(os.tmpdir(),`life-replay-${job.id}-${path.basename(objectKey)}`);await storage.downloadToFile(objectKey,filePath);}try{await scan(filePath);let outputPath=null;if(mimeType?.startsWith('video/')&&cfg.media.ffmpeg){outputPath=`${filePath}.processed.mp4`;await run(cfg.media.ffmpeg,['-y','-i',filePath,'-map_metadata','-1','-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-movflags','+faststart',outputPath]);if(storage.remote&&objectKey)await storage.putFile({userId:job.data.userId,id:job.data.memoryId,filePath:outputPath,originalName:`${job.data.memoryId}.mp4`,mimeType:'video/mp4',checksum:job.data.checksum});}return{scanned:true,transcoded:Boolean(outputPath),completedAt:new Date().toISOString()};}finally{if(temporary){try{await fs.promises.unlink(filePath);}catch{}try{await fs.promises.unlink(`${filePath}.processed.mp4`);}catch{}}}},{connection,concurrency:Number(process.env.MEDIA_WORKER_CONCURRENCY||2)});
worker.on('failed',()=>jobFailures.inc({queue:'media-processing'}));worker.on('error',err=>console.error('media worker error',err));console.log('Life Replay media worker started');
