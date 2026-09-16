const crypto = require('crypto');

function installProductionExtendedRoutes({ app, q, auth, id, now, storage, enqueue, pool }) {
  const text = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
  const userMemory = async (memoryId, userId) => q('SELECT id,title,caption,place,date,media_url FROM memories WHERE id=$1 AND user_id=$2', [memoryId, userId]);
  const audit = async (userId, action, resourceType, resourceId, metadata = {}) => {
    try { await q('INSERT INTO audit_logs(id,user_id,action,resource_type,resource_id,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,NOW())', [id(), userId, action, resourceType, resourceId, JSON.stringify(metadata)]); } catch {}
  };

  // Rich memory query used by the web client and future mobile/desktop clients.
  app.get('/api/v1/memories/search', auth, async (req, res) => {
    const p = req.query || {};
    const values = [req.user.id];
    const where = ['m.user_id=$1'];
    const add = (sql, value) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
    if (p.q) { values.push(`%${text(p.q, 200)}%`); where.push(`(m.title ILIKE $${values.length} OR m.caption ILIKE $${values.length} OR m.place ILIKE $${values.length} OR COALESCE(mm.summary,'') ILIKE $${values.length})`); }
    if (p.from) add('m.date >= ?', p.from);
    if (p.to) add('m.date <= ?', p.to);
    if (p.category) add('mm.category = ?', text(p.category, 100));
    if (p.favorite === 'true') where.push('COALESCE(mm.favorite,false)=true');
    if (p.pinned === 'true') where.push('COALESCE(mm.pinned,false)=true');
    if (p.trash !== 'true') where.push('COALESCE(mm.deleted_at IS NULL,true)');
    const limit = Math.min(Math.max(Number(p.limit) || 50, 1), 200);
    const r = await q(`SELECT m.*,COALESCE(mm.favorite,false) favorite,COALESCE(mm.pinned,false) pinned,mm.category,mm.mood,mm.summary,mm.lat,mm.lng,mm.address,mm.time,mm.timezone,mm.deleted_at,mm.source FROM memories m LEFT JOIN memory_meta mm ON mm.memory_id=m.id WHERE ${where.join(' AND ')} ORDER BY m.date DESC,m.created_at DESC LIMIT ${limit}`, values);
    res.json({ memories: r.rows.map(x => ({ ...x, mediaUrl: `/api/v1/media/${x.id}`, favorite: Boolean(x.favorite), pinned: Boolean(x.pinned) })) });
  });

  async function toggleOwned(req, res, column) {
    const own = await userMemory(req.params.id, req.user.id);
    if (!own.rowCount) return res.status(404).json({ error: 'Memory not found' });
    const r = await q(`INSERT INTO memory_meta(memory_id,${column}) VALUES($1,true) ON CONFLICT(memory_id) DO UPDATE SET ${column}=NOT COALESCE(memory_meta.${column},false) RETURNING ${column}`, [req.params.id]);
    await audit(req.user.id, `memory.${column}`, 'memory', req.params.id, { value: r.rows[0][column] });
    res.json({ [column]: Boolean(r.rows[0][column]) });
  }
  app.post('/api/v1/memories/:id/favorite', auth, (req,res)=>toggleOwned(req,res,'favorite'));
  app.post('/api/v1/memories/:id/pin', auth, (req,res)=>toggleOwned(req,res,'pinned'));

  app.post('/api/v1/memories/:id/metadata', auth, async (req,res) => {
    if (!(await userMemory(req.params.id, req.user.id)).rowCount) return res.status(404).json({error:'Memory not found'});
    const b=req.body||{};
    const r=await q(`INSERT INTO memory_meta(memory_id,time,timezone,lat,lng,address,category,mood,summary,weather,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(memory_id) DO UPDATE SET time=EXCLUDED.time,timezone=EXCLUDED.timezone,lat=EXCLUDED.lat,lng=EXCLUDED.lng,address=EXCLUDED.address,category=EXCLUDED.category,mood=EXCLUDED.mood,summary=EXCLUDED.summary,weather=EXCLUDED.weather,source=EXCLUDED.source RETURNING *`,[req.params.id,text(b.time,80),text(b.timezone,80)||'UTC',b.lat??null,b.lng??null,text(b.address,500),text(b.category,100)||'memory',text(b.mood,100),text(b.summary,5000),text(b.weather,500),text(b.source,100)||'manual']);
    await audit(req.user.id,'memory.metadata.update','memory',req.params.id);
    res.json({metadata:r.rows[0]});
  });

  // Associations are always checked against the authenticated user's owner records.
  for (const [name, table, join, key] of [['tags','tags','memory_tags','tag_id'],['people','people','memory_people','person_id']]) {
    app.get(`/api/v1/memories/:id/${name}`, auth, async (req,res) => {
      if (!(await userMemory(req.params.id,req.user.id)).rowCount) return res.status(404).json({error:'Memory not found'});
      const r=await q(`SELECT x.* FROM ${table} x JOIN ${join} j ON j.${key}=x.id WHERE j.memory_id=$1 AND x.user_id=$2 ORDER BY x.name`,[req.params.id,req.user.id]);
      res.json({[name]:r.rows});
    });
    app.post(`/api/v1/memories/:id/${name}/:itemId`, auth, async (req,res) => {
      if (!(await userMemory(req.params.id,req.user.id)).rowCount) return res.status(404).json({error:'Memory not found'});
      const own=await q(`SELECT id FROM ${table} WHERE id=$1 AND user_id=$2`,[req.params.itemId,req.user.id]);
      if(!own.rowCount)return res.status(404).json({error:`${name.slice(0,-1)} not found`});
      await q(`INSERT INTO ${join}(memory_id,${key}) VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.params.id,req.params.itemId]);
      res.status(204).end();
    });
    app.delete(`/api/v1/memories/:id/${name}/:itemId`, auth, async (req,res) => {
      if (!(await userMemory(req.params.id,req.user.id)).rowCount) return res.status(404).json({error:'Memory not found'});
      await q(`DELETE FROM ${join} j USING ${table} x WHERE j.${key}=x.id AND j.memory_id=$1 AND x.id=$2 AND x.user_id=$3`,[req.params.id,req.params.itemId,req.user.id]);
      res.status(204).end();
    });
  }

  // Sharing: owner-only creation, explicit memory list, expiry and revocation.
  app.post('/api/v1/shares', auth, async (req,res) => {
    const memories=Array.isArray(req.body?.memoryIds)?req.body.memoryIds.slice(0,100):[];
    if(!memories.length)return res.status(400).json({error:'memoryIds is required'});
    const own=await q('SELECT id FROM memories WHERE user_id=$1 AND id=ANY($2)',[req.user.id,memories]);
    if(own.rowCount!==memories.length)return res.status(403).json({error:'One or more memories are not owned by this account'});
    const shareId=id(), token=crypto.randomBytes(24).toString('base64url');
    const expires=req.body.expiresAt?new Date(req.body.expiresAt):null;
    if(expires && Number.isNaN(expires.getTime()))return res.status(400).json({error:'Invalid expiresAt'});
    const r=await q('INSERT INTO shares(id,user_id,token,title,visibility,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) RETURNING *',[shareId,req.user.id,token,text(req.body.title,200),['private','link'].includes(req.body.visibility)?req.body.visibility:'link',expires]);
    for(const m of memories)await q('INSERT INTO share_items(share_id,memory_id) VALUES($1,$2)',[shareId,m]);
    await audit(req.user.id,'share.create','share',shareId,{count:memories.length});
    res.status(201).json({share:{...r.rows[0],url:`/api/v1/shares/public/${token}`}});
  });
  app.get('/api/v1/shares',auth,async(req,res)=>res.json({shares:(await q('SELECT id,title,visibility,expires_at,created_at,revoked_at,token FROM shares WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id])).rows}));
  app.delete('/api/v1/shares/:id',auth,async(req,res)=>{const r=await q('UPDATE shares SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Share not found'});res.status(204).end();});
  app.get('/api/v1/shares/public/:token',async(req,res)=>{const s=await q('SELECT * FROM shares WHERE token=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())',[req.params.token]);if(!s.rowCount)return res.status(404).json({error:'Share not found or expired'});const items=await q('SELECT m.id,m.title,m.caption,m.place,m.date,m.media_url FROM share_items si JOIN memories m ON m.id=si.memory_id WHERE si.share_id=$1 AND m.user_id=$2',[s.rows[0].id,s.rows[0].user_id]);res.json({share:{id:s.rows[0].id,title:s.rows[0].title,visibility:s.rows[0].visibility,expiresAt:s.rows[0].expires_at},memories:items.rows.map(x=>({...x,mediaUrl:`/api/v1/media/${x.id}`}))});});

  app.get('/api/v1/comments/:memoryId',auth,async(req,res)=>{if(!(await userMemory(req.params.memoryId,req.user.id)).rowCount)return res.status(404).json({error:'Memory not found'});const r=await q('SELECT c.id,c.body,c.created_at,u.id user_id,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.memory_id=$1 ORDER BY c.created_at ASC',[req.params.memoryId]);res.json({comments:r.rows});});
  app.post('/api/v1/comments/:memoryId',auth,async(req,res)=>{if(!(await userMemory(req.params.memoryId,req.user.id)).rowCount)return res.status(404).json({error:'Memory not found'});const body=text(req.body?.body,5000);if(!body)return res.status(400).json({error:'body is required'});const r=await q('INSERT INTO comments(id,memory_id,user_id,body,created_at) VALUES($1,$2,$3,$4,NOW()) RETURNING *',[id(),req.params.memoryId,req.user.id,body]);res.status(201).json({comment:r.rows[0]});});
  app.delete('/api/v1/comments/:id',auth,async(req,res)=>{const r=await q('DELETE FROM comments WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Comment not found'});res.status(204).end();});
  app.post('/api/v1/reactions/:memoryId',auth,async(req,res)=>{if(!(await userMemory(req.params.memoryId,req.user.id)).rowCount)return res.status(404).json({error:'Memory not found'});const reaction=text(req.body?.reaction,50)||'like';const r=await q('INSERT INTO reactions(memory_id,user_id,reaction,created_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(memory_id,user_id) DO UPDATE SET reaction=EXCLUDED.reaction,created_at=NOW() RETURNING *',[req.params.memoryId,req.user.id,reaction]);res.json({reaction:r.rows[0]});});
  app.delete('/api/v1/reactions/:memoryId',auth,async(req,res)=>{await q('DELETE FROM reactions WHERE memory_id=$1 AND user_id=$2',[req.params.memoryId,req.user.id]);res.status(204).end();});

  // Calendar + notifications + replay job state.
  app.get('/api/v1/calendar',auth,async(req,res)=>res.json({events:(await q('SELECT * FROM calendar_events WHERE user_id=$1 ORDER BY start_at DESC LIMIT 500',[req.user.id])).rows}));
  app.post('/api/v1/calendar',auth,async(req,res)=>{const b=req.body||{};if(!b.title||!b.startAt)return res.status(400).json({error:'title and startAt are required'});const r=await q('INSERT INTO calendar_events(id,user_id,title,start_at,end_at,notes,memory_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *',[id(),req.user.id,text(b.title,300),b.startAt,b.endAt||null,text(b.notes,5000),b.memoryId||null]);res.status(201).json({event:r.rows[0]});});
  app.delete('/api/v1/calendar/:id',auth,async(req,res)=>{const r=await q('DELETE FROM calendar_events WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Event not found'});res.status(204).end();});
  app.get('/api/v1/notifications',auth,async(req,res)=>res.json({notifications:(await q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.user.id])).rows}));
  app.post('/api/v1/notifications/:id/read',auth,async(req,res)=>{const r=await q('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id,read_at',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Notification not found'});res.json({notification:r.rows[0]});});
  app.delete('/api/v1/notifications/:id',auth,async(req,res)=>{await q('DELETE FROM notifications WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);res.status(204).end();});

  app.get('/api/v1/replays',auth,async(req,res)=>res.json({replays:(await q('SELECT * FROM replays WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id])).rows}));
  app.post('/api/v1/replays',auth,async(req,res)=>{const r=await q('INSERT INTO replays(id,user_id,title,period_start,period_end,status,narrative,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *',[id(),req.user.id,text(req.body?.title,300)||'Life Replay',req.body?.periodStart||null,req.body?.periodEnd||null,'queued','']);const job=await q('INSERT INTO ai_jobs(id,user_id,type,status,input_json,created_at) VALUES($1,$2,$3,$4,$5::jsonb,NOW()) RETURNING id',[id(),req.user.id,'replay','queued',JSON.stringify({replayId:r.rows[0].id})]);try{await enqueue('ai-processing',{type:'replay',userId:req.user.id,replayId:r.rows[0].id,jobId:job.rows[0].id},{jobId:`replay-${r.rows[0].id}`});}catch{}res.status(202).json({replay:r.rows[0],jobId:job.rows[0].id});});

  app.get('/api/v1/jobs',auth,async(req,res)=>res.json({jobs:(await q('SELECT * FROM ai_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.user.id])).rows}));
  app.get('/api/v1/audit',auth,async(req,res)=>res.json({events:(await q('SELECT * FROM audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500',[req.user.id])).rows}));

  app.get('/api/v1/integrations',auth,async(req,res)=>res.json({integrations:(await q('SELECT provider,status,expires_at,scopes,created_at,updated_at FROM integrations WHERE user_id=$1 ORDER BY provider',[req.user.id])).rows}));
  app.get('/api/v1/imports',auth,async(req,res)=>res.json({imports:(await q('SELECT id,provider,status,cursor,processed_count,error,created_at,completed_at FROM import_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id])).rows}));

  // Explicit capability endpoint: UI must never claim a provider imported data unless a real job exists.
  app.get('/api/v1/capabilities',auth,async(req,res)=>{
    const integrations=(await q('SELECT provider,status FROM integrations WHERE user_id=$1',[req.user.id])).rows;
    const configured=p=>integrations.some(x=>x.provider===p && x.status==='active');
    res.json({googlePhotos:{available:configured('google'),connected:configured('google')},applePhotos:{available:false,connected:false,reason:'Apple Photos provider credentials are not configured'},imports:{history:true},ai:{llm:Boolean(process.env.OPENAI_API_KEY),embeddings:Boolean(process.env.OPENAI_API_KEY)}});
  });

  app.get('/api/v1/map',auth,async(req,res)=>{const r=await q(`SELECT m.id,m.title,m.date,mm.lat,mm.lng,mm.address FROM memories m JOIN memory_meta mm ON mm.memory_id=m.id WHERE m.user_id=$1 AND mm.lat IS NOT NULL AND mm.lng IS NOT NULL AND mm.deleted_at IS NULL ORDER BY m.date DESC LIMIT 5000`,[req.user.id]);res.json({points:r.rows});});

  app.post('/api/v1/documents',auth,async(req,res)=>res.status(501).json({error:'Use the multipart memory upload for documents; OCR processing is queued only when a document worker is deployed'}));
}

module.exports = { installProductionExtendedRoutes };
