import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicSearch,musicSearchResults} from '../public/music-search.js';
import {createMusicStartup,musicStartupAssets,MUSIC_URL} from '../public/music-startup.js';
import {initPlaylistSearch} from '../public/playlist-search.js';

const song={id:'qobuz:123',title:'A Song',artist:'Artist',duration:201,thumbnail:'/_o/m/cover/album'};
test('search normalizes provider songs into existing save records and rejects URLs, duplicates and oversized results',()=>{
 const found=musicSearchResults([song,song,{...song,id:'https://evil.test/song'},{...song,id:'qobuz:2',title:''},...Array.from({length:40},(_,i)=>({...song,id:'qobuz:'+i}))]);
 assert.equal(found.length,30);assert.equal(found[0].id,song.id);assert.equal(found[0].thumb,'https://cirrusbk6l.planet35.com/_o/m/cover/album');assert.equal(found[0].url,undefined);assert.equal(new Set(found.map(row=>row.id)).size,found.length);assert.throws(()=>musicSearchResults({error:'no service'}));
});
test('playlist searches use the same proxy transport, short-lived metadata cache and cancellation without a music iframe',async()=>{
 const calls=[],transport={request:async(...args)=>{calls.push(args);return {status:200,headers:[['content-type','application/json']],body:new Blob([JSON.stringify([song])]).stream()};}};
 let time=100;const search=createMusicSearch(async()=>({transport}),{clock:()=>time});
 const rows=await search.search('  Song & Artist  ');assert.equal(calls[0][0].href,'https://cirrusbk6l.planet35.com/_o/m/search?q=Song%20%26%20Artist');assert.equal(calls[0][1],'GET');assert.deepEqual(calls[0][3],[['Accept','application/json']]);assert.equal(rows[0].id,song.id);
 rows[0].title='edited';assert.equal((await search.search('song & artist'))[0].title,'A Song');assert.equal(calls.length,1);time+=300001;await search.search('song & artist');assert.equal(calls.length,2);
 const abort=new AbortController();abort.abort();await assert.rejects(search.search('another',{signal:abort.signal}),{name:'AbortError'});assert.equal(calls.length,2);search.clear();await search.search('song & artist');assert.equal(calls.length,3);
 await assert.rejects(search.search('x'));assert.equal(calls.length,3);
});
test('startup warms only four pinned scripts and playback, HTML, saves and credential-bearing requests stay uncached',async()=>{
 const calls=[];let time=100;const startup=createMusicStartup({clock:()=>time});
 const client=startup.wrap({request:async(url,method,body,headers)=>{calls.push({url,method,headers});return {status:200,headers:[['Content-Type','application/javascript'],['Cache-Control','public,max-age=0'],['Content-Length','4']],body:new Blob(['code']).stream()};}});
 await startup.warm(client);assert.equal(calls.length,4);const result=await client.request(new URL(musicStartupAssets[0]),'GET',null,[],undefined);assert.equal(await new Response(result.body).text(),'code');assert.equal(calls.length,4);
 for(const url of [MUSIC_URL,'https://cirrusbk6l.planet35.com/_o/m/stream/qobuz%3A123','https://arcade.example/game-save'])await client.request(new URL(url),'GET',null,[],undefined);
 for(const headers of [[['Cookie','session=private']],[['Authorization','Bearer private']],[['X-Session','private']],[['Cache-Control','no-cache']]])await client.request(new URL(musicStartupAssets[0]),'GET',null,headers,undefined);
 assert.equal(calls.length,11);time+=300001;await client.request(new URL(musicStartupAssets[0]),'GET',null,[],undefined);assert.equal(calls.length,12);
});
test('private and session-setting startup responses are not shared between requests',async()=>{
 for(const extra of [['cache-control','private'],['set-cookie','music=private'],['vary','Cookie']]){
  let calls=0;const startup=createMusicStartup(),client=startup.wrap({request:async()=>{calls++;return {status:200,headers:[['content-type','application/javascript'],extra],body:new Blob(['code']).stream()};}});
  for(let i=0;i<2;i++){const result=await client.request(new URL(musicStartupAssets[0]),'GET',null,[],undefined);await result.body.cancel();}assert.equal(calls,2);
 }
});
test('search Add leaves playback unchanged, respects playlist state and ignores results from an older query',async()=>{
 class Element{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.value='';}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this.attributes[k]=v;}}
 const doc={createElement:tag=>new Element(tag)},host=new Element('main'),events=[],saved=[];let target={editable:true,busy:false,name:'Gaming',tracks:[]},resolveOld;
 const search={search:query=>query==='old'?new Promise(resolve=>resolveOld=resolve):Promise.resolve([song]),clear(){}};
 const ui=initPlaylistSearch({host,doc,win:{dispatchEvent:event=>events.push(event.type)},getTarget:()=>target,artwork:()=>new Element('span'),addSong:row=>{saved.push(row);target.tracks.push(row);ui.refresh();},search});
 const [,form,status,results]=ui.element.children,input=form.children[0];input.value='old';const old=form.onsubmit({preventDefault(){}});input.value='new';input.oninput();await form.onsubmit({preventDefault(){}});resolveOld([{...song,title:'Stale'}]);await old;assert.equal(results.children[0].children[1].children[0].textContent,'A Song');
 const add=results.children[0].children[2];assert.equal(add.disabled,false);add.onclick();assert.equal(saved[0].id,song.id);assert.equal(add.disabled,true);assert.equal(add.textContent,'Added ✓');assert.deepEqual(events,['neon-music-prepare','neon-music-prepare']);assert.ok(!events.includes('neon-play-playlist'));
 target={editable:false,busy:false,name:'Shared',tracks:[]};ui.refresh();assert.equal(add.disabled,true);target={editable:true,busy:true,name:'Gaming',tracks:[]};ui.refresh();assert.equal(add.disabled,true);
 ui.clear();assert.equal(input.value,'');assert.equal(results.children.length,0);assert.ok(status.textContent.includes('don’t need to play'));
});
