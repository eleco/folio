import test from 'node:test';
import assert from 'node:assert/strict';
import {DownloadQueue} from '../lib/download-queue.ts';
const settle=async q=>{while(q.running)await new Promise(resolve=>setTimeout(resolve,1));};
test('backfills sequentially, deduplicates refreshes, continues after failure and handles new links',async()=>{
 const calls=[];let active=0,max=0;
 const q=new DownloadQueue(async id=>{calls.push(id);max=Math.max(max,++active);await new Promise(r=>setTimeout(r,2));active--;if(id==='bad')throw Error('blocked');});
 q.states.set('saved',{status:'downloaded'});q.states.set('removed',{status:'removed'});
 q.reconcile(['saved','removed','a','bad','b']);q.reconcile(['saved','removed','a','bad','b']);await settle(q);
 assert.deepEqual(calls,['a','bad','b']);assert.equal(max,1);assert.equal(q.states.get('bad').status,'error');assert.equal(q.states.get('b').status,'downloaded');
 q.reconcile(['saved','removed','a','bad','b','new']);await settle(q);assert.deepEqual(calls,['a','bad','b','new']);
 q.enqueue('bad');await settle(q);assert.equal(calls.filter(x=>x==='bad').length,2);
});
test('removed links are skipped and an in-flight removal is not marked downloaded',async()=>{
 let finish;const calls=[];const q=new DownloadQueue(id=>{calls.push(id);return new Promise(r=>finish=r)});
 q.reconcile(['first','second']);q.remove('first');q.reconcile([]);finish();await settle(q);assert.deepEqual(calls,['first']);assert.equal(q.states.get('first').status,'removed');
});
