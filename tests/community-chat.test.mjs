import test from 'node:test';
import assert from 'node:assert/strict';
import {chatRequest,initChatBridge} from '../accounts/chat-bridge.js';
import {chatText} from '../accounts/chat-rules.js';
const peer='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('chat validates input and only exposes explicitly supported operations',()=>{
 assert.equal(chatText(' hello '),'hello');for(const value of ['',null,'x'.repeat(1001)])assert.throws(()=>chatText(value));
 assert.deepEqual(chatRequest({action:'send',text:'hello',peer,sender_id:'forged'}),['neon_chat_send',{message:'hello',peer}]);
 assert.deepEqual(chatRequest({action:'history'}),['neon_chat_history',{peer:null}]);
 assert.throws(()=>chatRequest({action:'history',peer:'other'}));assert.throws(()=>chatRequest({action:'neon_issue_access'}));assert.throws(()=>chatRequest({action:'delete',messageId:'1 OR true'}));
});
test('chat does not return private responses after the account changes',async()=>{
 let profile={id:'one'},complete;const replies=[];
 const handle=initChatBridge({getProfile:()=>profile,send:(...args)=>replies.push(args),rpc:()=>new Promise(resolve=>complete=resolve)});
 const pending=handle({action:'history',requestId:'one'});profile=null;complete([{body:'private'}]);await pending;assert.equal(replies.length,0);
});
test('chat reports missing setup',async()=>{
 const replies=[];const handle=initChatBridge({getProfile:()=>({id:'one'}),send:(type,payload)=>replies.push(payload),rpc:async()=>{throw {code:'PGRST202'}}});
 await handle({action:'history',requestId:'one'});assert.match(replies[0].error,/database setup/);
});
