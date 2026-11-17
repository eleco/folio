import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {ownedLink} from '../../../lib/link-service';
import {fetchPageHtml} from '../../../lib/page-title';
import {extractArticle} from '../../../lib/article';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getChatGPTUser();return u?json({owner:u.userId}):json({error:'Please sign in.'},401);}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return json({error:'Please sign in before downloading.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 try{
  const data=await req.json() as {id?:unknown};if(typeof data.id!=='string')return json({error:'Select a saved link.'},400);
  const link=await ownedLink(env.DB!,data.id,u.userId);
  if(!link)return json({error:'Saved link not found.'},404);
  let html:string|null;
  try{html=await fetchPageHtml(link.url,fetch,true,true);}catch(error){return json({error:error instanceof Error?error.message:'Could not reach the article website.'},422);}
  if(!html)return json({error:'This page could not be downloaded. It may require a login, block downloads, be too large, or be temporarily unavailable.'},422);
  const article=extractArticle(html);
  if(!article)return json({error:'No readable article text was found. This page may need JavaScript, require a subscription, or contain too little text.'},422);
  return json({id:link.id,owner:u.userId,url:link.url,title:article.title||link.title,blocks:article.blocks,words:article.words,downloadedAt:Date.now()});
 }catch{return json({error:'Download failed. Your saved link is unchanged. Please try again.'},500)}
}
