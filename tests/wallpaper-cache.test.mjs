import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/wallpaper-cache.js';
const path='/wallpapers/4k/demo.mp4',url='https://neon.example'+path;
const bytes=Uint8Array.from({length:20},(_,i)=>i);
const storage={async open(name){assert.equal(name,'neon-wallpapers-20261004-v2');return{async match(key){assert.equal(key,path);return new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,7));c.enqueue(bytes.slice(7,14));c.enqueue(bytes.slice(14));c.close();}}),{headers:{'content-type':'video/mp4','content-length':'20'}});}};}};
test('a cached 4K movie streams without constructing a full-file blob',async()=>{
 const response=await neonWallpaperCache(new Request(url),storage);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
});
test('cached video ranges support initial, open-ended, suffix and clamped seeks across chunks',async()=>{
 for(const [range,start,end] of [['bytes=0-4',0,4],['bytes=5-15',5,15],['bytes=9-',9,19],['bytes=-6',14,19],['bytes=18-99',18,19]]){
  const response=await neonWallpaperCache(new Request(url,{headers:{range}}),storage);assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/20`);assert.equal(Number(response.headers.get('content-length')),end-start+1);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(start,end+1));
 }
});
test('bad ranges, missing cache and private or non-media requests preserve ordinary network handling',async()=>{
 assert.equal((await neonWallpaperCache(new Request(url,{headers:{range:'bytes=30-40'}}),storage)).status,416);
 for(const range of ['bytes=8-2','bytes=20-'])assert.equal((await neonWallpaperCache(new Request(url,{headers:{range}}),storage)).status,416);
 for(const range of ['bytes=0-2,4-6','garbage','bytes=-'])assert.equal(await neonWallpaperCache(new Request(url,{headers:{range}}),storage),null);
 for(const name of ['/api/profile','/covers/a.png','/wallpapers/4k/demo.mp4?private=1'])assert.equal(await neonWallpaperCache(new Request('https://neon.example'+name),storage),null);
 assert.equal(await neonWallpaperCache(new Request(url,{method:'POST'}),storage),null);
 for(const saved of [null,new Response('login',{status:401}),new Response('page',{headers:{'content-type':'text/html'}})])assert.equal(await neonWallpaperCache(new Request(url),{async open(){return{async match(){return saved;}};}}),null);
 assert.equal(await neonWallpaperCache(new Request(url),{async open(){throw Error('disabled');}}),null);
});

test('the original-quality 4K opening clip streams through the same range-aware cache',async()=>{const request=new Request('https://neon.example/wallpapers/4k-start/demo.mp4',{headers:{range:'bytes=2-6'}});const saved={async open(){return{async match(key){assert.equal(key,'/wallpapers/4k-start/demo.mp4');return new Response(bytes,{headers:{'content-type':'video/mp4','content-length':'20'}});}};}};const result=await neonWallpaperCache(request,saved);assert.equal(result.status,206);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),bytes.slice(2,7));});
