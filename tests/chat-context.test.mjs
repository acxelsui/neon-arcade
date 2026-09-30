import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationContext} from '../public/chat-context.js';
test('long conversations keep the opening request and newest question within limits',()=>{
 const history=Array.from({length:101},(_,i)=>({role:i%2?'assistant':'user',content:(i===0?'Opening preference: use examples.':i===100?'Latest question':String(i).repeat(400))}));
 const context=conversationContext(history);assert.equal(context[0].content,history[0].content);assert.equal(context.at(-1).content,'Latest question');assert.ok(context.length<=60);assert.ok(context.reduce((n,m)=>n+m.content.length,0)<=40000);assert.equal(context[1].role,'user');
});
test('screenshot context prioritizes recent images and leaves saved messages untouched',()=>{
 const history=[{role:'user',content:'First',images:['a','b']},{role:'assistant',content:'Reply'},{role:'user',content:'Latest',images:['c','d']}];
 const context=conversationContext(history);assert.deepEqual(context[0].images,['a']);assert.deepEqual(context[2].images,['c','d']);assert.deepEqual(history[0].images,['a','b']);
});
