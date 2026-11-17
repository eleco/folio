import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {communityURL} from '../lib/community-url.ts';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(import.meta.resolve('@cloudflare/vite-plugin')).resolve('miniflare'));
test('public URLs strip tracking, preserve content IDs and reject obvious private/token links',()=>{
 assert.equal(communityURL('https://example.com/read?id=42&utm_source=email#section'),'https://example.com/read?id=42');
 for(const url of ['http://localhost/a','https://127.0.0.1/a','https://host.internal/a','https://example.com/a?access_token=abc','https://user:pass@example.com/a','https://example.com/reset/key','https://example.com/a?X-Amz-Signature=secret'])assert.throws(()=>communityURL(url),undefined,url);
});
test('real D1: user isolation, opt-in ranking, deduplication, privacy and retraction',async t=>{
 const source=['community-url.ts','link-service.ts'].map(f=>readFileSync(new URL('../lib/'+f,import.meta.url),'utf8').replace(/^import .*;\n/gm,'')).join('\n');
 const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
 const mf=new Miniflare({modules:true,d1Databases:['DB'],script:compiled+`
 export default{async fetch(req,env){
  const user=req.headers.get('x-test-user');
  if(new URL(req.url).pathname==='/trending')return trendingAPI(user,env.DB);
  if(new URL(req.url).pathname==='/offline-owner')return apiJson(user?await ownedLink(env.DB,new URL(req.url).searchParams.get('id'),user):null);
  return linkAPI(req,user,env.DB,async()=>null,async url=>!url.includes('private.example'));
 }};`});
 try{
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
  const call=async(user,body,path='/',origin='http://folio.test')=>{const headers={};if(user)headers['x-test-user']=user;if(body)headers.origin=origin;return mf.dispatchFetch('http://folio.test'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});};
  const list=async user=>(await call(user)).json();const trending=async()=>(await call('alice',null,'/trending')).json();
  const save=async(user,url,title)=>{assert.equal((await call(user,{action:'save',url,title})).status,200);return(await list(user)).find(l=>l.url===url);};
  await t.test('anonymous and cross-origin writes rejected',async()=>{assert.equal((await call(null)).status,401);assert.equal((await call(null,null,'/trending')).status,401);assert.equal((await call('alice',{action:'save',url:'https://example.com/'},'/','http://evil.test')).status,403);});
  const a=await save('alice','https://example.com/story?utm_source=mail','Good read');const b=await save('bob','https://example.com/story','Good read');
  await t.test('saves are private; other users cannot read, mutate, share or download them',async()=>{
   assert.equal((await list('bob')).length,1);assert.equal((await list('bob'))[0].id,b.id);assert.deepEqual(await trending(),[]);
   for(const action of ['share','unshare','archive','restore','delete'])assert.equal((await call('bob',{action,id:a.id})).status,404);
   assert.equal(await(await call('bob',null,'/offline-owner?id='+a.id)).json(),null);assert.equal((await(await call('alice',null,'/offline-owner?id='+a.id)).json()).id,a.id);
  });
  await t.test('explicit shares count distinct users; tracking variants and retries cannot inflate ranking',async()=>{
   for(const userLink of [['alice',a],['bob',b]])assert.equal((await call(userLink[0],{action:'share',id:userLink[1].id})).status,200);
   const before=await db.prepare('SELECT shared_at FROM shares WHERE link_id=?').bind(a.id).first();await call('alice',{action:'share',id:a.id});assert.deepEqual(await db.prepare('SELECT shared_at FROM shares WHERE link_id=?').bind(a.id).first(),before);
   const copy=await save('alice','https://example.com/story?utm_campaign=other','Copy');assert.equal((await call('alice',{action:'share',id:copy.id})).status,409);
   const rows=await trending();assert.equal(rows.length,1);assert.equal(rows[0].saves,2);assert.equal(rows[0].url,'https://example.com/story');assert.deepEqual(Object.keys(rows[0]).sort(),['latest','saves','title','url']);
  });
  await t.test('saving a trending article stays private; unsharing and deleting retract contributions',async()=>{
   await save('charlie','https://example.com/story','Copied from trending');assert.equal((await trending())[0].saves,2);
   await call('alice',{action:'unshare',id:a.id});assert.equal((await trending())[0].saves,1);assert.ok((await list('alice')).some(l=>l.id===a.id));await call('bob',{action:'delete',id:b.id});assert.deepEqual(await trending(),[]);
  });
  await t.test('seven-day window, sensitive URL blocking and public DNS validation',async()=>{
   await call('alice',{action:'share',id:a.id});await db.prepare('UPDATE shares SET shared_at=? WHERE link_id=?').bind(Date.now()-8*86400000,a.id).run();assert.deepEqual(await trending(),[]);
   for(const url of ['https://example.com/a?token=secret','https://private.example/story']){const link=await save('alice',url,'Private');assert.equal((await call('alice',{action:'share',id:link.id})).status,400);}assert.deepEqual(await trending(),[]);
  });
  await t.test('contribution cap blocks the 21st recent share',async()=>{
   for(let i=0;i<20;i++){
    const link=await save('limited','https://example.com/post/'+i,'Article '+i);
    assert.equal((await call('limited',{action:'share',id:link.id})).status,200);
   }
   const extra=await save('limited','https://example.com/extra','Extra');
   assert.equal((await call('limited',{action:'share',id:extra.id})).status,429);
  });
 }finally{await mf.dispose();}
});
