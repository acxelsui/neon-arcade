import test from 'node:test';
import assert from 'node:assert/strict';
import {achromaGames,achromaLauncher,achromaTransport} from '../public/cloud-sources.js';
import {cloudGames} from '../public/cloud.js';

test('second launcher matches existing games and uses the actual game iframe routes',()=>{
 assert.equal(Object.keys(achromaGames).length,15);
 for(const id of Object.keys(achromaGames)){assert.ok(Object.hasOwn(cloudGames,id));const u=new URL(achromaLauncher(id));assert.equal(u.origin,'https://bikesense.org');assert.ok(!u.pathname.endsWith('index.svg'));}
 assert.equal(achromaLauncher('roblox'),'https://bikesense.org/synapse/index.html?game=com.roblox.client');
 assert.equal(achromaLauncher('gtav'),'https://bikesense.org/neon-cloud-launcher.html?game=gtav');
 for(const id of ['madden','toString','constructor','other'])assert.equal(achromaLauncher(id),null);
});
test('only the owned launcher files are supplied locally; provider APIs, stream embeds and connections retain the relay',async()=>{
 const remoteCalls=[],localCalls=[],signal=new AbortController().signal,transport={tag:'original',connect(){return this.tag;},request(...args){assert.equal(this.tag,'original');remoteCalls.push(args);return{status:200,body:null,headers:[]};}};
 const adapted=achromaTransport(transport,'https://neon.invalid',async(...args)=>{localCalls.push(args);return new Response('config=NEON_CLOUD_CONFIG');});
 const response=await adapted.request(new URL(achromaLauncher('gtav')),'GET',null,[],signal);assert.match(await new Response(response.body).text(),/"key":"jy0108"/);assert.equal(new Headers(response.headers).get('cache-control'),'no-store');assert.equal(String(localCalls[0][0]),'https://neon.invalid/cloud-launcher.html');assert.equal(localCalls[0][1].signal,signal);assert.equal(adapted.connect(),'original');
 for(const path of ['/neon-cloud-launcher.js','/neon-cloud-session.js'])await adapted.request(new URL('https://bikesense.org'+path),'GET',null,[],signal);
 assert.equal(localCalls.length,3);
 for(const url of ['https://bikesense.org/cloud/v1/embed?id=session','https://bikesense.org/cloud/v1/startGame','https://bikesense.org/api/cloud-games','https://bikesense.org/synapse/index.html?game=com.roblox.client','https://other.invalid/neon-cloud-launcher.js']){
  const headers=[['Cookie','provider-session']],body=new Uint8Array([1]);await adapted.request(new URL(url),'POST',body,headers,signal);assert.equal(remoteCalls.at(-1)[2],body);assert.equal(remoteCalls.at(-1)[3],headers);assert.equal(remoteCalls.at(-1)[4],signal);
 }
 assert.equal(localCalls.length,3);
 const rejected=await adapted.request(new URL('https://bikesense.org/neon-cloud-launcher.html?game=constructor'),'GET',null,[]);assert.equal(rejected.status,404);assert.equal(localCalls.length,3);
});
