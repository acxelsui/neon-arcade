import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectTubePlayer,tubePlayerError} from '../public/neon-tube-player.js';
test('player errors distinguish unavailable and embedding-restricted videos',()=>{
 assert.match(tubePlayerError(100),/removed, or private/);assert.match(tubePlayerError(150),/does not allow/);assert.match(tubePlayerError(153),/identify/);assert.match(tubePlayerError(-1),/verification/);
});
test('standard playback uses a direct identified embed and ignores callbacks after close',async()=>{
 const originals=new Map(['window','document','location'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let handlers,destroyed=false;const events=[],attributes={};
 const element={setAttribute:(key,value)=>attributes[key]=value,remove(){this.removed=true}};
 try{
  globalThis.location={origin:'https://neon.example'};globalThis.document={createElement:()=>element};
  globalThis.window={YT:{Player:class{constructor(el,options){assert.equal(el,element);handlers=options.events}destroy(){destroyed=true}cueVideoById(){}}}};
  const player=createDirectTubePlayer({append:el=>assert.equal(el,element)},{id:'jNQXAC9IVRw',player:'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?start=4'},{onReady:()=>events.push('ready'),onState:state=>events.push(state),onError:message=>events.push(message)});
  await Promise.resolve();const url=new URL(element.src);assert.equal(url.origin,'https://www.youtube-nocookie.com');assert.equal(url.searchParams.get('origin'),'https://neon.example');assert.equal(url.searchParams.get('enablejsapi'),'1');assert.equal(element.referrerPolicy,'strict-origin-when-cross-origin');assert.ok(Object.hasOwn(attributes,'credentialless'));assert.ok(!attributes.sandbox.includes('allow-popups'));
  handlers.onReady();handlers.onStateChange({data:1});assert.deepEqual(events,['ready',1]);
  player.destroy();handlers.onError({data:100});assert.equal(destroyed,true);assert.equal(element.removed,true);assert.equal(events.length,2);
 }finally{for(const [key,descriptor] of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];}
});
