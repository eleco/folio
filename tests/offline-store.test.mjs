import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveArticle,getArticles,removeArticle,clearArticles,setOwner} from '../public/offline-store.js';
test('persists full text, separates accounts, removes downloads without touching other copies',async()=>{
 const a={id:'one',owner:'alice',title:'Article',url:'https://example.com',blocks:[{kind:'paragraph',text:'The offline body'}],words:3,downloadedAt:1};
 await saveArticle(a);assert.deepEqual(await getArticles(),[a]);await setOwner('bob');assert.deepEqual(await getArticles(),[]);
 const b={...a,owner:'bob',title:'Other account'};await saveArticle(b);assert.deepEqual(await getArticles(),[b]);await removeArticle('one');assert.deepEqual(await getArticles(),[]);
 await setOwner('alice');assert.deepEqual(await getArticles(),[a]);await clearArticles();assert.deepEqual(await getArticles(),[]);
});
test('explicitly removed downloads stay excluded from automatic backfill, manual saves reset exclusion',async()=>{
 const {getAutoSkipped}=await import('../public/offline-store.js');await setOwner('carol');
 const a={id:'auto',owner:'carol',title:'Article',url:'https://example.com',blocks:[],words:0,downloadedAt:1};
 await saveArticle(a);await removeArticle('auto');assert.deepEqual(await getAutoSkipped(),['auto']);
 await setOwner('dave');assert.deepEqual(await getAutoSkipped(),[]);await saveArticle(a);assert.deepEqual(await getAutoSkipped(),[]);
});
