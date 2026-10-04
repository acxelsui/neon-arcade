import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountLoading} from '../public/loading-sequence.js';
test('one account loader stays until the owning arcade reports its actual readiness',()=>{
 const overlay={hidden:true},status={},retry={},frame={contentWindow:{}},timers=new Map();let next=0,reloads=0;
 const loader=createAccountLoading({overlay,status,retry,frame,origin:'https://arcade.example',setTimer:fn=>{timers.set(++next,fn);return next;},clearTimer:id=>timers.delete(id),reload:()=>reloads++});
 const event=type=>({source:frame.contentWindow,origin:'https://arcade.example',data:{channel:'neon-members-v1',type}});
 loader.start();assert.equal(overlay.hidden,false);assert.equal(loader.receive(event('ready')),false);assert.equal(overlay.hidden,false);
 assert.equal(loader.receive({...event('arcade-ready'),origin:'https://wrong.example'}),false);assert.equal(loader.receive({...event('arcade-ready'),source:{}}),false);
 loader.receive({...event('arcade-loading'),data:{channel:'neon-members-v1',type:'arcade-loading',step:2}});assert.match(status.textContent,/wallpaper/);
 assert.equal(loader.receive(event('arcade-ready')),true);assert.equal(overlay.hidden,true);assert.equal(timers.size,0);
 loader.start();[...timers.values()][0]();assert.equal(retry.hidden,false);retry.onclick();assert.equal(reloads,1);
 loader.finish();assert.equal(overlay.hidden,true);assert.equal(loader.receive(event('arcade-ready')),false);
});
test('embedded arcade hides its own loader before startup and hands completion to its account parent',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,location:globalThis.location},overlay={hidden:false},messages=[];
 globalThis.window={parent:{postMessage:(data,origin)=>messages.push({data,origin})}};globalThis.document={querySelector:selector=>selector==='#loading'?overlay:null};globalThis.location={hostname:'localhost'};
 try{const bridge=await import('../public/loading-sequence.js?embedded-boot');assert.equal(overlay.hidden,true);bridge.reportArcadeLoading(2);assert.equal(bridge.finishArcadeLoading(),true);assert.deepEqual(messages.map(m=>m.data.type),['arcade-loading','arcade-ready']);assert.ok(messages.every(m=>m.origin==='http://localhost:3002'));}
 finally{globalThis.window=previous.window;globalThis.document=previous.document;globalThis.location=previous.location;}
});
