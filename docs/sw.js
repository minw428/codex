const CACHE='japan-trip-2026-v9-tokyo30-photos';
const SHELL=['./','./index.html','./tokyo30-details.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./food-illustrations.png','./tokyo30-food-illustrations.png','./day-atlas.png','./grill-grand-steak.jpg'];
SHELL.push(...['tsujihan','kaneko','bairin','katsukami2','hikiniku','toritake','newtorigin','kyubey','misaki','moheji','bazoku','ginzatei','sama','bincho','poppy'].map(id=>'./tokyo30-photos/'+id+'.jpg'));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy))}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}
    return response;
  })));
});
