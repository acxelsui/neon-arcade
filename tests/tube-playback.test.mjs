import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {tubeTransport} from '../public/tube-transport.js';
import {tubeVideoUrl,bindTubeSearch} from '../public/tube-navigation.js';
test('NeonTube replaces only its watch script; media byte ranges stay on the relay',async()=>{
 const calls=[],transport={request:async(...args)=>{calls.push(args);return {status:206,body:'bytes'};}};const adapted=tubeTransport(transport,'// owned player');
 const source=await adapted.request(new URL('https://bcsdny.net/~v/assets/watch.js'),'GET',null,[]);assert.equal(await new Response(source.body).text(),'// owned player');assert.equal(calls.length,0);
 const range=[['Range','bytes=0-4095']];const bytes=await adapted.request(new URL('https://bcsdny.net/~v/stream/dQw4w9WgXcQ?q=360'),'GET',null,range);assert.equal(bytes.status,206);assert.deepEqual(calls[0][3],range);
 await adapted.request(new URL('https://other.test/~v/assets/watch.js'),'GET',null,[]);assert.equal(calls.length,2);
});
test('video selections preserve a valid source ID and stay inside their proxy frame',()=>{
 assert.equal(tubeVideoUrl('watch?v=dQw4w9WgXcQ'),'https://bcsdny.net/~v/watch?v=dQw4w9WgXcQ');for(const value of ['javascript:alert(1)','https://other.test/watch?v=dQw4w9WgXcQ','watch?v=bad'])assert.equal(tubeVideoUrl(value),null);
 const events={};let url,prevented=false;bindTubeSearch({addEventListener:(name,fn)=>events[name]=fn,removeEventListener(){}},value=>url=value);events.click({target:{closest:selector=>selector==='a.vc,a.rel'?{getAttribute:()=> 'watch?v=dQw4w9WgXcQ'}:null},preventDefault:()=>prevented=true,stopImmediatePropagation(){}});assert.equal(url,tubeVideoUrl('watch?v=dQw4w9WgXcQ'));assert.equal(prevented,true);
});
test('player loads absolute proxy routes, starts media, and exposes retry on a stalled stream',async()=>{
 const elements={},timers=new Map(),routes=[];let sequence=0;const all=[];
 class Element{
  constructor(id=''){this.id=id;this.events={};this.children=[];this.hidden=false;this.options=[];this.style={};this.volume=1;this.currentTime=0;this.paused=true;all.push(this);}
  addEventListener(type,fn){this.events[type]=fn;}append(...items){this.children.push(...items);}prepend(...items){this.children.unshift(...items);}replaceChildren(...items){this.children=items;if(this.id==='picker')this.options=items;}setAttribute(){}removeAttribute(name){delete this[name];}querySelector(){return this.spin||(this.spin=new Element());}querySelectorAll(){return [];}pause(){this.paused=true;}load(){this.loads=(this.loads||0)+1;}play(){this.paused=false;return Promise.resolve();}
 }
 for(const name of ['player','audio','msg','msgText','picker','side','title','author','desc','subs','avatar','cc','ccWrap'])elements[name]=new Element(name);
 const source=await readFile(new URL('../public/tube-watch-player.js',import.meta.url),'utf8');
 const ctx=vm.createContext({document:{getElementById:id=>elements[id],createElement:()=>new Element(),body:new Element()},window:{addEventListener(){}},location:{search:'?v=dQw4w9WgXcQ'},URLSearchParams,AbortController,localStorage:{getItem:()=>null,setItem(){}},setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id),fetch:async url=>{routes.push(url);return {ok:true,json:async()=>url.includes('/qualities/')?{progressive:[{quality:360}],videoOnly:[]}:{title:'Video',videos:[],tracks:[]}};}});
 vm.runInContext(source,ctx);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements.player.src,'https://bcsdny.net/~v/stream/dQw4w9WgXcQ?q=360');assert.ok(routes.every(url=>url.startsWith('https://bcsdny.net/~v/api/')));elements.player.events.loadedmetadata();await Promise.resolve();assert.equal(elements.player.paused,false);
 [...timers.values()].find(timer=>timer.ms===20000).fn();assert.match(elements.msgText.textContent,/taking too long/);const retry=all.find(el=>el.textContent==='Try again ↻');assert.equal(retry.hidden,false);retry.onclick();assert.equal(retry.hidden,true);elements.player.events.canplay();assert.equal(elements.msg.hidden,true);
});
