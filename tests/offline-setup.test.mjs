import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForActivation} from '../lib/offline-setup.ts';
class Worker extends EventTarget {state='installing';set(state){this.state=state;this.dispatchEvent(new Event('statechange'));}}
test('failed installations reject immediately instead of waiting for ready forever',async()=>{
 const worker=new Worker();const pending=waitForActivation(worker);worker.set('redundant');await assert.rejects(pending,/Could not prepare/);
});
test('activation resolves for new and already active workers',async()=>{
 const worker=new Worker();const pending=waitForActivation(worker);worker.set('activated');await pending;await waitForActivation(worker);
});
test('stalled installation has a bounded wait',async()=>{await assert.rejects(waitForActivation(new Worker(),5),/taking too long/)});
