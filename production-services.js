const crypto = require('crypto');

function env(name, fallback = '') { return String(process.env[name] || fallback).trim(); }
function configured(name) { return Boolean(env(name)); }
function timeoutSignal(ms = Number(env('PROVIDER_TIMEOUT_MS', '15000'))) { return AbortSignal.timeout(ms); }

async function sendEmail({ to, subject, html, text }) {
  const key = env('RESEND_API_KEY'); const from = env('EMAIL_FROM');
  if (!key || !from) throw new Error('Email provider is not configured: RESEND_API_KEY and EMAIL_FROM are required');
  const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' }, signal:timeoutSignal(), body:JSON.stringify({ from,to,subject,html,text:text || html.replace(/<[^>]+>/g,' ') }) });
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
  return response.json();
}

async function askLLM({ question, memories }) {
  const key = env('OPENAI_API_KEY'); if (!key) return null;
  const base = env('OPENAI_BASE_URL','https://api.openai.com/v1').replace(/\/$/,'');
  const model = env('OPENAI_MODEL','gpt-4o-mini');
  const safeContext = memories.slice(0,50).map(m=>({ id:m.id,title:m.title,caption:m.caption,place:m.place,date:m.date,summary:m.summary||'',category:m.category||'',mood:m.mood||'' }));
  const response = await fetch(`${base}/chat/completions`, { method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' }, signal:timeoutSignal(), body:JSON.stringify({ model,temperature:0.2,messages:[{role:'system',content:'You are Life Replay, a private memory assistant. Answer only from the supplied authenticated user memory context. Never invent memories, people, dates, places, or facts. If the context does not answer the question, say so.'},{role:'user',content:JSON.stringify({question,memories:safeContext})}] }) });
  if (!response.ok) throw new Error(`LLM provider returned HTTP ${response.status}`);
  const data = await response.json(); return data.choices?.[0]?.message?.content?.trim() || null;
}

async function embed(texts) {
  const key = env('OPENAI_API_KEY'); if (!key || !texts.length) return null;
  const base = env('OPENAI_BASE_URL','https://api.openai.com/v1').replace(/\/$/,''); const model = env('OPENAI_EMBEDDING_MODEL','text-embedding-3-small');
  const response = await fetch(`${base}/embeddings`, { method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' }, signal:timeoutSignal(), body:JSON.stringify({model,input:texts}) });
  if (!response.ok) throw new Error(`Embedding provider returned HTTP ${response.status}`);
  const data = await response.json(); return (data.data||[]).sort((a,b)=>a.index-b.index).map(x=>x.embedding);
}

async function checkHttp(url, init = {}) {
  if (!url) return { configured:false, reachable:false };
  try { const r = await fetch(url,{...init,signal:timeoutSignal(5000)}); return { configured:true,reachable:r.ok,status:r.status }; } catch { return { configured:true,reachable:false }; }
}

function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}

function providerStatus(){
  return {
    database:{provider:env('DATABASE_URL')?'postgresql':'sqlite',configured:configured('DATABASE_URL')},
    objectStorage:{provider:env('S3_ENDPOINT')||env('R2_ENDPOINT')?'s3-compatible':'filesystem',configured:Boolean(env('S3_ENDPOINT')||env('R2_ENDPOINT'))},
    email:{provider:'resend',configured:configured('RESEND_API_KEY')&&configured('EMAIL_FROM')},
    ai:{provider:'openai-compatible',configured:configured('OPENAI_API_KEY')},
    embeddings:{provider:'openai-compatible',configured:configured('OPENAI_API_KEY')&&configured('OPENAI_EMBEDDING_MODEL')},
    distributedRateLimit:{provider:env('REDIS_URL')?'redis':'process-local',configured:configured('REDIS_URL')},
    transcoding:{provider:env('FFMPEG_PATH')?'ffmpeg':'none',configured:configured('FFMPEG_PATH')},
    malwareScanning:{provider:env('CLAMAV_URL')?'clamav-http':'none',configured:configured('CLAMAV_URL')},
    observability:{provider:env('OTEL_EXPORTER_OTLP_ENDPOINT')?'otlp':'structured-logs',configured:configured('OTEL_EXPORTER_OTLP_ENDPOINT')},
    multiInstance:{ready:Boolean(env('DATABASE_URL')&&(env('S3_ENDPOINT')||env('R2_ENDPOINT'))&&env('REDIS_URL'))}
  };
}

async function connectivityStatus(){
  const status=providerStatus();
  let postgres={configured:false,reachable:false};
  if(env('DATABASE_URL')){try{const {Client}=require('pg');const c=new Client({connectionString:env('DATABASE_URL'),connectionTimeoutMillis:5000});await c.connect();await c.query('SELECT 1');await c.end();postgres={configured:true,reachable:true};}catch{postgres={configured:true,reachable:false};}}
  let redis={configured:false,reachable:false};
  if(env('REDIS_URL')){try{const IORedis=require('ioredis');const r=new IORedis(env('REDIS_URL'),{lazyConnect:true,maxRetriesPerRequest:1});await r.connect();await r.ping();await r.quit();redis={configured:true,reachable:true};}catch{redis={configured:true,reachable:false};}}
  return {...status,connectivity:{postgres,redis}};
}

module.exports={env,configured,sendEmail,askLLM,embed,randomToken,sha256,providerStatus,connectivityStatus};
