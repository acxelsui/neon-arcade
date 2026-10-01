import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudTransport,pinCloudGame} from '../public/cloud-transport.js';
test('launcher route keeps the selected game even when rewritten route params contain another ID',()=>{
 const script='const {proxy:p,embedId:g}=params();result={proxy:p,id:g};';
 const corrected=pinCloudGame(script,'as3455');const result=new Function('params',corrected+'return result;')(()=>({proxy:'truffled',embedId:'encoded-route'}));assert.deepEqual(result,{proxy:'truffled',id:'as3455'});
 for(const invalid of ['as3455<script>','other',''])assert.equal(pinCloudGame(script,invalid),script);
});
test('only the game launcher script changes; catalogs and streams retain their live proxy session and request headers',async()=>{
 const calls=[],script='const {proxy:p,embedId:g}=params();',client={session:1,request:async function(...args){assert.equal(this.session,1);calls.push(args);return{status:200,headers:[['Content-Type','application/javascript'],['Content-Length','10']],body:new Response(script).body};},connect(){return this.session;}};
 let selected='as3455';const wrapped=cloudTransport(client,()=>selected),asset=new URL('https://astra-education.top/assets/reading-list-BwqmpOi8.js');
 const response=await wrapped.request(asset,'GET',null,[]);assert.match(await new Response(response.body).text(),/embedId:"as3455"/);assert.equal(new Headers(response.headers).has('content-length'),false);assert.equal(wrapped.connect(),1);
 const headers=[['Range','bytes=0-4095']];const stream=await wrapped.request(new URL('https://astra-education.top/api/cg/embed/games'),'GET',null,headers);assert.equal(await new Response(stream.body).text(),script);assert.deepEqual(calls[1][3],headers);
 selected=null;const untouched=await wrapped.request(asset,'GET',null,[]);assert.equal(await new Response(untouched.body).text(),script);
});
test('both Roblox servers use their real public IDs and matching providers while preserving session setup',async()=>{
 const calls=[],catalog={ok:true,games:[{embedId:'as1366',gameName:'Roblox',provider:'quaternary'},{embedId:'as5575',provider:'tertiary'}]};
 const transport={request:async(...args)=>{calls.push(args);return{status:200,headers:[['Content-Type','application/json'],['Content-Length','123'],['ETag','old']],body:new Response(JSON.stringify(catalog)).body};}};
 let selected='1';const wrapped=cloudTransport(transport,()=> 'as1366',()=>selected);
 for(const [choice,id,provider] of [['1','ng_roblox','quaternary'],['2','roblox','tertiary']]){
  selected=choice;
  const response=await wrapped.request(new URL('https://astra-education.top/api/cg/embed/games'),'GET',null,[['If-None-Match','old']]);
  const data=await new Response(response.body).json();assert.equal(data.games[0].provider,provider);assert.deepEqual(data.games[1],catalog.games[1]);assert.equal(new Headers(response.headers).get('cache-control'),'no-store');assert.equal(new Headers(response.headers).has('content-length'),false);assert.deepEqual(calls.at(-1)[3],[]);
  const setup={embedId:'as1366',webrtc:{probe:'test'},ngRelay:{region:'test'},sg_user_token:'session-token',tz:'America/New_York'},signal=new AbortController().signal;
  await wrapped.request(new URL('https://astra-education.top/api/cg/launch'),'POST',new TextEncoder().encode(JSON.stringify(setup)),[['Content-Type','application/json'],['Content-Length','9']],signal);
  const sent=calls.at(-1);assert.deepEqual(JSON.parse(new TextDecoder().decode(sent[2])),{gameId:id,webrtc:setup.webrtc,ngRelay:setup.ngRelay,sg_user_token:setup.sg_user_token,tz:setup.tz});assert.equal(sent[4],signal);assert.deepEqual(sent[3],[['Content-Type','application/json']]);
 }
});
test('Roblox server selection cannot rewrite other games, other hosts, media ranges, or arbitrary server IDs',async()=>{
 const calls=[],transport={request:async(...args)=>{calls.push(args);return{status:200,headers:[],body:null};}};
 let id='as1366',server='2';const wrapped=cloudTransport(transport,()=>id,()=>server),launch=new URL('https://astra-education.top/api/cg/launch');
 const otherBody=JSON.stringify({embedId:'as5575'});await wrapped.request(launch,'POST',otherBody,[]);assert.equal(new TextDecoder().decode(calls.at(-1)[2]),otherBody);
 const headers=[['Range','bytes=0-4095']],bytes=new Uint8Array([1,2,3]);await wrapped.request(new URL('https://astra-education.top/media/stream'),'GET',bytes,headers);assert.equal(calls.at(-1)[2],bytes);assert.equal(calls.at(-1)[3],headers);
 for(const remote of [new URL('https://other.invalid/api/cg/launch')]){await wrapped.request(remote,'POST',bytes,headers);assert.equal(calls.at(-1)[2],bytes);assert.equal(calls.at(-1)[3],headers);}
 id='as5575';await wrapped.request(launch,'POST',bytes,headers);assert.equal(calls.at(-1)[2],bytes);
 id='as1366';server='toString';await wrapped.request(launch,'POST',bytes,headers);assert.equal(calls.at(-1)[2],bytes);
});
