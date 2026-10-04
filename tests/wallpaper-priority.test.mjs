import test from 'node:test';
import assert from 'node:assert/strict';
import {startWallpaperEarly} from '../public/wallpaper-priority.js';
function fixture(){
 let video,created=0;const handlers={};const layer={style:{},querySelector(){return video;},append(node){video=node;}};
 const doc={hidden:false,fullscreenElement:null,querySelector:()=>layer,addEventListener(){},createElement(){created++;return{dataset:{},style:{},readyState:2,plays:0,play(){this.plays++;return Promise.resolve();},pause(){},load(){},remove(){video=null;},removeAttribute(){},setAttribute(){},addEventListener(type,fn){handlers[type]=fn;}};}};
 return{doc,layer,handlers,get video(){return video;},get created(){return created;}};
}
test('the selected smaller wallpaper copy starts before the app, legacy choices migrate, and custom backgrounds are respected',()=>{
 for(const value of ['"/wallpapers/4k/polygons-4k-live-wallpaper.mp4"','"/wallpapers/polygons-4k-live-wallpaper.gif"']){
  const f=fixture(),node=startWallpaperEarly(f.doc,{getItem:()=>value});assert.equal(node.src,'/wallpapers/stream/polygons-4k-live-wallpaper.mp4');assert.equal(node.plays,1);assert.equal(node.muted,true);assert.equal(node.preload,'auto');startWallpaperEarly(f.doc,{getItem:()=>value});assert.equal(f.created,1);
 }
 const custom=fixture();assert.equal(startWallpaperEarly(custom.doc,{getItem:()=>JSON.stringify('custom')}),undefined);assert.equal(custom.created,0);
 const f=fixture();assert.ok(startWallpaperEarly(f.doc,{getItem(){throw Error('storage disabled');}}).src.includes('relaxing-fireplace'));
});
test('desktop initialization adopts the already-playing video without restarting its download or playback position',async()=>{
 const f=fixture(),node=startWallpaperEarly(f.doc,{getItem:()=>null});node.currentTime=2.4;
 const previous=globalThis.document;globalThis.document=f.doc;
 try{
  const {setWallpaperMedia,whenWallpaperVisible}=await import('../public/wallpaper-media.js?early-adoption');setWallpaperMedia(node.dataset.neonWallpaperUrl,node.poster);await whenWallpaperVisible(30);
  assert.equal(f.created,2);assert.equal(node.currentTime,2.4);assert.equal(node.style.opacity,'1');assert.equal(node.plays,2);setWallpaperMedia('/custom/still.jpg');
 }finally{globalThis.document=previous;}
});
