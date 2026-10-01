import test from 'node:test';
import assert from 'node:assert/strict';
import {initMessageToasts} from '../public/message-notifications.js';
test('game notification preserves a draft past expiry, reports send errors, and confirms only acknowledged replies',async()=>{
 const listeners={},windowListeners={},timers=new Map(),sent=[],dispatched=[];let timerId=0,doc;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.value='';this.hidden=false;this.open=false}
  setAttribute(name,value){this[name]=value}append(...children){for(const child of children){child.remove();child.parent=this;this.children.push(child)}}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null}}
  contains(node){return node===this||this.children.some(child=>child.contains(node))}addEventListener(name,fn){this.events[name]=fn}
  matches(){return this.open}showPopover(){this.open=true}hidePopover(){this.open=false}
  focus(){doc.activeElement=this;for(let ancestor=this;ancestor;ancestor=ancestor.parent)ancestor.events.focusin?.()}
 }
 const body=new Element('body'),player=new Element('div'),game=new Element('iframe');body.append(player);player.append(game);
 doc={body,activeElement:game,createElement:tag=>new Element(tag),querySelector:selector=>selector==='#player'?player:selector==='#game-frame-wrap iframe'?game:null,addEventListener:(name,fn)=>listeners[name]=fn};
 const parent={postMessage:(data,target)=>sent.push({data,target})},original={};
 const mocks={document:doc,window:{addEventListener:(name,fn)=>windowListeners[name]=fn,dispatchEvent:event=>dispatched.push(event)},parent,location:{hostname:'localhost'},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}};
 const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',peer='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 const deliver=data=>windowListeners.message({source:parent,origin:'http://localhost:3002',data:{channel:'neon-members-v1',...data}});
 try{
  for(const [key,value] of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true})}
  initMessageToasts();deliver({type:'message-notifications',self:owner,rows:[{id:'1',sender_id:peer,username:'Friend',body:'Hello'}]});
  const box=body.children.find(child=>child.id==='message-notifications'),card=box.children[0],form=card.children.find(child=>child.tag==='form'),input=form.children[0],send=form.children[1],status=card.children.at(-1);
  input.value='My reply';input.focus();[...timers.values()][0].fn();assert.equal(box.hidden,false);
  game.focus();card.events.focusout();await Promise.resolve();assert.equal(box.hidden,false,'an unfinished draft survives returning to the game');
  const pending=form.onsubmit({preventDefault(){}});await form.onsubmit({preventDefault(){}});assert.equal(sent.length,1);assert.equal(sent[0].data.peer,peer);assert.equal(sent[0].data.action,'send');assert.equal(send.disabled,true);
  doc.fullscreenElement=player;listeners.fullscreenchange();assert.equal(box.parent,player,'reply remains available in game fullscreen');
  windowListeners.message({source:{},origin:'http://localhost:3002',data:{channel:'neon-members-v1',type:'chat-result',requestId:sent[0].data.requestId}});assert.equal(status.textContent,'Sending…');
  deliver({type:'chat-result',requestId:sent[0].data.requestId,error:'You are muted'});await pending;assert.equal(input.value,'My reply');assert.equal(status.textContent,'You are muted');assert.equal(send.disabled,false);
  const retry=form.onsubmit({preventDefault(){}});deliver({type:'chat-result',requestId:sent[1].data.requestId,self:owner,result:null});await retry;assert.equal(status.textContent,'Reply sent');assert.equal(input.value,'');assert.equal(doc.activeElement,game);assert.ok(dispatched.some(event=>event.type==='neon-private-reply'));
  [...timers.values()].find(timer=>timer.ms===2000).fn();assert.equal(box.hidden,true);
 }finally{for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key]}}
});
