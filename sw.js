const CACHE='life-replay-v6';
const CORE=['./','./index.html?v=6','./app.js?v=6','./style.css?v=6','./manifest.webmanifest?v=6','./advanced-experience.js?v=6'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('life-replay-')===0&&k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(function(r){if(r.ok){var copy=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy)}).catch(function(){})}return r}).catch(function(){return caches.match(e.request).then(function(r){return r||caches.match('./index.html')})}))});
