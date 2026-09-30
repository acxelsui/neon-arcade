import test from 'node:test';import assert from 'node:assert/strict';
import {incomingMessages,initMessageNotifications} from '../accounts/message-notifications.js';
test('notification selection excludes sent messages and old history',()=>{
 const rows=[{id:'1',sender_id:'other',username:'Friend',body:'old',created_at:'2026-09-29T10:00:00Z'},{id:'2',sender_id:'other',username:'Friend',body:'new',created_at:'2026-09-29T10:01:00Z'},{id:'3',sender_id:'me',username:'Me',body:'sent',created_at:'2026-09-29T10:02:00Z'}];assert.deepEqual(incomingMessages(rows,'me',Date.parse(rows[0].created_at)).map(r=>r.id),['2']);
});
test('poller silently baselines history and never sends another account private responses',async()=>{
 const oldWindow=globalThis.window,oldInterval=globalThis.setInterval;globalThis.window={addEventListener(){}};globalThis.setInterval=()=>0;
 let profile={id:'me'},time='2026-09-29T10:00:00Z',finish;const sent=[];
 try{
 const poll=initMessageNotifications({getProfile:()=>profile,send:(type,payload)=>sent.push(payload),rpc:async(name)=>name==='neon_chat_conversations'?[{id:'friend',updated_at:time}]:new Promise(resolve=>finish=resolve)});
 await new Promise(r=>setImmediate(r));assert.equal(sent.filter(p=>p.rows.length).length,0);
 time='2026-09-29T10:01:00Z';const pending=poll();await new Promise(r=>setImmediate(r));profile={id:'another'};finish([{id:'2',sender_id:'friend',username:'Friend',body:'private',created_at:time}]);await pending;assert.equal(sent.filter(p=>p.rows.length).length,0);
 }finally{globalThis.window=oldWindow;globalThis.setInterval=oldInterval}
});
import {initMessageToasts} from '../public/message-notifications.js';
test('toast expires after 15 seconds and cannot be replayed by polling or fullscreen',()=>{
 const listeners={},windowListeners={};let timeout;
 class Element{hidden=false;open=false;children=[];setAttribute(){}append(...nodes){this.children.push(...nodes)}remove(){}matches(){return this.open}showPopover(){this.open=true}hidePopover(){this.open=false}}
 const doc={body:new Element(),createElement:()=>new Element(),addEventListener:(name,fn)=>listeners[name]=fn};const parent={};const original={};const mocks={document:doc,window:{addEventListener:(name,fn)=>windowListeners[name]=fn},parent,location:{hostname:'localhost'},setTimeout:(fn,ms)=>{assert.equal(ms,15000);timeout=fn;return 1},clearTimeout(){},requestAnimationFrame:fn=>fn()};
 try{for(const [key,value] of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true})}
 initMessageToasts();const box=doc.body.children[0];const event={source:parent,origin:'http://localhost:3002',data:{channel:'neon-members-v1',type:'message-notifications',self:'me',rows:[{id:'1',sender_id:'friend',username:'Friend',body:'Hello'}]}};
 windowListeners.message({...event,origin:'https://other.example'});assert.equal(box.hidden,true);
 windowListeners.message(event);assert.equal(box.open,true);timeout();assert.equal(box.hidden,true);windowListeners.message(event);listeners.fullscreenchange();assert.equal(box.open,false);
 }finally{for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key]}}
});
test('first DM from a new sender arrives despite an ahead-of-server device clock',async()=>{
 const oldWindow=globalThis.window,oldInterval=globalThis.setInterval;globalThis.window={addEventListener(){}};globalThis.setInterval=()=>0;
 let conversations=[];const sent=[];
 const message={id:'8',sender_id:'friend',username:'Friend',body:'First message',created_at:'2020-01-01T10:00:00Z'};
 try{
 const poll=initMessageNotifications({getProfile:()=>({id:'me'}),send:(type,payload)=>sent.push(payload),rpc:async name=>name==='neon_chat_conversations'?conversations:[message]});
 await new Promise(r=>setImmediate(r));conversations=[{id:'friend',updated_at:message.created_at}];await poll();assert.ok(sent.some(p=>p.rows.some(r=>r.id==='8')));
 sent.length=0;await poll();assert.equal(sent[0].rows[0].id,'8');
 }finally{globalThis.window=oldWindow;globalThis.setInterval=oldInterval}
});
test('one failed conversation does not lose a successfully fetched notification',async()=>{
 const oldWindow=globalThis.window,oldInterval=globalThis.setInterval;globalThis.window={addEventListener(){}};globalThis.setInterval=()=>0;
 let fresh=false;const sent=[];
 try{
 const poll=initMessageNotifications({getProfile:()=>({id:'me'}),send:(type,payload)=>sent.push(payload),rpc:async(name,args)=>{
  if(name==='neon_chat_conversations')return ['friend','broken'].map(id=>({id,updated_at:fresh?'2026-09-29T10:01:00Z':'2026-09-29T10:00:00Z'}));
  if(args.peer==='broken')throw Error('network');return [{id:'9',sender_id:'friend',username:'Friend',body:'Hi',created_at:'2026-09-29T10:01:00Z'}];
 }});
 await new Promise(r=>setImmediate(r));fresh=true;await poll();assert.ok(sent.some(p=>p.rows.some(r=>r.id==='9')));
 sent.length=0;await poll();assert.ok(sent.some(p=>p.rows.some(r=>r.id==='9')),'queued delivery retries even if another conversation still fails');
 }finally{globalThis.window=oldWindow;globalThis.setInterval=oldInterval}
});
