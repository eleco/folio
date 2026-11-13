import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTitle,fetchPageTitle,allowedTarget,publicAddress} from '../lib/page-title.ts';
test('extracts titles, decodes entities and prefers Open Graph',()=>{
 assert.equal(extractTitle('<title> A &amp; B &#8212; café </title>'),'A & B — café');
 assert.equal(extractTitle('<title>Fallback</title><meta content="The &quot;real&quot; title" property="og:title">'),'The "real" title');
 assert.equal(extractTitle('<meta name="twitter:title" content="Twitter">'),'Twitter');
 assert.equal(extractTitle('<script>"<meta property=og:title content=Fake>"</script>'),null);
 assert.equal(extractTitle('<title>   </title>'),null);
});
test('rejects local and non-web targets',()=>{
 for(const u of ['http://127.0.0.1','http://2130706433','http://[::1]','http://localhost','http://a.internal','file:///etc/passwd','https://user:pass@example.com','https://example.com:8080'])assert.equal(allowedTarget(new URL(u)),false,u);
 for(const a of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','::1','fc00::1','::ffff:127.0.0.1'])assert.equal(publicAddress(a),false,a);
 assert.equal(publicAddress('93.184.215.14'),true);
});
function mock(fetchPage,dns='93.184.215.14') { return async(input,opts)=>{
 const u=new URL(input);
 if(u.hostname==='cloudflare-dns.com')return Response.json({Status:0,Answer:u.searchParams.get('type')==='A'?[{type:1,data:dns}]:[]});
 return fetchPage(u,opts);
}}
test('fetches public HTML without credentials',async()=>{
 const title=await fetchPageTitle('https://example.com',mock((u,o)=>{assert.equal(o.credentials,'omit');assert.equal(o.redirect,'manual');return new Response('<title>Readable &amp; useful</title>',{headers:{'content-type':'text/html'}})}));
 assert.equal(title,'Readable & useful');
});
test('failures, private DNS and unsafe redirects gracefully fall back',async()=>{
 assert.equal(await fetchPageTitle('https://example.com',mock(()=>new Response('blocked',{status:403}))),null);
 assert.equal(await fetchPageTitle('https://example.com',mock(()=>{throw Error('should not fetch')},'10.0.0.1')),null);
 assert.equal(await fetchPageTitle('https://example.com',mock(()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1'}}))),null);
 assert.equal(await fetchPageTitle('https://example.com',mock(()=>new Response('pdf',{headers:{'content-type':'application/pdf'}}))),null);
});
test('follows safe relative redirects and bounds response size',async()=>{
 assert.equal(await fetchPageTitle('https://example.com',mock(u=>u.pathname==='/'?new Response(null,{status:302,headers:{location:'/article'}}):new Response('<title>Article</title>',{headers:{'content-type':'text/html'}}))),'Article');
 assert.equal(await fetchPageTitle('https://example.com',mock(()=>new Response(' '.repeat(270000)+'<title>Too late</title>',{headers:{'content-type':'text/html'}}))),null);
});
test('article downloads report specific HTTP, DNS and content errors without breaking title fallback',async()=>{
 const {fetchPageHtml}=await import('../lib/page-title.ts');
 await assert.rejects(fetchPageHtml('https://example.com',mock(()=>new Response('blocked',{status:403})),true,true),/HTTP 403/);
 await assert.rejects(fetchPageHtml('https://example.com',async()=>{throw Error('dns failed')},true,true),/look up/);
 await assert.rejects(fetchPageHtml('https://example.com',mock(()=>new Response('pdf',{headers:{'content-type':'application/pdf'}})),true,true),/not an HTML/);
});
test('DNS redirects are rejected without fetching the redirect destination',async()=>{
 const {fetchPageHtml}=await import('../lib/page-title.ts');const calls=[];
 await assert.rejects(fetchPageHtml('https://example.com',async(input,options)=>{
  const url=new URL(input);calls.push(url.hostname);assert.equal(options.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://elsewhere.example/'}});
 },true,true),/look up/);
 assert.ok(calls.every(host=>host==='cloudflare-dns.com'));
});
