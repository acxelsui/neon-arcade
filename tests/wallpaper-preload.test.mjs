import test from 'node:test';
import assert from 'node:assert/strict';
import {createWallpaperPreparation} from '../public/wallpaper-preload.js';
const items=['a','b','c'].map(name=>({url:`/wallpapers/4k/${name}.mp4`,preview:`/artwork/wallpaper-posters/${name}.webp`}));
function fixture(){const entries=new Map();return {entries,storage:{async open(){return {async match(url){return entries.get(url)?.clone();},async put(url,response){const body=await response.arrayBuffer();entries.set(url,new Response(body,{headers:response.headers,status:response.status}));}};}}};}
function response(url,status=200){return new Response('asset',{status,headers:{'content-type':url.endsWith('.mp4')?'video/mp4':'image/webp','content-length':'5'}});}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('prepares every poster and full-quality video sequentially, prioritizes selection, and reuses saved copies on another visit',async()=>{
 const f=fixture(),calls=[];let concurrent=0,max=0;const options={items,storage:f.storage,delay:async()=>{},fetcher:async url=>{calls.push(url);concurrent++;max=Math.max(max,concurrent);await tick();concurrent--;return response(url);}};
 const first=createWallpaperPreparation(options);first.select(items[2].url);await first.resume();assert.equal(max,1);assert.deepEqual(calls,[...items.map(i=>i.preview),items[2].url,items[0].url,items[1].url]);assert.deepEqual(first.snapshot(),{ready:3,total:3,state:'ready'});
 calls.length=0;const second=createWallpaperPreparation(options);await second.resume();assert.equal(calls.length,0);assert.equal(second.snapshot().ready,3);
 const source=await second.source(items[0].url);assert.match(source.url,/^blob:/);source.release();assert.equal(await second.source('/api/private-data'),null);
});
test('pausing aborts an unfinished download; resuming retries it without caching a partial response',async()=>{
 const f=fixture(),calls=[];let first=true,aborted=false;
 const cache=createWallpaperPreparation({items:items.slice(0,1),storage:f.storage,delay:async()=>{},fetcher:(url,{signal})=>{calls.push(url);if(!first)return Promise.resolve(response(url));first=false;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('paused','AbortError'));},{once:true}));}});
 const running=cache.resume();await tick();cache.pause();await running;assert.equal(aborted,true);assert.equal(f.entries.size,0);assert.equal(cache.snapshot().state,'paused');await cache.resume();assert.equal(cache.snapshot().ready,1);assert.equal(calls.filter(url=>url===items[0].preview).length,2);
});
test('changing the selected wallpaper aborts the old preparation and puts the new video next',async()=>{
 const f=fixture();for(const item of items)f.entries.set(item.preview,response(item.preview));let started,aborted=false;const blocked=new Promise(resolve=>started=resolve),calls=[];
 const cache=createWallpaperPreparation({items,storage:f.storage,delay:async()=>{},fetcher:(url,{signal})=>{calls.push(url);if(url!==items[0].url||aborted)return Promise.resolve(response(url));started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('changed','AbortError'));},{once:true}));}});
 cache.select(items[0].url);const running=cache.resume();await blocked;cache.select(items[2].url);await running;
 for(let i=0;i<10&&cache.snapshot().state!=='ready';i++)await tick();assert.equal(aborted,true);assert.deepEqual(calls,[items[0].url,items[2].url,items[0].url,items[1].url]);assert.equal(cache.snapshot().ready,3);
});
test('authentication pages, partial media, and wrong MIME types are never counted or cached; retry can recover',async()=>{
 const f=fixture();let failing=true;const cache=createWallpaperPreparation({items,storage:f.storage,delay:async()=>{},fetcher:async url=>!failing?response(url):url.endsWith('.webp')?new Response('login',{status:401,headers:{'content-type':'text/html'}}):url===items[0].url?response(url,206):new Response('page',{headers:{'content-type':'text/html'}})});
 await cache.resume();assert.equal(f.entries.size,0);assert.deepEqual(cache.snapshot(),{ready:0,total:3,state:'partial'});failing=false;await cache.retry();assert.equal(cache.snapshot().ready,3);
});
test('low quota and unsupported cache leave normal playback available without endless downloads',async()=>{
 const f=fixture();let calls=0;const cache=createWallpaperPreparation({items,storage:f.storage,delay:async()=>{},estimate:async()=>({quota:100,usage:95}),fetcher:async url=>{calls++;return response(url);}});
 await cache.resume();await cache.resume();assert.equal(calls,1);assert.equal(cache.snapshot().state,'storage');assert.equal(f.entries.size,0);assert.equal(await cache.source(items[0].url),null);
 const unsupported=createWallpaperPreparation({items,storage:null,fetcher:()=>{throw new Error('must not fetch');}});await unsupported.resume();assert.equal(unsupported.snapshot().state,'unavailable');assert.equal(await unsupported.source(items[0].url),null);
});
test('only bundled wallpaper paths can enter the preparation queue and failed estimates do not prevent caching',async()=>{
 const f=fixture(),calls=[];const cache=createWallpaperPreparation({items:[items[0],{url:'/api/profile.mp4',preview:items[1].preview},{url:'https://external.example/video.mp4',preview:items[2].preview}],storage:f.storage,delay:async()=>{},estimate:async()=>{throw new Error('unsupported');},fetcher:async url=>{calls.push(url);return response(url);}});
 await cache.resume();assert.deepEqual(calls,[items[0].preview,items[0].url]);assert.equal(cache.snapshot().total,1);
});
