const CACHE='japan-trip-2026-v12-tokyo30-recommendation-reasons';
const SHELL=['./','./index.html','./tokyo30-details.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./food-illustrations.png','./tokyo30-food-illustrations.png','./day-atlas.png','./grill-grand-steak.jpg'];
SHELL.push(...['tsujihan','kaneko','bairin','katsukami2','hikiniku','toritake','newtorigin','kyubey','misaki','moheji','bazoku','ginzatei','sama','bincho','poppy'].map(id=>'./tokyo30-photos/'+id+'.jpg'));
SHELL.push('./tokyo30-details.js?v=20261009-recommendation-reasons');
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  // HTML and executable assets must not mix fresh markup with old cached data.
  if(request.mode==='navigate'||request.destination==='script'||request.destination==='style'){
    event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request.mode==='navigate'?'./index.html':request,copy))}
      return response;
    }).catch(()=>caches.match(request.mode==='navigate'?'./index.html':request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}
    return response;
  })));
});
