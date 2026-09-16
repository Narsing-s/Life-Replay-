const http = require('http');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const IORedis = require('ioredis');

const port=Number(process.env.REALTIME_PORT||4174);
const secret=process.env.JWT_SECRET;
if(!secret||secret==='change-me-in-production'){console.error('JWT_SECRET is required');process.exit(1);}
if(!process.env.REDIS_URL){console.error('REDIS_URL is required');process.exit(1);}
const pub=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const sub=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const sockets=new Map();
const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,service:'life-replay-realtime'}));}res.writeHead(404);res.end();});
const wss=new WebSocketServer({server,path:'/ws'});

function publish(userId,message){return pub.publish(`life-replay:user:${userId}`,JSON.stringify(message));}
sub.psubscribe('life-replay:user:*');
sub.on('pmessage',(_,channel,payload)=>{const userId=channel.split(':').pop();for(const ws of sockets.get(userId)||[]){if(ws.readyState===1)ws.send(payload);}});

wss.on('connection',(ws,req)=>{
  try{
    const protocols=String(req.headers['sec-websocket-protocol']||'').split(',').map(x=>x.trim());
    const url=new URL(req.url,'http://localhost');
    const token=protocols[1]||url.searchParams.get('token');
    const claims=jwt.verify(String(token||''),secret);
    if(claims.purpose!=='realtime')throw new Error('invalid token purpose');
    const userId=String(claims.sub);if(!userId)throw new Error('missing subject');
    if(!sockets.has(userId))sockets.set(userId,new Set());sockets.get(userId).add(ws);
    ws.send(JSON.stringify({type:'connected',userId}));
    ws.on('message',async raw=>{try{const msg=JSON.parse(raw.toString());if(!msg||typeof msg.type!=='string')return;if(msg.type==='ping')return ws.send(JSON.stringify({type:'pong',ts:Date.now()}));if(msg.type==='publish')await publish(userId,{type:'event',event:msg.event||'update',payload:msg.payload||{}});}catch{ws.send(JSON.stringify({type:'error',error:'Invalid realtime message'}));}});
    ws.on('close',()=>{sockets.get(userId)?.delete(ws);if(!sockets.get(userId)?.size)sockets.delete(userId);});
  }catch{ws.close(1008,'Authentication required');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Life Replay realtime gateway listening on ${port}`));
