(()=>{
  const BACKEND='https://life-replay-api-91493.containers.snapdeploy.app';
  const token=()=>localStorage.getItem('lifeReplayToken')||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=async(path,opt={})=>{const r=await fetch(BACKEND+path,{...opt,headers:{Accept:'application/json',...(opt.headers||{}),...(opt.body&&!(opt.body instanceof FormData)?{'Content-Type':'application/json'}:{})}});const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{throw new Error(`Server returned non-JSON response (${r.status})`)}if(!r.ok)throw new Error(d.error||d.message||`Request failed (${r.status})`);return d};
  const modal=(title,body)=>{const e=document.createElement('div');e.className='modal';e.innerHTML=`<div class="modalbox"><button class="close">×</button><div class="eyebrow">LIFE REPLAY</div><h2>${esc(title)}</h2>${body}</div>`;document.body.append(e);e.querySelector('.close').onclick=()=>e.remove();return e};
  const info=(title,text)=>modal(title,`<p style="color:#c7cec9;line-height:1.7">${esc(text)}</p>`);
  const authHeaders=()=>token()?{Authorization:'Bearer '+token()}:{};
  const openExisting=id=>{const el=document.getElementById(id);if(el)el.click();else info('Unavailable','This feature is not available in the current client build.')};
  const features=[
    ['＋','Add Memory','Capture a photo, video, audio or document memory.','add'],
    ['◷','Timeline','Browse memories by date, favorites, people, places and tags.','timeline'],
    ['▶','Replay','Generate and explore AI-powered life replays and summaries.','replay'],
    ['◎','Photos & Imports','Upload media, voice memories and connected-provider imports.','photos'],
    ['▣','Documents & OCR','Upload documents and view extraction/processing status.','documents'],
    ['⌕','Search & AI','Ask questions about your own memories and use semantic search when configured.','ai'],
    ['⌖','Map','Explore memories associated with places and locations.','map'],
    ['▤','Calendar','View stored life events and calendar-linked memories.','calendar'],
    ['◌','People','Manage people connected to memories.','people'],
    ['#','Tags','Organize memories with reusable tags.','tags'],
    ['♡','Favorites','Quickly open memories you marked as favorites.','favorites'],
    ['↺','Trash','Review deleted memories before permanent removal.','trash'],
    ['⌁','Replay Jobs','Inspect background AI/import/processing job state.','jobs'],
    ['◉','Account','Current account, Add Memory, another account, profile and export.','account'],
    ['⚙','Settings','Profile, sessions, privacy and provider configuration.','settings'],
    ['⇄','Integrations','Google Photos connection and real import history.','integrations'],
    ['◍','Notifications','View notification records and delivery state.','notifications'],
    ['◈','Security','Sessions, authentication and privacy controls.','security']
  ];
  const style=()=>{if(document.getElementById('lrFeatureStyle'))return;const s=document.createElement('style');s.id='lrFeatureStyle';s.textContent=`#lrFeatureHub{margin-top:28px}.lr-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.lr-head h2{font:400 32px Georgia,serif;margin:6px 0}.lr-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.lr-card{border:1px solid #ffffff12;background:#ffffff06;border-radius:16px;padding:16px;min-height:126px;text-align:left;color:#fff;transition:.18s;display:flex;flex-direction:column;justify-content:space-between}.lr-card:hover{background:#ffffff0c;transform:translateY(-1px);border-color:#d8c6a244}.lr-icon{font-size:22px;color:#d8c6a2}.lr-card b{display:block;margin-top:10px;font-size:15px}.lr-card span{display:block;color:#8f9892;font-size:11px;line-height:1.45;margin-top:5px}.lr-card button{border:0;background:transparent;color:inherit;padding:0;text-align:left}.lr-status{font-size:11px;color:#89928c}.lr-authbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}.lr-chip{border:1px solid #ffffff14;background:#ffffff07;color:#c9cec9;border-radius:999px;padding:7px 10px;font-size:11px}.lr-chip strong{color:#d8c6a2}@media(max-width:1100px){.lr-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.lr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lr-card{min-height:115px}}`;document.head.append(s)};
  const getRows=async(path,keys=['items','memories','events','notifications','people','tags','locations'])=>{const d=await api(path,{headers:authHeaders()});for(const k of keys)if(Array.isArray(d?.[k]))return d[k];if(Array.isArray(d))return d;return[]};
  const listModal=async(title,path,formatter)=>{if(!token())return openExisting('accountBtn');try{const rows=await getRows(path);const body=rows.length?rows.slice(0,50).map(formatter).join(''):'<p style="color:#9da6a0">No records found yet.</p>';modal(title,`<p style="color:#8f9892">${rows.length} record${rows.length===1?'':'s'} available.</p>${body}`)}catch(e){info(title,e.message)}};
  const action=async type=>{
    if(type==='add')return openExisting('enhAddMemory');
    if(type==='timeline')return openExisting('timelineBtn');
    if(type==='replay')return openExisting('replayBtn');
    if(type==='photos')return openExisting('photosBtn');
    if(type==='account'||type==='settings'||type==='security')return openExisting('accountBtn');
    if(!token())return openExisting('accountBtn');
    if(type==='documents')return listModal('Documents','/api/v1/documents',x=>`<div style="padding:10px 0;border-bottom:1px solid #ffffff0d"><b>${esc(x.title||x.filename||'Document')}</b><br><small style="color:#8f9892">${esc(x.status||'uploaded')} · ${esc(x.mimeType||x.mime_type||'')}</small></div>`);
    if(type==='ai')return info('Search & AI','AI features use your authenticated memories. Ask my life, replay generation and semantic search are available when their configured providers are healthy.');
    if(type==='map')return listModal('Map','/api/v1/map',x=>`<div style="padding:10px 0"><b>${esc(x.place||x.name||'Location')}</b><br><small style="color:#8f9892">${esc(x.count||x.memoryCount||'')} memories</small></div>`);
    if(type==='calendar')return listModal('Calendar','/api/v1/calendar/events',x=>`<div style="padding:10px 0;border-bottom:1px solid #ffffff0d"><b>${esc(x.title||x.name||'Event')}</b><br><small style="color:#8f9892">${esc(x.startAt||x.start_at||x.date||'')}</small></div>`);
    if(type==='people')return listModal('People','/api/v1/people',x=>`<div style="padding:10px 0"><b>${esc(x.name||'Person')}</b></div>`);
    if(type==='tags')return listModal('Tags','/api/v1/tags',x=>`<div style="padding:10px 0"><b>#${esc(x.name||'tag')}</b></div>`);
    if(type==='favorites')return listModal('Favorites','/api/v1/memories?favorite=true',x=>`<div style="padding:10px 0"><b>${esc(x.title||'Memory')}</b><br><small style="color:#8f9892">${esc(x.date||'')}</small></div>`);
    if(type==='trash')return listModal('Trash','/api/v1/memories?trash=true',x=>`<div style="padding:10px 0"><b>${esc(x.title||'Deleted memory')}</b><br><small style="color:#8f9892">Deleted memory</small></div>`);
    if(type==='notifications')return listModal('Notifications','/api/v1/notifications',x=>`<div style="padding:10px 0;border-bottom:1px solid #ffffff0d"><b>${esc(x.title||x.type||'Notification')}</b><br><small style="color:#8f9892">${esc(x.message||x.status||'')}</small></div>`);
    if(type==='jobs')return listModal('Background jobs','/api/v1/jobs',x=>`<div style="padding:10px 0;border-bottom:1px solid #ffffff0d"><b>${esc(x.type||x.kind||'Job')}</b><br><small style="color:#8f9892">${esc(x.status||'queued')} · ${esc(x.updatedAt||x.updated_at||'')}</small></div>`);
    if(type==='integrations')return listModal('Integrations','/api/v1/integrations',x=>`<div style="padding:10px 0"><b>${esc(x.provider||'Provider')}</b><br><small style="color:#8f9892">${esc(x.status||'configured')}</small></div>`);
  };
  function mount(){style();const app=document.getElementById('app');if(!app||document.getElementById('lrFeatureHub'))return;const hub=document.createElement('section');hub.id='lrFeatureHub';hub.innerHTML=`<div class="lr-head"><div><div class="eyebrow">EVERYTHING IN ONE PLACE</div><h2>Life Replay features</h2></div><div class="lr-status">All options are visible. Provider-dependent features remain honest until configured.</div></div><div class="lr-authbar"><span class="lr-chip">Storage <strong>private</strong></span><span class="lr-chip">AI <strong>provider-aware</strong></span><span class="lr-chip">Imports <strong>OAuth-aware</strong></span><span class="lr-chip">Background work <strong>queued</strong></span></div><div class="lr-grid">${features.map(([icon,title,desc,type])=>`<button class="lr-card" data-lr-action="${type}"><span class="lr-icon">${icon}</span><span><b>${esc(title)}</b><span>${esc(desc)}</span></span></button>`).join('')}</div>`;app.append(hub);hub.querySelectorAll('[data-lr-action]').forEach(b=>b.onclick=()=>action(b.dataset.lrAction));const add=document.createElement('button');add.id='enhAddMemory';add.style.display='none';document.body.append(add)}
  function patchTopActions(){const actions=document.querySelector('.actions');if(!actions||document.getElementById('lrQuickActions'))return;const wrap=document.createElement('div');wrap.id='lrQuickActions';wrap.className='lr-authbar';wrap.innerHTML=`<span class="lr-chip">Quick actions</span><button class="btn gold" id="lrAddMemory">＋ Add Memory</button><button class="btn" id="lrAccount">◉ Account</button><button class="btn" id="lrPhotos">◎ Photos</button>`;actions.after(wrap);document.getElementById('lrAddMemory').onclick=()=>openExisting('enhAddMemory');document.getElementById('lrAccount').onclick=()=>openExisting('accountBtn');document.getElementById('lrPhotos').onclick=()=>openExisting('photosBtn')}
  const boot=()=>{mount();patchTopActions()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();new MutationObserver(()=>{mount();patchTopActions()}).observe(document.body,{childList:true,subtree:true});
})();