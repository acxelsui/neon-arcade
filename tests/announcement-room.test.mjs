import test from 'node:test';
import assert from 'node:assert/strict';
import {initCommunityChat} from '../public/community-chat.js';
test('announcement room is readable by members and VIPs, writable only by moderators',async()=>{
 const elements=new Map(),listeners={},calls=[];let role='member';
 class Element{value='';hidden=false;disabled=false;children=[];classList={toggle(){},add(){}};append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(){} }
 const $=key=>{if(!elements.has(key))elements.set(key,new Element());return elements.get(key)};
 const win={addEventListener:(name,fn)=>listeners[name]=fn};
 const parent={postMessage(data){calls.push(data);queueMicrotask(()=>listeners.message({source:parent,origin:'http://localhost:3002',data:{channel:'neon-members-v1',type:'chat-result',requestId:data.requestId,self:'self',result:data.action==='self'?[{role}]:[]}}))}};
 const replacements={window:win,parent,document:{querySelector:$,createElement:()=>new Element()},location:{hostname:'localhost',hash:'#community'},setInterval:()=>0};const original={};
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 try{
  for(const [key,value] of Object.entries(replacements)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true})}
  initCommunityChat();await settle();$('#community-announcements').onclick();await settle();
  assert.equal($('#community-room-title').textContent,'# Announcements');
  for(const next of ['member','vip','admin','owner']){role=next;$('#community-refresh').onclick();await settle();assert.equal($('#community-input').disabled,['member','vip'].includes(next));assert.equal($('#community-send').disabled,['member','vip'].includes(next));}
  $('#community-input').value='Announcement';await $('#community-compose').onsubmit({preventDefault(){}});assert.equal(calls.filter(c=>c.action==='announce').length,1);
  role='member';$('#community-refresh').onclick();await settle();$('#community-input').value='Forged announcement';await $('#community-compose').onsubmit({preventDefault(){}});assert.equal(calls.filter(c=>c.action==='announce').length,1);
  $('#community-server').onclick();await settle();assert.equal($('#community-input').disabled,false);assert.equal($('#community-readonly').hidden,true);
 }finally{for(const key of Object.keys(replacements)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key]}}
});
