import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function worker({login=false}={}){
 const handlers={},entries=new Map();let offline=false;
 const cache={put:async(k,v)=>entries.set(k,v.clone()),match:async k=>entries.get(k)?.clone()};
 const scope={location:{origin:'https://folio.test'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const context={self:scope,URL,Response,AbortController,setTimeout,clearTimeout,caches:{open:async()=>cache,keys:async()=>['folio-offline-shell-v4'],delete:async()=>{}},fetch:async(req,options)=>{
  if(offline)throw Error('network offline');
  const path=typeof req==='string'?req:new URL(req.url).pathname;
  // Reproduce production's canonical HTML redirect, which broke v1 installation.
  if(path==='/offline.html'&&options?.redirect==='error')throw Error('redirect rejected');
  const r=new Response(path==='/offline.html'?(login?'sign in':'<meta name="folio-offline-reader" content="2">offline reader'):path==='/'?'live app':'asset',{headers:{'content-type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'}});
  Object.defineProperty(r,'url',{value:'https://folio.test'+(path==='/offline.html'?(login?'/signin':'/offline'):path)});return r;
 }};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 return{handlers,entries,setOffline:()=>{offline=true}};
}
test('installs through canonical redirect and serves both reader URLs and root offline',async()=>{
 const w=worker();let installation;w.handlers.install({waitUntil:p=>installation=p});await installation;assert.equal(w.entries.size,4);w.setOffline();
 for(const path of ['/','/offline','/offline.html?id=abc']){
  let reply;w.handlers.fetch({request:{url:'https://folio.test'+path,method:'GET',mode:'navigate'},respondWith:p=>reply=p});assert.match(await(await reply).text(),/offline reader/);
 }
 let reply;w.handlers.fetch({request:{url:'https://folio.test/offline-reader.js',method:'GET',mode:'cors'},respondWith:p=>reply=p});assert.equal(await(await reply).text(),'asset');
});
test('does not cache a login redirect as the reader',async()=>{
 const w=worker({login:true});let installation;w.handlers.install({waitUntil:p=>installation=p});await assert.rejects(installation,/offline reader asset/);assert.equal(w.entries.has('/offline.html'),false);
});
test('never intercepts private APIs, auth routes or external requests',()=>{const w=worker();for(const url of ['https://folio.test/api/links','https://folio.test/signin-with-chatgpt','https://elsewhere.test/']){let touched=false;w.handlers.fetch({request:{url,method:'GET',mode:'navigate'},respondWith:()=>{touched=true}});assert.equal(touched,false)}});
