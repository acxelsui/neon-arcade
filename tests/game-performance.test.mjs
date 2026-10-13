import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachGamePerformance} from '../public/game-performance.js';
import {gameTransport} from '../public/game-transport.js';
import {minecraftFrame,minecraftFrames} from '../public/minecraft-source.js';
import {withoutBuildNowDemoAds,buildNowSdkAddress} from '../public/buildnow-sdk.js';

test('Minecraft uses only the selected game frame through the existing relay, with a WASM GC fallback',async()=>{
 const catalog=JSON.parse(readFileSync(new URL('../public/catalog.json',import.meta.url)));
 const entries=catalog.games.filter(g=>/minecraft|eaglercraft/i.test(g.name));assert.equal(entries.length,1);assert.equal(entries[0].name,'Minecraft');assert.equal(entries[0].url,minecraftFrames.wasm);
 assert.equal(minecraftFrame({validate:()=>true}),minecraftFrames.wasm);assert.equal(minecraftFrame({validate:()=>false}),minecraftFrames.javascript);assert.equal(minecraftFrame({validate(){throw Error();}}),minecraftFrames.javascript);
 const calls=[],transport=gameTransport({request:async(...args)=>{calls.push(args);return {status:200};}},'https://arcade.example',()=>{throw Error('must proxy');});
 await transport.request(new URL(entries[0].url),'GET',null,[],undefined);assert.equal(calls[0][0].href,minecraftFrames.wasm);
 assert.ok(readFileSync(new URL('../public/artwork/minecraft.webp',import.meta.url)).length>1000);
});
test('the real local BuildNow demo-ad methods finish ordinary ads without pausing and never fabricate rewards',async()=>{
 const source=readFileSync(new URL('fixtures/buildnow-demo-ad-methods.txt',import.meta.url),'utf8');const updated=withoutBuildNowDemoAds(source);assert.notEqual(updated,source);assert.equal(withoutBuildNowDemoAds('async requestAd(e,t) { return realSdkAd(e,t); }'),'async requestAd(e,t) { return realSdkAd(e,t); }');
 const ad=new Function('o','i',`return new (class {${updated}})()` )({wrapUserFn:fn=>fn},{AdError:Error});
 let started=0,finished=0,errors=0;ad.renderFakeAd=()=>{throw Error('must not create a demo overlay or timer');};
 const callbacks={adStarted:()=>started++,adFinished:()=>finished++,adError:()=>errors++};
 await ad.requestAd('midgame',callbacks);await ad.requestAd('midgame',callbacks);assert.equal(started,0);assert.equal(finished,2);assert.equal(ad.requestInProgress,false);assert.equal(ad.adPlaying,false);
 await ad.requestAd('rewarded',callbacks);assert.equal(finished,2);assert.equal(errors,1);assert.equal(started,0);
});
test('SDK rewrite is scoped to the exact BuildNow file and removes stale transfer length headers',async()=>{
 const source=readFileSync(new URL('fixtures/buildnow-demo-ad-methods.txt',import.meta.url),'utf8');
 const raw={status:200,headers:[['Content-Length','9000'],['Content-Encoding','gzip'],['Content-Type','text/javascript'],['ETag','old']],body:new Blob([source]).stream()};
 const transport=gameTransport({request:async()=>raw},'https://arcade.example');const result=await transport.request(new URL('https://cdn.jsdelivr.net/gh/bubblfan/cg-rip@main/buildnow-gg/cg-sdk.js'),'GET',null,[],undefined);
 assert.deepEqual(result.headers,[['Content-Type','text/javascript']]);assert.equal(await new Response(result.body).text(),withoutBuildNowDemoAds(source));
 const other={status:200,headers:[],body:new Blob([source]).stream()};const untouched=gameTransport({request:async()=>other},'https://arcade.example');assert.equal(await untouched.request(new URL('https://other.example/buildnow-gg/cg-sdk.js'),'GET',null,[],undefined),other);
});
test('a fresh framework address updates only the demo SDK URL so previously cached ads are not reused',async()=>{
 const source='function _InitSDK(){var script=document.createElement("script");script.src="cg-sdk.js";document.head.appendChild(script);} function other(){return "saved game";}';
 const updated=buildNowSdkAddress(source);assert.ok(updated.includes('cg-sdk.js?neon-standalone=20261013'));assert.ok(updated.endsWith('function other(){return "saved game";}'));assert.equal(buildNowSdkAddress(source+source),source+source,'ambiguous SDKs are left intact');
 let requested;const transport=gameTransport({request:async remote=>{requested=remote.href;return {status:200,headers:[['content-length','1']],body:new Blob([source]).stream()};}},'https://arcade.example');
 const url='https://cdn.jsdelivr.net/gh/bubblfan/cg-rip@main/buildnow-gg/Build/91a2bfcec140bc524100478b99a4f6d7.framework.js?neon-standalone=20261013';
 const result=await transport.request(new URL(url),'GET',null,[],undefined);assert.equal(requested,url);assert.equal(await new Response(result.body).text(),updated);
});
test('performance refresh preserves the running game and ignores forged sources, origins, games and nested frames',()=>{
 const events={},parent={},sent=[],draws=[],world={score:21,quarter:3};const win={parent,location:{origin:'https://arcade.example'},addEventListener:(n,fn)=>events[n]=fn,removeEventListener:(n)=>delete events[n]};parent.postMessage=(data,origin)=>sent.push({data,origin});let hook;
 attachGamePerformance({hooks:{init:{post:{}}}},{win,gameId:'33',Tap:{tap(_,fn){hook=fn;}}});
 const data={channel:'neon-game-performance-v1',action:'refresh',gameId:'33',requestId:'test'};
 const event={source:parent,origin:win.location.origin,data};
 hook({isTopLevel:true,window:{Event:class{constructor(type){this.type=type;}},dispatchEvent:e=>draws.push(e.type),world,location:{reload(){throw Error('would lose progress');}}}});
 hook({isTopLevel:false,window:{dispatchEvent(){throw Error('nested frame');}}});
 for(const bad of [{...event,source:{}},{...event,origin:'https://attacker.example'},{...event,data:{...data,gameId:'581'}}])events.message(bad);
 assert.equal(draws.length,0);assert.equal(sent.length,0);
 events.message(event);assert.deepEqual(draws,['resize']);assert.deepEqual(world,{score:21,quarter:3});assert.equal(sent[0].data.ready,true);
 events.pagehide();assert.equal(events.message,undefined);
});
