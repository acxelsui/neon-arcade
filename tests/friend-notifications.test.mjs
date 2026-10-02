import test from 'node:test';import assert from 'node:assert/strict';
import {initFriendNotifications} from '../accounts/friend-notifications.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=id=>({id,sender_id:'friend',username:'Friend'});
test('only new incoming requests notify, retry across iframe readiness, and expire after 15 seconds',async()=>{
 let rows=[row('old')],time=0;const sent=[];
 const poll=initFriendNotifications({events:new EventTarget(),repeat:()=>0,now:()=>time,getProfile:()=>({id:'me'}),rpc:async()=>rows,send:(type,payload)=>sent.push(payload)});
 await tick();assert.equal(sent.flatMap(p=>p.rows).length,0);
 rows.push(row('new'),{...row('self'),sender_id:'me'});await poll();assert.deepEqual(sent.at(-1).rows.map(r=>r.id),['new']);
 await poll();assert.equal(sent.at(-1).rows[0].id,'new');time=15000;sent.length=0;await poll();assert.equal(sent.length,0);
 rows=[row('new-request-from-same-peer')];await poll();assert.equal(sent.at(-1).rows[0].id,'new-request-from-same-peer');
 rows=[];sent.length=0;await poll();assert.equal(sent.length,0,'accepted or removed requests leave the delivery queue');
});
test('failed refresh never consumes a request and account changes discard delayed private results',async()=>{
 let profile={id:'me'},rows=[],fail=true,resolve;const sent=[];
 let fetch=async()=>{if(fail)throw Error('offline');return rows};
 const poll=initFriendNotifications({events:new EventTarget(),repeat:()=>0,getProfile:()=>profile,rpc:()=>fetch(),send:(type,payload)=>sent.push(payload)});
 await tick();fail=false;await poll();rows=[row('incoming')];fail=true;await poll();fail=false;await poll();assert.equal(sent.at(-1).rows[0].id,'incoming');
 sent.length=0;fetch=()=>new Promise(r=>resolve=r);const pending=poll();profile={id:'another'};resolve([row('secret')]);await pending;assert.equal(sent.length,0);
 fetch=async()=>[row('existing-other')];await poll();assert.deepEqual(sent.at(-1),{self:'another',rows:[]});
});
