import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {loadSuppliedKahoot,attachSuppliedKahoot,suppliedKahootPath} from '../public/kahoot-supplied.js';
test('supplied script matches the uploaded bytes and changed responses are rejected',async()=>{
 const bytes=await readFile(new URL('../public/vendor/kahootx-supplied-20261020.js',import.meta.url));
 const source=await loadSuppliedKahoot({cryptoImpl:webcrypto,fetchImpl:async(path,options)=>{assert.equal(path,suppliedKahootPath);assert.equal(options.credentials,'same-origin');return new Response(bytes);}});
 assert.ok(source.startsWith('(async function __xno_seal_'));
 await assert.rejects(()=>loadSuppliedKahoot({cryptoImpl:webcrypto,fetchImpl:async()=>new Response('changed')}),/changed/);
 await assert.rejects(()=>loadSuppliedKahoot({cryptoImpl:webcrypto,fetchImpl:async()=>new Response('',{status:404})}),/404/);
});
test('replacement runs only once in the top Kahoot player and disposes its readiness checks',()=>{
 let hook,runs=0;const timers=new Map(),messages=[];
 const frame={hooks:{init:{post:{}}}},doc={querySelector:()=>({}),querySelectorAll:()=>[]};
 const player={document:doc,eval:source=>{assert.equal(source,'test fixture only');runs++;}};
 const clock={setInterval:fn=>{timers.set(1,fn);return 1;},clearInterval:id=>timers.delete(id)};
 const dispose=attachSuppliedKahoot(frame,{source:'test fixture only',tap:(_hook,fn)=>hook=fn,clock,onStatus:s=>messages.push(s)});
 const event={window:player,client:{url:new URL('https://kahoot.it/')},isTopLevel:true};
 hook({...event,isTopLevel:false});hook({...event,client:{url:new URL('https://evil.test/')}});assert.equal(runs,0);
 hook(event);hook(event);assert.equal(runs,1);assert.equal(timers.size,1);timers.get(1)();assert.equal(timers.size,0);assert.match(messages.at(-1),/menu loaded/);
 dispose();hook({...event,window:{...player,document:{...doc}}});assert.equal(runs,1);
});
