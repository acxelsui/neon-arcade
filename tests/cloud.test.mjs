import test from 'node:test';
import assert from 'node:assert/strict';
import {initCloud,cloudGames} from '../public/cloud.js';

function fixture(getController,response={status:200}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),nodes=new Map(),routes=[],frames=[];
 class Element{
  constructor(){this.dataset={};this.events={};this.hidden=true;this.children=[];this.attributes={};}
  setAttribute(key,value){this.attributes[key]=value;}addEventListener(type,fn){this.events[type]=fn;}replaceChildren(...children){this.children=children;}scrollIntoView(){}remove(){this.removed=true;}focus(){this.focused=true;}
 }
 const tiles=['roblox','stumble'].map(id=>{const tile=new Element();tile.dataset.cloudGame=id;return tile;});
 const document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,new Element());return nodes.get(key);},querySelectorAll:()=>tiles};
 const transport={request:async()=>response};const controller={transport,frames,createFrame(){const frame={element:new Element(),fetchHandler:{client:{transport},handleFetch:async()=>response},go:url=>routes.push(url),reload(){this.reloaded=true;}};frames.push(frame);return frame;}};
 Object.defineProperty(globalThis,'document',{value:document,configurable:true});initCloud(getController||(()=>Promise.resolve(controller)));
 return{nodes,tiles,routes,controller,restore(){if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}};
}
test('Stumble Guys uses the game-only launcher in a registered arcade proxy frame; switching games and reload stay in that frame',async()=>{
 const f=fixture();try{
  await f.tiles[1].onclick();assert.deepEqual(f.routes,[cloudGames.stumble.url]);assert.match(f.routes[0],/\/embed\/truffled\/as3455$/);assert.equal(f.controller.frames.length,1);assert.equal(f.nodes.get('#cloud-session').hidden,false);assert.equal(f.nodes.get('#cloud-selected').textContent,'Stumble Guys');assert.equal(f.tiles[1].attributes['aria-pressed'],'true');
  f.nodes.get('#cloud-reload').onclick();assert.equal(f.controller.frames[0].reloaded,true);
  await f.tiles[0].onclick();assert.equal(f.controller.frames.length,1);assert.equal(f.routes[1],cloudGames.roblox.url);assert.equal(f.nodes.get('#cloud-session-title').textContent,'Neon Cloud Gaming · Roblox');
  const frame=f.controller.frames[0];f.nodes.get('#cloud-stop').onclick();assert.equal(f.controller.frames.length,0);assert.equal(frame.element.removed,true);assert.equal(f.nodes.get('#cloud-session').hidden,true);assert.equal(f.tiles[0].focused,true);
 }finally{f.restore();}
});
test('closing while the shared proxy connects prevents a late game from opening and restores both tiles',async()=>{
 let release;const f=fixture(()=>new Promise(resolve=>release=resolve));try{
  const opening=f.tiles[1].onclick();assert.ok(f.tiles.every(tile=>tile.disabled));f.nodes.get('#cloud-stop').onclick();release(f.controller);await opening;assert.equal(f.controller.frames.length,0);assert.equal(f.routes.length,0);assert.ok(f.tiles.every(tile=>!tile.disabled));
 }finally{f.restore();}
});
test('launcher connection errors expose reload recovery outside the game frame',async()=>{
 const f=fixture(null,{status:503});try{
  await f.tiles[1].onclick();await f.controller.frames[0].fetchHandler.handleFetch({mode:'navigate'});assert.match(f.nodes.get('#cloud-status').textContent,/503.*Reload/);
 }finally{f.restore();}
 const failed=fixture(()=>Promise.reject(Error('Relay unavailable')));
 try{await failed.tiles[1].onclick();assert.match(failed.nodes.get('#cloud-status').textContent,/Stumble Guys.*Relay unavailable/);assert.ok(failed.tiles.every(tile=>!tile.disabled));}finally{failed.restore();}
});
