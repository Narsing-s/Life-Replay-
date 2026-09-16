const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { spawn } = require('child_process');

if(!process.env.REDIS_URL){console.error('REDIS_URL is required for document worker');process.exit(1);}
const connection=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const ocrCommand=process.env.OCR_COMMAND||'';

function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(err||`OCR exited ${code}`)));});}

const worker=new Worker('document-processing',async job=>{
  const {filePath,mimeType}=job.data;
  if(!filePath)throw new Error('filePath is required');
  if(!ocrCommand)return {status:'extracted-pending-ocr',filePath,mimeType};
  const args=JSON.parse(process.env.OCR_ARGS_JSON||'["{input}"]').map(x=>String(x).replace('{input}',filePath));
  const text=await run(ocrCommand,args);
  return {status:'completed',text:text.slice(0,500000),completedAt:new Date().toISOString()};
},{connection,concurrency:Number(process.env.DOCUMENT_WORKER_CONCURRENCY||2)});
worker.on('failed',(job,err)=>console.error('document job failed',job?.id,err));
worker.on('error',err=>console.error('document worker error',err));
console.log('Life Replay document worker started');
