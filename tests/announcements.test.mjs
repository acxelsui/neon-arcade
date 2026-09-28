import test from 'node:test';
import assert from 'node:assert/strict';
import {latestAnnouncement,initAnnouncementBanner} from '../public/announcements.js';
const now=Date.parse('2026-09-28T12:00:00Z');
const row={id:'1',announcement:true,body:'Hello',username:'Owner',created_at:'2026-09-28T11:00:00Z'};
test('banner chooses latest announcement, not ordinary or private chat text',()=>{
 assert.equal(latestAnnouncement([{...row,id:'9'},{...row,id:'10'},{...row,id:'11',announcement:false}],now).id,'10');
});
test('banner ignores old, future, malformed, and oversized notices',()=>{
 for(const change of [{created_at:'2026-09-26T11:00:00Z'},{created_at:'2026-09-29T11:00:00Z'},{created_at:'bad'},{id:'bad'},{body:'x'.repeat(1001)}])assert.equal(latestAnnouncement([{...row,...change}],now),null);
 assert.equal(latestAnnouncement(null,now),null);
});

test('new announcements tolerate a device clock slightly behind the server',()=>{
 assert.equal(latestAnnouncement([{...row,created_at:'2026-09-28T12:01:00Z'}],now).id,'1');
});
test('game and fullscreen transitions restore a banner without undoing dismissal',()=>{
 const listeners={},winListeners={};
 class Element {
  hidden=false;open=false;children=[];tagName='DIV';
  setAttribute(){} append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node)}}
  matches(){return this.open} showPopover(){this.open=true} hidePopover(){this.open=false}
 }
 const document={body:new Element(),createElement:()=>new Element(),addEventListener:(key,fn)=>listeners[key]=fn,fullscreenElement:null,hidden:false};
 const original={};const parent={};
 const replacements={document,window:{addEventListener:(key,fn)=>winListeners[key]=fn},location:{hostname:'localhost'},parent,sessionStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:fn=>fn()};
 try{
  for(const [key,value] of Object.entries(replacements)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value})}
  initAnnouncementBanner();const banner=document.body.children[0];
  const event={source:parent,origin:'http://localhost:3002',data:{channel:'neon-members-v1',type:'site-announcement',self:'test',rows:[{...row,created_at:new Date().toISOString()}]}};
  winListeners.message(event);assert.equal(banner.open,true);
  banner.open=false;winListeners['neon-game']();assert.equal(banner.open,true);
  document.fullscreenElement=new Element();banner.open=false;listeners.fullscreenchange();assert.equal(banner.parentElement,document.fullscreenElement);assert.equal(banner.open,true);
  banner.open=false;winListeners.message(event);assert.equal(banner.open,true);
  banner.children[2].onclick();winListeners['neon-game']();assert.equal(banner.hidden,true);assert.equal(banner.open,false);
 }finally{for(const key of Object.keys(replacements)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key]}}
});
