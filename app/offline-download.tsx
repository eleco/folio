'use client';
import {useEffect,useState} from 'react';
import {Download,Check,Trash2,BookOpen} from 'lucide-react';
import {getArticles,saveArticle,removeArticle,setOwner,getAutoSkipped} from '../public/offline-store.js';
import {prepareOffline} from '../lib/offline-setup';
import {DownloadQueue} from '../lib/download-queue';
const queue=new DownloadQueue(async id=>{
 if(!navigator.onLine)throw Error('You are offline. Reconnect and tap Retry download.');
 await prepareOffline();
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),40000);
 try{
  const r=await fetch('/api/offline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),signal:controller.signal});
  if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Reload Folio and sign in before downloading.');
  const data=await r.json() as Parameters<typeof saveArticle>[0]&{error?:string};if(!r.ok)throw Error(data.error||'Download failed.');
  if(queue.valid.has(id)&&queue.states.get(id)?.status!=='removed')await saveArticle(data);
 }catch(e){if(controller.signal.aborted)throw Error('The download took too long. Tap Retry download.');throw e;}finally{clearTimeout(timer);}
});
function useQueue(){const [,render]=useState(0);useEffect(()=>{const update=()=>render(n=>n+1);queue.listeners.add(update);return()=>{queue.listeners.delete(update)}},[]);}
export function cancelDownload(id:string){queue.remove(id);}
export function useAutomaticDownloads(items:{id:string}[]){
 const [online,setOnline]=useState(0);
 useEffect(()=>{const resume=()=>{for(const [id,s] of queue.states)if(s.status==='error')queue.states.delete(id);setOnline(n=>n+1)};window.addEventListener('online',resume);return()=>window.removeEventListener('online',resume)},[]);
 useEffect(()=>{let cancelled=false;async function sync(){
  if(!navigator.onLine||!items.length)return;
  const r=await fetch('/api/offline',{cache:'no-store'});if(!r.ok)throw Error('Sign in again to prepare offline downloads.');
  const {owner}=await r.json() as {owner:string};if(cancelled)return;await setOwner(owner);
  const [articles,skipped]=await Promise.all([getArticles(),getAutoSkipped()]);if(cancelled)return;
  for(const a of articles)queue.states.set(a.id,{status:'downloaded'});
  for(const id of skipped)queue.states.set(id,{status:'removed'});
  queue.reconcile(items.map(a=>a.id));queue.notify();
 }void sync().catch(()=>{if(!cancelled)for(const item of items)if(!queue.states.has(item.id))queue.set(item.id,{status:'error',error:'Could not start automatic downloads. Check your connection and tap Retry download.'});});return()=>{cancelled=true}},[items,online]);
}
export function DownloadProgress(){useQueue();const states=[...queue.states.values()];const pending=states.filter(s=>s.status==='queued'||s.status==='downloading').length;const failed=states.filter(s=>s.status==='error').length;return <p className="hint" role="status">{pending?`Preparing ${pending} offline ${pending===1?'copy':'copies'} in the background… Keep Folio open until finished.`:failed?`${failed} offline ${failed===1?'copy needs':'copies need'} attention. See the message on each article.`:'Articles download automatically on this device while Folio is open.'}</p>;}
export default function OfflineDownload({id}:{id:string}){
 useQueue();const state=queue.states.get(id);const downloaded=state?.status==='downloaded';const busy=state?.status==='queued'||state?.status==='downloading';
 async function remove(){queue.remove(id);try{await removeArticle(id)}catch{queue.set(id,{status:'error',error:'Could not remove this download. Try again.'})}}
 return <div className="offline-controls">{downloaded?<><span className="offline-badge"><Check size={12}/> Available offline</span><div className="offline-actions"><a href={'/offline.html?id='+encodeURIComponent(id)}><BookOpen size={14}/> Read offline</a><button onClick={remove} aria-label="Remove offline copy" title="Remove offline copy"><Trash2 size={14}/></button></div></>:<button className="download-text" onClick={()=>queue.enqueue(id)} disabled={busy}><Download size={14}/>{state?.status==='queued'?'Queued for download…':busy?'Downloading text…':state?.status==='error'?'Retry download':'Download text'}</button>}{state?.error&&<p className="download-error" role="alert">{state.error}</p>}</div>;
}
