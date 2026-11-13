import { fetchPageTitle } from '../../../lib/page-title';
import { z } from 'zod';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { links } from '../../../db/schema';
import { and, eq, desc } from 'drizzle-orm';
export const dynamic = 'force-dynamic';
const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
export async function GET(){ const u=await getChatGPTUser(); if(!u)return json({error:'Please sign in again.'},401); return json(await getDb().select().from(links).where(eq(links.userId,u.userId)).orderBy(desc(links.createdAt))); }
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return json({error:'Please sign in again.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 try {const parsed=z.object({action:z.string(),id:z.string().optional(),url:z.string().optional(),title:z.string().optional()}).safeParse(await req.json());if(!parsed.success)return json({error:'Invalid request'},400);const b=parsed.data;const db=getDb();
 if(b.action==='save'){let url:URL;try{url=new URL(b.url||'')}catch{return json({error:'Enter a valid webpage URL.'},400)}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>8000)return json({error:'Use a normal http or https webpage address.'},400);
 const title=(b.title?.trim() || await fetchPageTitle(url.href) || url.hostname).slice(0,500);const now=Date.now();
 await db.insert(links).values({id:crypto.randomUUID(),userId:u.userId,url:url.href,title,createdAt:now,archived:0}).onConflictDoUpdate({target:[links.userId,links.url],set:{title,createdAt:now,archived:0}});return json({ok:true});}
 if(typeof b.id!=='string')return json({error:'Missing item'},400);
 const owner=and(eq(links.id,b.id),eq(links.userId,u.userId));
 if(b.action==='delete')await db.delete(links).where(owner);
 else if(b.action==='archive'||b.action==='restore')await db.update(links).set({archived:b.action==='archive'?1:0}).where(owner);
 else return json({error:'Unknown action'},400);return json({ok:true});
 }catch{return json({error:'Could not save your change. Please try again.'},500)}
}
