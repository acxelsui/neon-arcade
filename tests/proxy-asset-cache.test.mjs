import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/proxy-asset-cache.js';
const url=new URL('https://cdn.example/app.js');
function fixture(){
 const entries=new Map(),cache={
  async match(request){for(const {key,response} of entries.values()){if(key.url!==request.url)continue;const vary=(response.headers.get('vary')||'').split(',').map(s=>s.trim()).filter(Boolean);if(vary.every(name=>key.headers.get(name)===request.headers.get(name)))return response.clone();}},
  async put(key,response){entries.set(key.url+' '+JSON.stringify([...key.headers]),{key,response:new Response(await response.arrayBuffer(),{headers:response.headers,status:response.status,statusText:response.statusText})});},
  async delete(key){for(const [id,entry] of entries){if(entry.key.url===key.url&&JSON.stringify([...entry.key.headers])===JSON.stringify([...key.headers]))entries.delete(id);}},
  async keys(){return [...entries.values()].map(entry=>entry.key);}
 };
 return {entries,storage:{async open(name){assert.equal(name,'neon-public-proxy-assets-v1');return cache;}}};
}
function payload(text='bundle',options={}){const response=new Response(text,{status:options.status||200,headers:{'content-type':'application/javascript','cache-control':'public, max-age=60','content-length':String(new TextEncoder().encode(text).length),...options.headers}});return {body:response.body,headers:[...response.headers],status:response.status,statusText:response.statusText};}
async function consume(result){return new Response(result.body).text();}
function setup(options={}){const f=fixture(),calls=[];let make=()=>payload();const transport={ready:true,connect(){},async request(...args){assert.equal(this,transport);calls.push(args);return make();}};const originalConnect=transport.connect,cache=neonCreatePublicAssetCache({storage:f.storage,...options});assert.equal(cache.wrap(transport),transport);assert.equal(transport.connect,originalConnect);return {...f,calls,cache,transport,setResponse:fn=>make=fn,get:(remote=url,headers=[],method='GET',body=null,signal)=>transport.request(remote,method,body,headers,signal)};}

test('public assets stream immediately, reload locally, and retain original transport/session identity',async()=>{
 const f=setup();assert.equal(await consume(await f.get()),'bundle');await f.cache.flush();assert.equal(f.calls.length,1);const hit=await f.get();assert.equal(await consume(hit),'bundle');assert.equal(f.calls.length,1);assert.ok(!new Headers(hit.headers).has('x-neon-asset-expires'));assert.equal(f.transport.ready,true);
});
test('public game pictures can be reused, while JSON and music/video payloads remain on the original connection',async()=>{
 const f=setup();f.setResponse(()=>payload('picture',{headers:{'content-type':'image/webp'}}));const image=new URL('https://cdn.example/cover.webp');await consume(await f.get(image));await f.cache.flush();assert.equal(await consume(await f.get(image)),'picture');assert.equal(f.calls.length,1);
 for(const ext of ['json','mp4','mp3'])await consume(await f.get(new URL('https://cdn.example/data.'+ext)));await f.cache.flush();assert.equal(f.entries.size,1);assert.equal(f.calls.length,4);
});
test('background cache copies are limited while all live asset requests continue to stream',async()=>{
 const f=setup(),controllers=[];f.setResponse(()=>({status:200,statusText:'OK',headers:[['content-type','application/javascript'],['content-length','6'],['cache-control','public, max-age=60']],body:new ReadableStream({start(c){controllers.push(c);}})}));
 const results=await Promise.all(Array.from({length:5},(_,i)=>f.get(new URL(`https://cdn.example/${i}.js`))));assert.equal(results.length,5);assert.equal(f.calls.length,5);
 controllers.forEach(c=>{c.enqueue(new TextEncoder().encode('bundle'));c.close();});assert.deepEqual(await Promise.all(results.map(consume)),Array(5).fill('bundle'));await f.cache.flush();assert.equal(f.entries.size,4);
});
test('private or changing player data, authenticated requests, partial bytes and documents always use the relay',async()=>{
 const f=setup();for(const [remote,headers,method,body] of [[url,[['Cookie','session=private']],'GET',null],[url,[['Authorization','secret']],'GET',null],[url,[['Range','bytes=0-2']],'GET',null],[url,[['X-Session-ID','private']],'GET',null],[url,[['Cache-Control','no-store']],'GET',null],[url,[],'POST','save'],[new URL('https://cdn.example/api/save.js'),[],'GET',null],[new URL('https://cdn.example/app.js?token=private'),[],'GET',null],[new URL('https://cdn.example/data.json'),[],'GET',null],[new URL('https://cdn.example/home.html'),[],'GET',null]]){await consume(await f.get(remote,headers,method,body));}await f.cache.flush();assert.equal(f.calls.length,10);assert.equal(f.entries.size,0);
 for(const options of [{headers:{'cache-control':'private, max-age=60'}},{headers:{'cache-control':'public, no-store, max-age=60'}},{headers:{'set-cookie':'session=secret'}},{headers:{vary:'Cookie'}},{headers:{vary:'*'}},{headers:{'content-type':'text/html'}},{status:206},{status:401}]){f.setResponse(()=>payload('private',options));await consume(await f.get());}await f.cache.flush();assert.equal(f.entries.size,0);
});
test('expires cached copies and honors reload directives without touching other caches',async()=>{
 let now=0;const f=setup({now:()=>now});await consume(await f.get());await f.cache.flush();now=61000;f.setResponse(()=>payload('changed'));assert.equal(await consume(await f.get()),'changed');await f.cache.flush();assert.equal(f.calls.length,2);
 await consume(await f.get(url,[['Cache-Control','no-cache']]));await consume(await f.get(url,[['Pragma','no-cache']]));assert.equal(f.calls.length,4);
 await f.cache.flush();f.setResponse(()=>payload('reloaded'));assert.equal(await consume(await f.get(url,[['Cache-Control','max-age=0']])),'reloaded');await f.cache.flush();assert.equal(await consume(await f.get()),'reloaded');assert.equal(f.calls.length,5);
});
test('Vary keeps language variants separate and unsupported personalized variants are not stored',async()=>{
 const f=setup();f.setResponse(()=>payload('en',{headers:{vary:'Accept-Language'}}));await consume(await f.get(url,[['Accept-Language','en']]));await f.cache.flush();f.setResponse(()=>payload('fr',{headers:{vary:'Accept-Language'}}));await consume(await f.get(url,[['Accept-Language','fr']]));await f.cache.flush();assert.equal(await consume(await f.get(url,[['Accept-Language','en']])),'en');assert.equal(await consume(await f.get(url,[['Accept-Language','fr']])),'fr');assert.equal(f.calls.length,2);
});
test('bounded asset cache evicts older files without interrupting the live body, and unknown or oversized lengths are excluded',async()=>{
 const f=setup({maxFile:6,maxTotal:10,maxEntries:2});for(const name of ['a','b','c']){assert.equal(await consume(await f.get(new URL(`https://cdn.example/${name}.js`))),'bundle');await f.cache.flush();}assert.equal(f.entries.size,1);assert.ok([...f.entries.values()][0].key.url.endsWith('/c.js'));
 for(const headers of [{'content-length':'20'},{'content-length':'0'}]){f.setResponse(()=>payload('long asset',{headers}));assert.equal(await consume(await f.get(new URL('https://cdn.example/large.js'))),'long asset');await f.cache.flush();assert.equal(f.entries.size,1);}
 f.setResponse(()=>payload('actually long',{headers:{'content-length':'3'}}));assert.equal(await consume(await f.get(new URL('https://cdn.example/misreported.js'))),'actually long');await f.cache.flush();assert.equal(f.entries.size,1);
});
test('storage failures leave normal traffic intact, and a canceled caller cannot read a cache hit',async()=>{
 for(const storage of [null,{async open(){throw Error('blocked');}},{async open(){return {match:async()=>null,keys:async()=>[],put:async()=>{throw new DOMException('full','QuotaExceededError');}};}}]){const calls=[],transport={async request(){calls.push(1);return payload();}};const cache=neonCreatePublicAssetCache({storage});cache.wrap(transport);assert.equal(await consume(await transport.request(url,'GET',null,[])),'bundle');await cache.flush();assert.equal(calls.length,1);}
 const f=setup();await consume(await f.get());await f.cache.flush();const abort=new AbortController();abort.abort();await assert.rejects(f.get(url,[],'GET',null,abort.signal),{name:'AbortError'});assert.equal(f.calls.length,1);
});
test('a cached public transport can still be adapted to existing bundled games without changing their virtual save origin',async()=>{
 const {gameTransport,GAME_ORIGIN}=await import('../public/game-transport.js');const f=setup();let local;gameTransport(f.transport,'https://arcade.example',async address=>{local=address;return new Response('local');});assert.equal(await consume(await f.get(new URL(GAME_ORIGIN+'/games/33-retro-bowl.html'))),'local');assert.equal(local,'https://arcade.example/games/33-retro-bowl.html');assert.equal(f.calls.length,0);await consume(await f.get());await f.cache.flush();await consume(await f.get());assert.equal(f.calls.length,1);
});
