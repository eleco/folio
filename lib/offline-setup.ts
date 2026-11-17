// Observe the actual registration: ready never rejects when installation fails.
export function waitForActivation(worker: ServiceWorker, timeout=25000): Promise<void> {
 return new Promise((resolve,reject)=>{
  const done=(error?:Error)=>{clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve();};
  const check=()=>{
   if(worker.state==='activated')done();
   else if(worker.state==='redundant')done(Error('Could not prepare the offline reader. Check your connection, reload Folio and retry.'));
  };
  const timer=setTimeout(()=>done(Error('Offline reader setup is taking too long. Check your connection and retry.')),timeout);
  worker.addEventListener('statechange',check);check();
 });
}
let setup:Promise<void>|undefined;
export function prepareOffline():Promise<void>{
 if(setup)return setup;
 setup=(async()=>{
  if(!('serviceWorker'in navigator)||!window.isSecureContext)throw Error('Offline reading needs a secure browser with service workers enabled.');
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  // Force an update for browsers with the earlier broken installation.
  await registration.update();
  const worker=registration.installing||registration.waiting||registration.active;
  if(!worker)throw Error('Offline reader did not install. Reload Folio and retry.');
  await waitForActivation(worker);
  const cache=await caches.open('folio-offline-shell-v4');
  for(const asset of ['/offline.html','/offline.css','/offline-reader.js','/offline-store.js'])
   if(!await cache.match(asset))throw Error('Offline reader setup is incomplete. Please reload and retry.');
 })().catch(e=>{setup=undefined;throw e;});return setup;
}
