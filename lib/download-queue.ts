export type DownloadState={status:'queued'|'downloading'|'downloaded'|'error'|'removed';error?:string};
export class DownloadQueue {
 states=new Map<string,DownloadState>();listeners=new Set<()=>void>();pending:string[]=[];running=false;valid=new Set<string>();
 private download:(id:string)=>Promise<void>;
 constructor(download:(id:string)=>Promise<void>){this.download=download;}
 notify(){for(const f of this.listeners)f();}
 set(id:string,state:DownloadState){this.states.set(id,state);this.notify();}
 reconcile(ids:string[]){this.valid=new Set(ids);for(const id of ids)if(!this.states.has(id))this.enqueue(id);}
 enqueue(id:string){const s=this.states.get(id)?.status;if(s==='queued'||s==='downloading')return;this.valid.add(id);this.set(id,{status:'queued'});this.pending.push(id);void this.run();}
 remove(id:string){this.valid.delete(id);this.set(id,{status:'removed'});}
 async run(){if(this.running)return;this.running=true;try{while(this.pending.length){const id=this.pending.shift()!;if(!this.valid.has(id)||this.states.get(id)?.status!=='queued')continue;this.set(id,{status:'downloading'});try{await this.download(id);if(this.valid.has(id))this.set(id,{status:'downloaded'});}catch(e){if(this.valid.has(id))this.set(id,{status:'error',error:e instanceof Error?e.message:'Download failed.'});}}}finally{this.running=false;}}
}
