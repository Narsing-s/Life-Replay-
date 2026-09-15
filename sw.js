const CACHE='life-replay-v5';
const CORE=['./','./index.html?v=5','./app.js?v=5','./style.css?v=5','./manifest.webmanifest?v=5'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('life-replay-')===0&&k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(function(r){if(r.ok){var copy=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy)}).catch(function(){})}return r}).catch(function(){return caches.match(e.request).then(function(r){return r||caches.match('./index.html')})}))});
