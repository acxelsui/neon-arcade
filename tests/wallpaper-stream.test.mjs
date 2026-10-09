import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperStreamUrl,hasWallpaperBuffer,cachedWallpaperFull,wallpaperFullTime} from '../public/wallpaper-stream.js';
const url='/wallpapers/4k/minecraft-falling-snow.3840x2160.mp4',stream=url.replace('/4k/','/4k-start/');
test('every bundled choice has a light source without rewriting custom videos or account paths',()=>{
 assert.equal(wallpaperStreamUrl(url),stream);for(const other of ['/api/private.mp4','blob:personal','/custom/video.mp4'])assert.equal(wallpaperStreamUrl(other),other);
 assert.equal(hasWallpaperBuffer({currentTime:4,duration:20,buffered:{length:1,start:()=>0,end:()=>5}}),false);
 assert.equal(hasWallpaperBuffer({currentTime:4,duration:20,buffered:{length:1,start:()=>0,end:()=>10}}),true);
});
function fixture(){
 const nodes=[],events={},created=[],layer={style:{},querySelector(){return nodes.find(node=>!node.removed);},append(node){if(!nodes.includes(node))nodes.push(node);}};
 const doc={hidden:false,fullscreenElement:null,querySelector(selector){return selector==='#wallpaper'?layer:null;},addEventListener(event,fn){events[event]=fn;},createElement(){const node={dataset:{},style:{},handlers:{},readyState:0,currentTime:0,duration:30,buffered:{length:1,start:()=>0,end:()=>30},plays:0,paused:false,play(){this.plays++;return Promise.resolve();},pause(){this.paused=true;},load(){},remove(){this.removed=true;},removeAttribute(){},setAttribute(){},addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);},emit(name){for(const fn of this.handlers[name]||[])fn();}};created.push(node);return node;}};
 return{doc,nodes,events,created};
}
test('Falling Snow fades buffered 4K over a moving opening clip, aligns their phases, and recovers on decode failure',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?stream-promotion');setWallpaperMedia(url);const low=f.nodes[0];assert.equal(low.src,stream);assert.equal(low.plays,1);
  low.readyState=4;low.currentTime=2;low.emit('loadeddata');assert.equal(low.style.opacity,'1');const high=f.nodes[1];assert.equal(high.src,url);assert.equal(high.style.opacity,'0');assert.equal(low.removed,undefined);
  high.readyState=4;high.emit('canplay');assert.equal(high.currentTime,2.4);high.emit('seeked');assert.equal(high.plays,1);high.emit('playing');assert.equal(high.style.opacity,'1');assert.equal(low.removed,undefined,'opening must remain underneath during the fade');t.mock.timers.tick(400);assert.equal(low.removed,true);
  high.error={code:3};high.emit('error');const fallback=f.nodes[2];assert.equal(fallback.src,stream);assert.equal(fallback.plays,1);fallback.emit('loadeddata');assert.equal(fallback.style.opacity,'1');assert.equal(high.removed,true);
  setWallpaperMedia('/custom/still.jpg');
 }finally{globalThis.document=previous;}
});

test('opening phases include the blended clip offset, wrap at the full duration, and leave custom videos alone',()=>{
 assert.equal(wallpaperFullTime(url,2,30),2.4);assert.ok(Math.abs(wallpaperFullTime(url,29.9,30)-.3)<1e-8);
 assert.equal(wallpaperFullTime('/personal.mp4',2,30),2);assert.equal(wallpaperFullTime(url,2,NaN),0);
});

test('a new wallpaper cancels the fade and disposes both old movies without stale timers reviving them',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?loop-fade-cancel');setWallpaperMedia(url);const opening=f.nodes[0];opening.readyState=4;opening.emit('loadeddata');const full=f.nodes[1];full.readyState=4;full.emit('canplay');full.emit('seeked');full.emit('playing');
  assert.equal(opening.removed,undefined);setWallpaperMedia('/custom/still.jpg');assert.equal(opening.removed,true);assert.equal(full.removed,true);t.mock.timers.tick(1000);assert.equal(f.nodes.filter(node=>!node.removed).length,0);
 }finally{globalThis.document=previous;}
});
test('an unsupported 4K decode keeps 4K playing and stale callbacks cannot revive an old wallpaper',async()=>{
 const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?stream-race');setWallpaperMedia(url);const low=f.nodes[0];low.readyState=4;low.emit('loadeddata');const high=f.nodes[1];high.error={code:4};high.emit('error');assert.equal(low.removed,undefined);assert.equal(low.dataset.neonWallpaper4kFailed,'true');assert.equal(high.removed,true);
  setWallpaperMedia(url);assert.equal(f.nodes[2].src,stream,'explicit reselection retries a failed upgrade');setWallpaperMedia('/custom/still.jpg');high.readyState=4;high.emit('playing');assert.equal(high.style.opacity,'0');assert.equal(f.nodes.filter(node=>!node.removed).length,0);
 }finally{globalThis.document=previous;}
});
test('an interrupted light download retries outside its cached response and fullscreen still pauses playback',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?stream-retry');setWallpaperMedia(url);const low=f.nodes[0];low.error={code:2};low.emit('error');t.mock.timers.tick(500);assert.equal(low.src,stream+'?wallpaper-retry=1');
  document.fullscreenElement={};f.events.fullscreenchange();assert.equal(low.paused,true);const count=low.plays;f.events.pointerdown();assert.equal(low.plays,count);document.fullscreenElement=null;f.events.fullscreenchange();assert.equal(low.plays,count+1);setWallpaperMedia('/custom/still.jpg');
 }finally{globalThis.document=previous;}
});
test('4K stalls recover to the 4K opening loop without refreshing the page',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?stream-smooth');
  setWallpaperMedia(url);let low=f.nodes[0];low.readyState=4;low.emit('loadeddata');let high=f.nodes[1];high.readyState=4;high.emit('canplay');high.emit('playing');high.emit('waiting');t.mock.timers.tick(1800);assert.equal(f.nodes[2].src,stream);assert.equal(high.removed,true);
  setWallpaperMedia('/custom/still.jpg');
 }finally{globalThis.document=previous;}
});

test('only complete prepared originals can skip the opening download',async()=>{for(const [response,want] of [[new Response('movie',{headers:{'content-type':'video/mp4'}}),true],[new Response('part',{status:206,headers:{'content-type':'video/mp4'}}),false],[new Response('login',{headers:{'content-type':'text/html'}}),false],[null,false]]){const storage={async open(){return{async match(key){assert.equal(key,url);return response;}};}};assert.equal(Boolean(await cachedWallpaperFull(url,storage)),want);}assert.equal(await cachedWallpaperFull('/api/private.mp4',{open(){throw Error('must not open');}}),false);assert.equal(await cachedWallpaperFull(url,null),false);});

test('a prepared original is used without constructing a second video or downloading the new clip',async()=>{const previous={document:globalThis.document,caches:globalThis.caches},f=fixture();globalThis.document=f.doc;globalThis.caches={async open(){return{async match(){return new Response('movie',{headers:{'content-type':'video/mp4'}});}};}};try{const {setWallpaperMedia}=await import('../public/wallpaper-media.js?prepared-original');setWallpaperMedia(url);await new Promise(resolve=>setImmediate(resolve));const media=f.nodes[0];assert.equal(media.src,url);assert.equal(media.dataset.neonWallpaperFull,'true');media.readyState=4;media.emit('loadeddata');assert.equal(f.nodes.length,1);setWallpaperMedia('/custom/still.jpg');}finally{globalThis.document=previous.document;globalThis.caches=previous.caches;}});


test('switching keeps the old video moving until the next video plays, reuses the warm decoder and ignores cancelled switches',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia,warmWallpaperMedia}=await import('../public/wallpaper-media.js?switch-handoff');
  const first='/custom/first.mp4',second='/custom/second.mp4',third='/custom/third.mp4';
  setWallpaperMedia(first);const old=f.nodes[0];old.readyState=4;old.emit('loadeddata');
  warmWallpaperMedia(second);assert.equal(f.created.length,2); // Detached decoder is loaded before selection.
  setWallpaperMedia(second);assert.equal(f.created.length,2,'selection reuses the speculative decoder');const next=f.nodes[1];assert.equal(next.src,second);
  assert.equal(old.removed,undefined);assert.equal(old.style.opacity,'1');assert.equal(next.style.opacity,'0');
  next.readyState=4;next.emit('loadeddata');assert.equal(old.removed,undefined,'decoded frame alone must not stop the current live background');
  next.emit('playing');assert.equal(old.removed,true);assert.equal(next.style.opacity,'1');
  setWallpaperMedia(third);const cancelled=f.nodes[2];setWallpaperMedia('/custom/fourth.mp4');const fourth=f.nodes[3];
  cancelled.readyState=4;cancelled.emit('playing');assert.equal(cancelled.removed,true);assert.equal(next.removed,undefined);
  fourth.emit('error');assert.equal(fourth.removed,true);assert.equal(next.removed,undefined,'failed choice retains the current wallpaper');
  setWallpaperMedia('/custom/timeout.mp4');const timed=f.nodes[4];t.mock.timers.tick(20000);assert.equal(timed.removed,true);assert.equal(next.removed,undefined);
  setWallpaperMedia('/custom/still.jpg');assert.equal(next.removed,true);
 }finally{globalThis.document=previous;}
});
