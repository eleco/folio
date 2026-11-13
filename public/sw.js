const CACHE='folio-offline-shell-v3';
const FILES=['/offline.html','/offline.css','/offline-reader.js','/offline-store.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Hosting canonicalizes /offline.html to /offline. Follow that redirect,
 // but validate the final URL, MIME type and reader marker before caching.
 await Promise.all(FILES.map(async path=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(path,{cache:'reload',credentials:'same-origin',redirect:'follow',signal:controller.signal});
   const finalURL=new URL(response.url||path,self.location.origin);
   const expected=path==='/offline.html'?['/offline.html','/offline']:[path];
   const type=response.headers.get('content-type')||'';
   const mime=path.endsWith('.js')?/javascript/:path.endsWith('.css')?/text\/css/:/text\/html/;
   if(!response.ok||finalURL.origin!==self.location.origin||!expected.includes(finalURL.pathname)||!mime.test(type))throw Error('Could not load offline reader asset: '+path);
   const body=await response.text();
   if(path==='/offline.html'&&!body.includes('name="folio-offline-reader"'))throw Error('Offline reader requires sign-in');
   // Store a fresh response so the canonical redirect is not replayed offline.
   await cache.put(path,new Response(body,{status:200,headers:{'Content-Type':type}}));
  }finally{clearTimeout(timer);}
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('folio-offline-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 // Only the generic reader shell is cached. No authenticated API, login or account responses.
 if(FILES.includes(url.pathname)||url.pathname==='/offline'){event.respondWith((async()=>{const cached=await (await caches.open(CACHE)).match(url.pathname==='/offline'?'/offline.html':url.pathname);return cached||fetch(event.request);})());return;}
 if(event.request.mode==='navigate'&&url.pathname==='/'){
  event.respondWith((async()=>{try{const response=await fetch(event.request);return response;}catch{const fallback=await(await caches.open(CACHE)).match('/offline.html');return fallback||new Response('Open Folio online once to prepare offline reading.',{status:503});}})());
 }
});
