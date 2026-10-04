import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperStreamUrl,hasWallpaperBuffer,wallpaperDropsFrames} from '../public/wallpaper-stream.js';
const url='/wallpapers/4k/minecraft-falling-snow.3840x2160.mp4',stream=url.replace('/4k/','/stream/');
test('every bundled choice has a light source without rewriting custom videos or account paths',()=>{
 assert.equal(wallpaperStreamUrl(url),stream);for(const other of ['/api/private.mp4','blob:personal','/custom/video.mp4'])assert.equal(wallpaperStreamUrl(other),other);
 assert.equal(hasWallpaperBuffer({currentTime:4,duration:20,buffered:{length:1,start:()=>0,end:()=>5}}),false);
 assert.equal(hasWallpaperBuffer({currentTime:4,duration:20,buffered:{length:1,start:()=>0,end:()=>10}}),true);
 assert.equal(wallpaperDropsFrames({totalVideoFrames:100,droppedVideoFrames:1},{totalVideoFrames:220,droppedVideoFrames:40}),true);
 assert.equal(wallpaperDropsFrames({totalVideoFrames:100,droppedVideoFrames:1},{totalVideoFrames:220,droppedVideoFrames:3}),false);
 assert.equal(wallpaperDropsFrames(undefined,undefined),false);
});
function fixture(){
 const nodes=[],events={},layer={style:{},querySelector(){return nodes.find(node=>!node.removed);},append(node){if(!nodes.includes(node))nodes.push(node);}};
 const doc={hidden:false,fullscreenElement:null,querySelector(selector){return selector==='#wallpaper'?layer:null;},addEventListener(event,fn){events[event]=fn;},createElement(){return{dataset:{},style:{},handlers:{},readyState:0,currentTime:0,duration:30,buffered:{length:1,start:()=>0,end:()=>30},plays:0,paused:false,play(){this.plays++;return Promise.resolve();},pause(){this.paused=true;},load(){},remove(){this.removed=true;},removeAttribute(){},setAttribute(){},addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);},emit(name){for(const fn of this.handlers[name]||[])fn();}};}};
 return{doc,nodes,events};
}
test('Falling Snow starts with HD, promotes buffered 4K, and returns to a moving HD copy on decode failure',async()=>{
 const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?stream-promotion');setWallpaperMedia(url);const low=f.nodes[0];assert.equal(low.src,stream);assert.equal(low.plays,1);
  low.readyState=4;low.currentTime=2;low.emit('loadeddata');assert.equal(low.style.opacity,'1');const high=f.nodes[1];assert.equal(high.src,url);assert.equal(high.style.opacity,'0');assert.equal(low.removed,undefined);
  high.readyState=4;high.emit('canplay');assert.equal(high.currentTime,2);high.emit('seeked');assert.equal(high.plays,1);high.emit('playing');assert.equal(high.style.opacity,'1');assert.equal(low.removed,true);
  high.error={code:3};high.emit('error');const fallback=f.nodes[2];assert.equal(fallback.src,stream);assert.equal(fallback.plays,1);fallback.emit('loadeddata');assert.equal(fallback.style.opacity,'1');assert.equal(high.removed,true);
  setWallpaperMedia('/custom/still.jpg');
 }finally{globalThis.document=previous;}
});
test('an unsupported 4K decode keeps HD playing and stale callbacks cannot revive an old wallpaper',async()=>{
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
test('4K stalls and sustained frame drops recover to HD without refreshing the page',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const previous=globalThis.document,f=fixture();globalThis.document=f.doc;
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?stream-smooth');
  setWallpaperMedia(url);let low=f.nodes[0];low.readyState=4;low.emit('loadeddata');let high=f.nodes[1];high.readyState=4;high.emit('canplay');high.emit('playing');high.emit('waiting');t.mock.timers.tick(1800);assert.equal(f.nodes[2].src,stream);assert.equal(high.removed,true);
  setWallpaperMedia(url);low=f.nodes[3];low.readyState=4;low.emit('loadeddata');high=f.nodes[4];let quality={totalVideoFrames:100,droppedVideoFrames:1};high.getVideoPlaybackQuality=()=>quality;high.readyState=4;high.emit('canplay');high.emit('playing');quality={totalVideoFrames:220,droppedVideoFrames:40};t.mock.timers.tick(4000);assert.equal(high.removed,true);assert.equal(f.nodes[5].src,stream);setWallpaperMedia('/custom/still.jpg');
 }finally{globalThis.document=previous;}
});
