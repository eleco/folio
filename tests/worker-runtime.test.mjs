import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(import.meta.resolve('@cloudflare/vite-plugin')).resolve('miniflare'));
// Execute the real download function inside workerd. Parsing isn't used here;
// remove only parse5's import to keep this focused runtime fixture self-contained.
const source=readFileSync(new URL('../lib/page-title.ts',import.meta.url),'utf8').replace(/^import .* from 'parse5';\n/m,'');
const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
test('DNS and article request options work in Cloudflare, with no redirect following',async()=>{
 const mf=new Miniflare({modules:true,script:compiled+`
 export default {async fetch(){
  const calls=[];
  const request=async(input,options)=>{
   // Construct a real Workers Request: Node mocks accept unsupported modes.
   const req=new Request(input,options);calls.push({url:req.url,redirect:req.redirect});
   if(new URL(req.url).hostname==='cloudflare-dns.com')return Response.json({Status:0,Answer:[{type:1,data:'93.184.215.14'}]});
   return new Response('<html><body><p>Article text</p></body></html>',{headers:{'content-type':'text/html'}});
  };
  try{return Response.json({html:await fetchPageHtml('https://example.com',request,true,true),calls});}
  catch(error){return Response.json({error:error.message,calls});}
 }};`});
 try{
  const result=await(await mf.dispatchFetch('http://localhost')).json();
  assert.equal(result.error,undefined);assert.match(result.html,/Article text/);assert.equal(result.calls.length,3);
  assert.ok(result.calls.every(c=>c.redirect==='manual'));
 }finally{await mf.dispose();}
});
