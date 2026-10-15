import test from 'node:test';
import assert from 'node:assert/strict';
import {requestChat,abortableWait} from '../public/chat-recovery.js';
import {createConversationStorage} from '../public/chat-storage.js';
test('a temporary outage retries the same saved question and returns one complete reply',async()=>{
 const requests=[],waits=[];const result=await requestChat({messages:[{role:'user',content:'Keep this question'}]},{signal:new AbortController().signal,request:async(_,options)=>{requests.push(options.body);return requests.length===1?new Response('',{status:503}):Response.json({content:'Recovered'});},wait:async ms=>waits.push(ms)});
 assert.equal(result.content,'Recovered');assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);assert.deepEqual(waits,[1000]);
});
test('provider cooldown is respected and long limits stop automatic requests',async()=>{
 let calls=0;const waits=[];const result=await requestChat({}, {signal:new AbortController().signal,request:async()=>++calls===1?Response.json({retryAfter:3},{status:429}):Response.json({content:'Ready'}),wait:async ms=>waits.push(ms)});assert.equal(result.content,'Ready');assert.deepEqual(waits,[3000]);
 calls=0;await assert.rejects(requestChat({}, {signal:new AbortController().signal,request:async()=>{calls++;return Response.json({error:'Wait',retryAfter:3600},{status:429});},wait:async()=>assert.fail('Do not wait/retry an exhausted quota')}),error=>error.retryAfter===3600);assert.equal(calls,1);
});
test('Stop cancels retry waits, and permanent setup errors are not repeated',async()=>{
 const controller=new AbortController();const pending=abortableWait(60000,controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
 let calls=0;await assert.rejects(requestChat({}, {signal:new AbortController().signal,request:async()=>{calls++;return Response.json({error:'Not configured'},{status:401});}}),/Not configured/);assert.equal(calls,1);
});
test('chat storage retains more than twenty chats and one hundred turns without retaining screenshot bytes',async()=>{
 const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};const history=Array.from({length:30},(_,i)=>({id:String(i),messages:Array.from({length:160},(_,n)=>({role:n%2?'assistant':'user',content:String(n),images:['private image bytes']}))}));const store=createConversationStorage({database:null,storage});await store.write(history);const restored=await store.read();assert.equal(restored.length,30);assert.equal(restored[0].messages.length,160);assert.equal(restored[0].messages[0].images,undefined);assert.equal(history[0].messages[0].images.length,1);
});
