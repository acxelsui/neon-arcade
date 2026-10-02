import test from 'node:test';
import assert from 'node:assert/strict';
test('fullscreen media pauses only the covered wallpaper and resumes it without reloading or reducing quality',async()=>{
 const previous=globalThis.document,handlers={},layer={style:{},append(){}},media={attributes:{},style:{},plays:0,pauses:0,loads:0,play(){this.plays++;return Promise.resolve();},pause(){this.pauses++;},load(){this.loads++;},remove(){},setAttribute(key,value){this.attributes[key]=value;},getAttribute(key){return key==='src'?this.src:this.attributes[key];},addEventListener(){}};
 globalThis.document={hidden:false,fullscreenElement:null,querySelector:()=>layer,createElement:()=>media,addEventListener(type,handler){handlers[type]=handler;}};
 try{
  const {setWallpaperMedia}=await import('../public/wallpaper-media.js?fullscreen-test');setWallpaperMedia('/wallpapers/original-4k.mp4','/wallpapers/poster.jpg');assert.equal(media.plays,1);assert.equal(media.loop,true);
  document.fullscreenElement={};handlers.fullscreenchange();assert.equal(media.pauses,1);handlers.pointerdown();assert.equal(media.plays,1,'pointer activity in fullscreen must not restart the hidden wallpaper');
  document.fullscreenElement=null;handlers.fullscreenchange();assert.equal(media.plays,2);assert.equal(media.src,'/wallpapers/original-4k.mp4');assert.equal(media.loads,0);
 }finally{globalThis.document=previous;}
});
