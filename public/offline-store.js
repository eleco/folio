/** @typedef {{id:string,owner:string,url:string,title:string,blocks:Array<{kind:string,text:string}>,words:number,downloadedAt:number}} OfflineArticle */
const DB_NAME='folio-offline-v1';
/** @returns {Promise<any>} */
function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{r.result.createObjectStore('articles',{keyPath:['owner','id']});r.result.createObjectStore('settings');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
/** @returns {Promise<any>} */
async function transaction(store,mode,work){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const request=work(tx.objectStore(store));tx.oncomplete=()=>{db.close();resolve(request?.result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||new Error('Storage cancelled'));};});}
export async function setOwner(owner){await transaction('settings','readwrite',s=>s.put(owner,'owner'));}
export async function getOwner(){return transaction('settings','readonly',s=>s.get('owner'));}
/** @param {OfflineArticle} article */
export async function saveArticle(article){await transaction('articles','readwrite',s=>s.put(article));await setOwner(article.owner);await transaction('settings','readwrite',s=>s.delete('skip:'+article.owner+':'+article.id));}
/** @returns {Promise<OfflineArticle[]>} */
export async function getArticles(){const owner=await getOwner();const rows=await transaction('articles','readonly',s=>s.getAll());return rows.filter(a=>a.owner===owner).sort((a,b)=>b.downloadedAt-a.downloadedAt);}
export async function removeArticle(id){const owner=await getOwner();await transaction('settings','readwrite',s=>s.put(true,'skip:'+owner+':'+id));await transaction('articles','readwrite',s=>s.delete([owner,id]));}
export async function clearArticles(){for(const article of await getArticles())await removeArticle(article.id);}
export async function getAutoSkipped(){const owner=await getOwner();const prefix='skip:'+owner+':';const keys=await transaction('settings','readonly',s=>s.getAllKeys());return keys.filter(k=>typeof k==='string'&&k.startsWith(prefix)).map(k=>k.slice(prefix.length));}
