import test from 'node:test';import assert from 'node:assert/strict';
import {createScreenShare} from '../public/chat-screen.js';
function fixture(){
 let ended,stops=0,captures=0;const changes=[];
 const track={readyState:'live',stop(){stops++;this.readyState='ended'},addEventListener(type,fn){ended=fn}};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const video={srcObject:null,videoWidth:1920,videoHeight:1080,readyState:2,play:async()=>{}};
 const canvas={getContext:()=>({drawImage(){captures++}}),toDataURL:()=> 'data:image/jpeg;base64,frame'+captures};
 const share=createScreenShare({video,mediaDevices:{getDisplayMedia:async options=>{assert.equal(options.audio,false);return stream}},changed:state=>changes.push(state),makeCanvas:()=>canvas});
 return {share,video,canvas,changes,ended:()=>ended(),stops:()=>stops};
}
test('sharing stays live and each question captures a new view; stop clears and releases it',async()=>{
 const f=fixture();await f.share.start();assert.equal(f.share.active(),true);assert.deepEqual(f.changes,[true]);const first=f.share.snapshot(),second=f.share.snapshot();assert.notEqual(first.url,second.url);assert.equal(f.canvas.width,1600);assert.equal(f.canvas.height,900);f.share.stop();assert.equal(f.stops(),1);assert.equal(f.video.srcObject,null);assert.equal(f.share.active(),false);assert.throws(()=>f.share.snapshot(),/not ready/);
});
test('browser stop updates sharing state',async()=>{const f=fixture();await f.share.start();f.ended();assert.equal(f.share.active(),false);assert.equal(f.changes.at(-1),false)});
test('canceling or leaving while the picker is open releases the selected stream',async()=>{
 let choose,stops=0;const video={play:async()=>{}};
 const share=createScreenShare({video,mediaDevices:{getDisplayMedia:()=>new Promise(resolve=>choose=resolve)}});
 const pending=share.start();share.stop();choose({getTracks:()=>[{stop(){stops++}}]});await pending;assert.equal(stops,1);assert.equal(share.active(),false);assert.equal(video.srcObject,null);
});
test('unsupported browsers and denied permission leave no capture active',async()=>{
 for(const mediaDevices of [{},{getDisplayMedia:async()=>{throw new DOMException('Canceled','NotAllowedError')}}]){
  const video={};const share=createScreenShare({video,mediaDevices});await assert.rejects(share.start());assert.equal(share.active(),false);
 }
});
import {startScreenChat} from '../public/chat-screen.js';
test('Share screen requests the floating window before waiting for the screen picker',async()=>{
 let selected;const order=[];
 const capture=startScreenChat({start(){order.push('capture requested');return new Promise(resolve=>selected=resolve)}},{prepare(){order.push('prepared')},open(){order.push('window requested')}});
 assert.deepEqual(order,['capture requested','prepared','window requested']);selected();await capture;
});
