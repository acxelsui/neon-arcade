import test from 'node:test';import assert from 'node:assert/strict';
import {initMessageToasts} from '../public/message-notifications.js';
const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',peer='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function harness(){
 const original={},listeners=new Map(),docEvents={},timers=new Map(),sent=[],dispatched=[];let timerId=0;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.hidden=false;this.open=false;}
  setAttribute(name,value){this[name]=value}append(...nodes){for(const node of nodes){node.remove();node.host=this;this.children.push(node)}}
  remove(){if(this.host)this.host.children=this.host.children.filter(node=>node!==this);this.host=null}
  contains(node){return node===this||this.children.some(child=>child.contains(node))}
  addEventListener(name,fn){this.events[name]=fn}matches(){return this.open}showPopover(){this.open=true}hidePopover(){this.open=false}
 }
 const doc={body:new Element('body'),createElement:tag=>new Element(tag),addEventListener:(name,fn)=>docEvents[name]=fn,querySelector:()=>null};
 const parent={postMessage:(data,origin)=>sent.push({data,origin})};
 const mocks={document:doc,parent,location:{hostname:'localhost'},window:{addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn)},dispatchEvent:event=>dispatched.push(event)},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn()};
 for(const [key,value] of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true})}
 initMessageToasts();const box=doc.body.children[0];
 const deliver=(data,source=parent,origin='http://localhost:3002')=>{for(const listener of listeners.get('message'))listener({source,origin,data:{channel:'neon-members-v1',...data}})};
 deliver({type:'members',self:{id:owner}});
 return {box,doc,docEvents,timers,sent,dispatched,deliver,friend:(id='request')=>deliver({type:'friend-notifications',self:owner,rows:[{id,sender_id:peer,username:'Friend'}]}),restore(){for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key]}}};
}
test('friend toast rejects forged origins and senders, accepts only acknowledged actions, and stays above fullscreen',async()=>{
 const h=harness();try{
  const data={type:'friend-notifications',self:owner,rows:[{id:'request',sender_id:peer,username:'Friend'}]};
  h.deliver(data,{},'http://localhost:3002');h.deliver(data,undefined,'https://evil.test');h.deliver({...data,rows:[{id:'forged',sender_id:'not-a-uuid',username:'Fake'}]});assert.equal(h.box.hidden,true);
  h.friend();h.friend();assert.equal(h.box.children.length,1);assert.equal(h.box.open,true);
  const card=h.box.children[0],controls=card.children.find(el=>el.className==='notification-friend-actions'),status=card.children.at(-1);
  const pending=controls.children[1].onclick();await controls.children[1].onclick();assert.equal(h.sent.length,1);assert.equal(h.sent[0].origin,'http://localhost:3002');assert.equal(h.sent[0].data.operation,'accept');assert.equal(h.sent[0].data.peer,peer);
  const player=h.doc.createElement('section');h.doc.fullscreenElement=player;h.docEvents.fullscreenchange();assert.equal(h.box.host,player);
  [...h.timers.values()].find(timer=>timer.ms===15000).fn();assert.equal(h.box.hidden,false,'a pending action survives toast expiry');
  h.deliver({type:'social-result',requestId:h.sent[0].data.requestId,self:owner,result:null});await pending;assert.equal(status.textContent,'Friend added');assert.ok(h.dispatched.some(event=>event.type==='neon-friends-updated'));
  [...h.timers.values()].find(timer=>timer.ms===2000).fn();assert.equal(h.box.hidden,true);
 }finally{h.restore()}
});
test('decline errors allow retry, dismissal expires, and View opens Friends',async()=>{
 const h=harness();try{
  h.friend();const card=h.box.children[0],controls=card.children.find(el=>el.className==='notification-friend-actions'),status=card.children.at(-1);
  const pending=controls.children[2].onclick();h.deliver({type:'social-result',requestId:h.sent[0].data.requestId,self:owner,error:'Connection lost'});await pending;
  assert.equal(status.textContent,'Connection lost');assert.equal(controls.children[2].disabled,false);assert.equal(h.sent[0].data.operation,'remove');
  controls.children[0].onclick();assert.ok(h.dispatched.some(event=>event.type==='neon-open-friends'));assert.equal(h.box.hidden,true);
  h.friend('next');[...h.timers.values()].find(timer=>timer.ms===15000).fn();assert.equal(h.box.hidden,true);
 }finally{h.restore()}
});
