import {communityURL} from './community-url';
export const apiJson=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function ownedLink(db:D1Database,id:string,userId:string){return db.prepare('SELECT id,url,title FROM links WHERE id=? AND user_id=?').bind(id,userId).first<{id:string;url:string;title:string}>();}
export async function linkAPI(req:Request,userId:string|null,db:D1Database,findTitle:(url:string)=>Promise<string|null>,validatePublic:(url:string)=>Promise<boolean>){
 if(!userId)return apiJson({error:'Please sign in with ChatGPT.'},401);
 if(req.method==='GET'){
  const rows=await db.prepare('SELECT l.id,l.url,l.title,l.created_at AS createdAt,l.archived,CASE WHEN s.link_id IS NULL THEN 0 ELSE 1 END AS shared FROM links l LEFT JOIN shares s ON s.link_id=l.id AND s.user_id=l.user_id WHERE l.user_id=? ORDER BY l.created_at DESC').bind(userId).all();return apiJson(rows.results);
 }
 if(req.method!=='POST')return apiJson({error:'Method not allowed'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return apiJson({error:'Invalid origin'},403);
 let b:{action?:string;url?:string;title?:string;id?:string};
 try{const raw=await req.text();if(raw.length>12000)return apiJson({error:'Request too large'},413);b=JSON.parse(raw);if(!b||typeof b.action!=='string')throw Error();}catch{return apiJson({error:'Invalid request'},400);}
 if(b.action==='save'){
  let url:URL;try{if(typeof b.url!=='string')throw Error();url=new URL(b.url);}catch{return apiJson({error:'Enter a valid webpage URL.'},400);}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>8000)return apiJson({error:'Use a normal http or https webpage address.'},400);
  if(b.title!==undefined&&typeof b.title!=='string')return apiJson({error:'Invalid title'},400);
  const existing=await db.prepare('SELECT id FROM links WHERE user_id=? AND url=?').bind(userId,url.href).first();
  const count=await db.prepare('SELECT COUNT(*) AS n FROM links WHERE user_id=?').bind(userId).first<{n:number}>();
  if(!existing&&(count?.n||0)>=1000)return apiJson({error:'Your library is full (1,000 links). Remove a link first.'},429);
  const title=(b.title?.trim()||await findTitle(url.href)||url.hostname).slice(0,500);
  await db.prepare('INSERT INTO links(id,user_id,url,title,created_at,archived) VALUES(?,?,?,?,?,0) ON CONFLICT(user_id,url) DO UPDATE SET title=excluded.title,created_at=excluded.created_at,archived=0').bind(crypto.randomUUID(),userId,url.href,title,Date.now()).run();
  return apiJson({ok:true});
 }
 if(typeof b.id!=='string')return apiJson({error:'Select a saved link.'},400);
 const link=await ownedLink(db,b.id,userId);
 if(!link)return apiJson({error:'Saved link not found.'},404);
 if(b.action==='share'){
  let url:string;try{url=communityURL(link.url);}catch(e){return apiJson({error:e instanceof Error?e.message:'Cannot share this link.'},400);}
  if(!await validatePublic(url))return apiJson({error:'Could not verify that this is a public website. Keep it private or try again later.'},400);
  const old=await db.prepare('SELECT link_id FROM shares WHERE user_id=? AND article_url=?').bind(userId,url).first<{link_id:string}>();
  if(old)return old.link_id===link.id?apiJson({ok:true}):apiJson({error:'You already shared another copy of this article.'},409);
  // Bound recent contributions in the database, including concurrent requests.
  await db.batch([
   db.prepare('INSERT INTO articles(url,title) VALUES(?,?) ON CONFLICT(url) DO NOTHING').bind(url,link.title),
   db.prepare('INSERT OR IGNORE INTO shares(link_id,user_id,article_url,shared_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM shares WHERE user_id=? AND shared_at>=?) < 20').bind(link.id,userId,url,Date.now(),userId,Date.now()-86400000)
  ]);
  const shared=await db.prepare('SELECT link_id FROM shares WHERE link_id=? AND user_id=?').bind(link.id,userId).first();
  return shared?apiJson({ok:true}):apiJson({error:'You can contribute up to 20 articles in 24 hours. Try again later.'},429);
 }
 if(b.action==='unshare')await db.prepare('DELETE FROM shares WHERE link_id=? AND user_id=?').bind(link.id,userId).run();
 else if(b.action==='delete')await db.batch([db.prepare('DELETE FROM shares WHERE link_id=? AND user_id=?').bind(link.id,userId),db.prepare('DELETE FROM links WHERE id=? AND user_id=?').bind(link.id,userId)]);
 else if(b.action==='archive'||b.action==='restore')await db.prepare('UPDATE links SET archived=? WHERE id=? AND user_id=?').bind(b.action==='archive'?1:0,link.id,userId).run();
 else return apiJson({error:'Unknown action'},400);
 return apiJson({ok:true});
}
export async function trendingAPI(userId:string|null,db:D1Database){
 if(!userId)return apiJson({error:'Please sign in with ChatGPT.'},401);
 const rows=await db.prepare('SELECT a.url,a.title,COUNT(DISTINCT s.user_id) AS saves,MAX(s.shared_at) AS latest FROM shares s JOIN articles a ON a.url=s.article_url JOIN links l ON l.id=s.link_id AND l.user_id=s.user_id WHERE s.shared_at>=? GROUP BY a.url,a.title ORDER BY saves DESC,latest DESC,a.url LIMIT 50').bind(Date.now()-7*86400000).all();return apiJson(rows.results);
}
