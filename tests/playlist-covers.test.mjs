import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaylistCovers} from '../public/playlist-covers.js';
import {playlistSong,musicArtworkOrigin} from '../public/playlist-player.js';

test('song covers use the music relay, reuse downloads, and release image URLs',async()=>{
 const requests=[],revoked=[];let count=0;
 const covers=createPlaylistCovers(async()=>({transport:{request:async(url,method)=>{requests.push([url.href,method]);return {status:200,headers:[['Content-Type','image/jpeg']],body:new Response('image bytes').body};}}}),{makeURL:blob=>{assert.equal(blob.type,'image/jpeg');return 'blob:cover-'+(++count);},revokeURL:url=>revoked.push(url)});
 const url='https://cover.test/album.jpg';const results=await Promise.all([covers.load(url),covers.load(url)]);assert.deepEqual(results,['blob:cover-1','blob:cover-1']);assert.deepEqual(requests,[[url,'GET']]);
 covers.clear();assert.deepEqual(revoked,['blob:cover-1']);assert.equal(await covers.load(url),'');assert.equal(requests.length,1);
});

test('relative thumbnail metadata survives saving and old songs recover their exact cover',async()=>{
 const path='/_o/m/cover/drake',song={id:'qobuz:5176761',title:'Marvins Room',artist:'Drake',thumbnail:path};
 assert.equal(playlistSong(song).thumb,musicArtworkOrigin+path);
 const requests=[];let initialized=0;const client={ready:false,init:async()=>{initialized++;client.ready=true;},request:async remote=>{
  assert.equal(client.ready,true);requests.push(remote.href);
  if(remote.pathname==='/_o/m/search')return {status:200,headers:[['Content-Type','application/json']],body:new Response(JSON.stringify([{id:'wrong-song',thumbnail:'/wrong'},song])).body};
  assert.equal(remote.href,musicArtworkOrigin+path);return {status:200,headers:[['Content-Type','image/jpeg']],body:new Response('cover bytes').body};
 }};
 const covers=createPlaylistCovers(async()=>({transport:client}),{makeURL:()=> 'blob:drake',revokeURL:()=>{}});
 assert.equal(await covers.load({id:song.id,title:song.title,artist:song.artist,thumb:''}),'blob:drake');assert.equal(initialized,1);assert.equal(requests.length,2);
 assert.equal(await covers.load({id:song.id,title:song.title,artist:song.artist,thumb:''}),'blob:drake');assert.equal(requests.length,2);covers.clear();
});

test('cover recovery never substitutes artwork for a different recording',async()=>{
 let requests=0;const covers=createPlaylistCovers(async()=>({transport:{request:async()=>{requests++;return {status:200,headers:[],body:new Response(JSON.stringify([{id:'other',thumbnail:'https://cover.test/other.jpg'}])).body};}}}),{makeURL:()=>{throw Error('Wrong song cover');}});
 assert.equal(await covers.load({id:'qobuz:5176761',title:'Marvins Room',artist:'Drake',thumb:''}),'');assert.equal(requests,1);covers.clear();
});

test('artwork redirects stay on HTTPS and use the relay',async()=>{
 const requests=[];const covers=createPlaylistCovers(async()=>({transport:{request:async url=>{requests.push(url.href);return requests.length===1?{status:302,headers:[['Location','https://cdn.test/cover.jpg']],body:new Response('').body}:{status:200,headers:[['Content-Type','image/jpeg']],body:new Response('cover').body};}}}),{makeURL:()=> 'blob:redirect',revokeURL:()=>{}});
 assert.equal(await covers.load('https://cover.test/start'),'blob:redirect');assert.deepEqual(requests,['https://cover.test/start','https://cdn.test/cover.jpg']);covers.clear();
});

test('unavailable artwork and invalid URLs fall back without loading external scripts',async()=>{
 let requests=0;const covers=createPlaylistCovers(async()=>({transport:{request:async()=>{requests++;return {status:200,headers:[['Content-Type','text/html']],body:new Response('<html>no cover</html>').body};}}}),{makeURL:()=>{throw Error('HTML must not be displayed as artwork');}});
 for(const url of ['javascript:alert(1)','http://cover.test/image.jpg','https://user:secret@cover.test/image.jpg',''])assert.equal(await covers.load(url),'');assert.equal(requests,0);
 assert.equal(await covers.load('https://cover.test/missing.jpg'),'');assert.equal(requests,1);covers.clear();
});
