import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationReplies} from '../public/notification-replies.js';
const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',peer='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function transport(){let current=owner,seq=0;const sent=[],timers=new Map();const client=createNotificationReplies({getOwner:()=>current,post:data=>sent.push(data),newId:()=>String(++seq),setTimer:fn=>{timers.set(seq,fn);return seq},clearTimer:id=>timers.delete(id)});return {client,sent,timers,switchOwner:id=>current=id}}
test('a notification reply sends only a private message to its sender',async()=>{
 const f=transport(),done=f.client.send(peer,' hello ');assert.equal(f.sent[0].action,'send');assert.equal(f.sent[0].peer,peer);assert.equal(f.sent[0].text,'hello');
 f.client.receive({type:'chat-result',requestId:'unknown',self:owner});assert.equal(f.timers.size,1);f.client.receive({type:'chat-result',requestId:'1',self:owner,result:null});await done;assert.equal(f.timers.size,0);
});
test('invalid replies cannot become public-room messages or bypass limits',async()=>{
 const f=transport();for(const [to,text] of [[null,'hi'],[owner,'hi'],['invalid','hi'],[peer,'   '],[peer,'x'.repeat(1001)]])await assert.rejects(f.client.send(to,text));assert.equal(f.sent.length,0);
});
test('moderation failures preserve errors and account changes discard outstanding replies',async()=>{
 const f=transport(),done=f.client.send(peer,'hello');f.client.receive({type:'chat-result',requestId:'1',error:'You are muted until tomorrow'});await assert.rejects(done,/muted/);
 const next=f.client.send(peer,'another');f.switchOwner(peer);f.client.receive({type:'chat-result',requestId:'2',self:owner});await assert.rejects(next,/account changed/);
 f.switchOwner(owner);const reset=f.client.send(peer,'last');f.client.reset();await assert.rejects(reset,/account changed/);assert.equal(f.timers.size,0);
});
test('a connection timeout can be retried without falsely confirming delivery',async()=>{
 const f=transport(),done=f.client.send(peer,'hello');[...f.timers.values()][0]();await assert.rejects(done,/connect/);
 const next=f.client.send(peer,'hello');f.client.receive({type:'chat-result',requestId:'2',self:owner});await next;
});
