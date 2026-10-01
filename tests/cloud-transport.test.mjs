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
