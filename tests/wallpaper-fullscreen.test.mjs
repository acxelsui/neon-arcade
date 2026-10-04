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

test('a failed cached video falls back to the bundled video and a failed selected video can retry',async()=>{
 const {wallpaperPreparation}=await import('../public/wallpaper-preload.js');
 const previous={document:globalThis.document,caches:globalThis.caches,source:wallpaperPreparation.source};
 const media=[],layer={style:{},append(){}};let releases=0;
 wallpaperPreparation.source=async()=>({url:'blob:cached-video',release(){releases++;}});globalThis.caches={};
 globalThis.document={hidden:false,fullscreenElement:null,querySelector:()=>layer,addEventListener(){},createElement(){const node={style:{},handlers:{},loads:0,play:async()=>{},pause(){},load(){this.loads++;},remove(){},removeAttribute(){},setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;}};media.push(node);return node;}};
 try{
  const {setWallpaperMedia,whenWallpaperVisible}=await import('../public/wallpaper-media.js?cache-failure');
  setWallpaperMedia('/wallpapers/4k/repair.mp4');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(media[0].src,'blob:cached-video');media[0].handlers.error();assert.equal(media[0].src,'/wallpapers/4k/repair.mp4');assert.equal(media[0].loads,1);
  media[0].error={code:4};media[0].handlers.error();await whenWallpaperVisible(30);
  setWallpaperMedia('/wallpapers/4k/repair.mp4');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(media.length,2,'selecting an errored wallpaper again must recreate the video');assert.equal(releases,1);
  setWallpaperMedia('/custom/photo.jpg');
 }finally{globalThis.document=previous.document;globalThis.caches=previous.caches;wallpaperPreparation.source=previous.source;}
});
test('late cached sources are released and cannot replace a newer wallpaper',async()=>{
 const {wallpaperPreparation}=await import('../public/wallpaper-preload.js');const previous={document:globalThis.document,caches:globalThis.caches,source:wallpaperPreparation.source};
 const pending=new Map(),media=[],layer={style:{},append(){}};let releases=0;
 wallpaperPreparation.source=url=>new Promise(resolve=>pending.set(url,resolve));globalThis.caches={};
 globalThis.document={hidden:false,fullscreenElement:null,querySelector:()=>layer,addEventListener(){},createElement(){const node={style:{},handlers:{},play:async()=>{},pause(){},load(){},remove(){},removeAttribute(){},setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;}};media.push(node);return node;}};
 try{
  const {setWallpaperMedia,whenWallpaperVisible}=await import('../public/wallpaper-media.js?cache-race');setWallpaperMedia('/wallpapers/4k/a.mp4','/artwork/wallpaper-posters/a.webp');setWallpaperMedia('/wallpapers/4k/b.mp4','/artwork/wallpaper-posters/b.webp');
  const source=url=>({url,release(){releases++;}});pending.get('/wallpapers/4k/b.mp4')(source('blob:new'));pending.get('/artwork/wallpaper-posters/b.webp')(source('blob:new-poster'));await new Promise(resolve=>setImmediate(resolve));
  pending.get('/wallpapers/4k/a.mp4')(source('blob:old'));pending.get('/artwork/wallpaper-posters/a.webp')(source('blob:old-poster'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(media[1].src,'blob:new');assert.match(layer.style.backgroundImage,/blob:new-poster/);assert.equal(releases,2);media[1].handlers.loadeddata();await whenWallpaperVisible(30);assert.equal(media[1].style.opacity,'1');setWallpaperMedia('/custom/photo.jpg');assert.equal(releases,4);
 }finally{globalThis.document=previous.document;globalThis.caches=previous.caches;wallpaperPreparation.source=previous.source;}
});
