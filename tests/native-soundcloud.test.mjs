import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSoundCloudMusic} from '../public/native-soundcloud.js';
const track=(name,more={})=>({title:name,permalink_url:'https://soundcloud.com/artist/'+name,duration:120000,user:{username:'Artist'},...more});
function fixture(respond){
 const calls=[],changes=[],messages=[];const transport={request:async url=>{calls.push(url.href);const body=await respond(url);return {status:200,headers:[],body:new TextEncoder().encode(typeof body==='string'?body:JSON.stringify(body))};}};
 const engine=createNativeSoundCloudMusic(async()=>({transport}),{replaceChildren(){}},text=>messages.push(text),{catalogueChanged:value=>changes.push(value)});
 return {engine,calls,changes,messages};
}
const discovery='<script src="https://a-v2.sndcdn.com/assets/public.js"></script>',asset='client_id:"'+'a'.repeat(32)+'"';
test('native search returns individual songs, filters premium content and paginates without loading a provider app',async()=>{
 const f=fixture(url=>url.hostname==='soundcloud.com'?discovery:url.hostname==='a-v2.sndcdn.com'?asset:{collection:url.searchParams.get('offset')==='0'?[track('one'),track('paid',{policy:'SNIP'})]:[track('one'),track('two')],next_href:url.searchParams.get('offset')==='0'?'https://api-v2.soundcloud.com/next':null});
 await f.engine.search('Artist');assert.deepEqual(f.engine.catalog().songs.map(t=>t.title),['one']);assert.equal(f.engine.catalog().more,true);await f.engine.loadMore();assert.deepEqual(f.engine.catalog().songs.map(t=>t.title),['one','two']);assert.equal(f.calls.filter(url=>url.startsWith('https://soundcloud.com/')).length,1);assert.equal(f.engine.catalog().more,false);assert.equal(f.engine.catalog().busy,false);f.engine.stop();
});
test('native playlist search keeps real set URLs and source artwork',async()=>{
 const f=fixture(url=>url.hostname==='soundcloud.com'?discovery:url.hostname==='a-v2.sndcdn.com'?asset:{collection:[{title:'Mix',permalink_url:'https://soundcloud.com/artist/sets/mix',artwork_url:'https://i1.sndcdn.com/mix.jpg',user:{username:'Artist'}},{title:'foreign',permalink_url:'https://example.com/sets/mix'}]});
 await f.engine.search('Mix','sets');assert.equal(f.engine.catalog().collections.length,1);assert.equal(f.engine.catalog().collections[0].title,'Mix');assert.equal(f.engine.catalog().songs.length,0);assert.match(f.calls.at(-1),/search\/playlists/);f.engine.stop();
});
test('a late search cannot replace a newer query',async()=>{
 let release;const f=fixture(url=>url.hostname==='soundcloud.com'?discovery:url.hostname==='a-v2.sndcdn.com'?asset:url.searchParams.get('q')==='old'?new Promise(resolve=>release=()=>resolve({collection:[track('old')]})):{collection:[track('new')]});
 const old=f.engine.search('old');while(!release)await new Promise(resolve=>setImmediate(resolve));await f.engine.search('new');release();await old;assert.deepEqual(f.engine.catalog().songs.map(t=>t.title),['new']);f.engine.stop();
});
