import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothWallpaperLoop,releaseWallpaperLoop} from '../public/wallpaper-loop.js';

function fixture(){
 const created=[],drawn=[],events={},nodes=[];let callback,id=0,cancelled;
 const canvas={style:{},width:0,height:0,offsetWidth:100,setAttribute(){},getContext(){return{drawImage(...args){drawn.push(args);}};},remove(){this.removed=true;}};
 const media={videoWidth:3840,videoHeight:2160,duration:10,currentTime:0,paused:false,loop:true,parentNode:{append(n){nodes.push(n);}},addEventListener(name,fn){events[name]=fn;},requestVideoFrameCallback(fn){callback=fn;return ++id;},cancelVideoFrameCallback(value){cancelled=value;}};
 const doc={createElement(name){created.push(name);return canvas;}};
 return {media,doc,canvas,created,drawn,events,nodes,frame(time){media.currentTime=time;callback(0,{mediaTime:time});},get cancelled(){return cancelled;}};
}
test('only the final two 4K frames are captured, then cover the restart while the same video keeps playing',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture(),previous={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};let animation;
 globalThis.requestAnimationFrame=fn=>{animation=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
 try{
  smoothWallpaperLoop(f.media,{doc:f.doc,fps:30});f.frame(1);f.frame(9.8);assert.equal(f.created.length,0);
  f.frame(9.95);f.frame(9.9667);assert.deepEqual(f.created,['canvas']);assert.equal(f.drawn.length,2);assert.equal(f.canvas.width,3840);assert.equal(f.canvas.height,2160);assert.equal(f.canvas.style.opacity,'0');
  f.frame(0.01);assert.equal(f.canvas.style.opacity,'1');assert.equal(f.media.paused,false);animation();assert.equal(f.canvas.style.opacity,'0');assert.equal(f.canvas.style.transition,'opacity 180ms linear');
  t.mock.timers.tick(220);assert.equal(f.canvas.style.transition,'');releaseWallpaperLoop(f.media);assert.equal(f.canvas.removed,true);assert.ok(f.cancelled>0);
 }finally{globalThis.requestAnimationFrame=previous.raf;globalThis.cancelAnimationFrame=previous.cancel;}
});
test('seeking to another scene and disposing a wallpaper cannot flash its captured tail later',()=>{
 const f=fixture();smoothWallpaperLoop(f.media,{doc:f.doc,fps:30});f.frame(9.96);f.media.currentTime=4;f.events.seeking();f.frame(0.01);assert.equal(f.canvas.style.opacity,'0');releaseWallpaperLoop(f.media);f.frame(9.97);assert.equal(f.drawn.length,1);assert.equal(f.canvas.removed,true);
});
test('paused, non-looping and unsupported videos preserve normal playback without a canvas',()=>{
 const f=fixture();smoothWallpaperLoop(f.media,{doc:f.doc,fps:60});f.media.paused=true;f.frame(9.99);f.media.paused=false;f.media.loop=false;f.frame(9.99);assert.equal(f.created.length,0);releaseWallpaperLoop(f.media);
 assert.doesNotThrow(()=>smoothWallpaperLoop({}, {doc:null})());
});
