import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatchedRenderer} from '../public/render-batches.js';
test('large libraries yield before completing and preserve every item in order',async()=>{
 const waiting=[],shown=[];const render=createBatchedRenderer({size:36,schedule:fn=>waiting.push(fn)});
 const items=Array.from({length:993},(_,i)=>i),done=render(items,part=>shown.push(...part));
 assert.equal(shown.length,36);
 while(waiting.length){waiting.shift()();await Promise.resolve();}
 assert.equal(await done,true);assert.deepEqual(shown,items);
});
test('a newer search cancels stale batches before they can mix into its results',async()=>{
 const waiting=[],shown=[];const render=createBatchedRenderer({size:2,schedule:fn=>waiting.push(fn)});
 const old=render([1,2,3,4],part=>shown.push(...part));shown.length=0;
 assert.equal(await render(['new'],part=>shown.push(...part)),true);
 waiting.shift()();assert.equal(await old,false);assert.deepEqual(shown,['new']);
});
