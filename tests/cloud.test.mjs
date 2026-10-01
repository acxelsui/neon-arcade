import test from 'node:test';
import assert from 'node:assert/strict';
import {initCloud,cloudGames} from '../public/cloud.js';

function fixture(getController,response={status:200}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),nodes=new Map(),routes=[],frames=[];
 class Element{
  constructor(){this.dataset={};this.events={};this.hidden=true;this.children=[];this.attributes={};}
  setAttribute(key,value){this.attributes[key]=value;}addEventListener(type,fn){this.events[type]=fn;}replaceChildren(...children){this.children=children;}scrollIntoView(){}remove(){this.removed=true;}focus(){this.focused=true;}
 }
 const tiles=Object.keys(cloudGames).map(id=>{const tile=new Element();tile.dataset.cloudGame=id;return tile;});
 const document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,new Element());return nodes.get(key);},querySelectorAll:()=>tiles};
 const transport={request:async()=>response};const controller={transport,frames,createFrame(){const frame={element:new Element(),fetchHandler:{client:{transport},handleFetch:async()=>response},go:url=>routes.push(url),reload(){this.reloaded=true;}};frames.push(frame);return frame;}};
 Object.defineProperty(globalThis,'document',{value:document,configurable:true});initCloud(getController||(()=>Promise.resolve(controller)));
 return{nodes,tiles,routes,controller,restore(){if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}};
}
test('Stumble Guys uses the game-only launcher in a registered arcade proxy frame; switching games and reload stay in that frame',async()=>{
 const f=fixture();try{
  await f.tiles[1].onclick();assert.deepEqual(f.routes,[cloudGames.stumble.url]);assert.match(f.routes[0],/\/embed\/truffled\/as3455$/);assert.equal(f.controller.frames.length,1);assert.equal(f.nodes.get('#cloud-session').hidden,false);assert.equal(f.nodes.get('#cloud-selected').textContent,'Stumble Guys');assert.equal(f.tiles[1].attributes['aria-pressed'],'true');
  f.nodes.get('#cloud-reload').onclick();assert.equal(f.controller.frames[0].reloaded,true);
  await f.tiles[0].onclick();assert.equal(f.controller.frames.length,1);assert.equal(f.routes[1],cloudGames.roblox.url);assert.equal(f.nodes.get('#cloud-session-title').textContent,'Neon Cloud Gaming · Roblox · Server 1');
  const frame=f.controller.frames[0];f.nodes.get('#cloud-stop').onclick();assert.equal(f.controller.frames.length,0);assert.equal(frame.element.removed,true);assert.equal(f.nodes.get('#cloud-session').hidden,true);assert.equal(f.tiles[0].focused,true);
 }finally{f.restore();}
});
test('switching cloud games updates the selected launcher and pinned game without replacing the proxy session',async()=>{
 const f=fixture();try{
  f.controller.transport.request=async()=>({status:200,headers:[['Content-Type','application/javascript']],body:new Response('const {proxy:p,embedId:g}=params();').body});
  await f.tiles[1].onclick();const frame=f.controller.frames[0];await f.tiles[2].onclick();assert.equal(f.controller.frames[0],frame);assert.equal(f.routes.at(-1),cloudGames.clash.url);assert.match(f.routes.at(-1),/\/embed\/truffled\/as5575$/);
  assert.equal(f.nodes.get('#cloud-selected').textContent,'Clash Royale');assert.equal(f.nodes.get('#cloud-session-title').textContent,'Neon Cloud Gaming · Clash Royale');assert.equal(f.tiles[1].attributes['aria-pressed'],'false');assert.equal(f.tiles[2].attributes['aria-pressed'],'true');
  const script=await frame.fetchHandler.client.transport.request(new URL('https://astra-education.top/assets/reading-list-launcher.js'),'GET',null,[]);assert.match(await new Response(script.body).text(),/embedId:"as5575"/);
  await f.tiles[3].onclick();assert.equal(f.controller.frames[0],frame);assert.equal(f.routes.at(-1),cloudGames.fortnite.url);assert.match(f.routes.at(-1),/\/embed\/truffled\/as1560$/);assert.equal(f.nodes.get('#cloud-selected').textContent,'Fortnite');assert.equal(f.tiles[2].attributes['aria-pressed'],'false');assert.equal(f.tiles[3].attributes['aria-pressed'],'true');
  const fortniteScript=await frame.fetchHandler.client.transport.request(new URL('https://astra-education.top/assets/reading-list-launcher.js'),'GET',null,[]);assert.match(await new Response(fortniteScript.body).text(),/embedId:"as1560"/);
  f.nodes.get('#cloud-reload').onclick();assert.equal(frame.reloaded,true);f.nodes.get('#cloud-stop').onclick();assert.equal(f.controller.frames.length,0);assert.equal(f.tiles[3].focused,true);
 }finally{f.restore();}
});
test('Below Zero, Schedule I, NBA 2K23, and Madden Mobile keep their own pinned launcher IDs when switching in the same proxy frame',async()=>{
 const f=fixture();try{
  f.controller.transport.request=async()=>({status:200,headers:[['Content-Type','application/javascript']],body:new Response('const {proxy:p,embedId:g}=params();').body});
  let frame;
  for(const [id,embedId,name] of [['subnautica','as2377','Subnautica: Below Zero'],['schedule','as2638','Schedule I'],['nba','as7788','NBA 2K23'],['madden','as0161','Madden NFL 24 Mobile']]){
   const tile=f.tiles.find(tile=>tile.dataset.cloudGame===id);await tile.onclick();
   frame ||= f.controller.frames[0];assert.equal(f.controller.frames.length,1);assert.equal(f.controller.frames[0],frame);
   assert.equal(f.routes.at(-1),'https://astra-education.top/embed/truffled/'+embedId);assert.equal(f.nodes.get('#cloud-selected').textContent,name);
   assert.equal(tile.attributes['aria-pressed'],'true');assert.equal(f.tiles.filter(tile=>tile.attributes['aria-pressed']==='true').length,1);
   const script=await frame.fetchHandler.client.transport.request(new URL('https://astra-education.top/assets/reading-list-launcher.js'),'GET',null,[]);
   assert.ok((await new Response(script.body).text()).includes('embedId:"'+embedId+'"'));
  }
  f.nodes.get('#cloud-stop').onclick();assert.equal(f.controller.frames.length,0);assert.equal(f.tiles.find(tile=>tile.dataset.cloudGame==='madden').focused,true);
 }finally{f.restore();}
});
test('Roblox lets players choose either server, relaunches in its existing proxy frame, and remembers the choice across game switches',async()=>{
 const f=fixture();try{
  const calls=[];f.controller.transport.request=async(...args)=>{calls.push(args);return{status:200,headers:[],body:null};};
  assert.equal(f.nodes.get('#cloud-server-choice').hidden,false);
  const selector=f.nodes.get('#cloud-server');selector.value='2';await selector.onchange();assert.equal(f.routes.length,0);
  await f.tiles[0].onclick();const frame=f.controller.frames[0];assert.match(f.routes.at(-1),/\/embed\/truffled\/as1366$/);assert.equal(frame.element.title,'Roblox · Server 2 cloud launcher');
  const launch=()=>frame.fetchHandler.client.transport.request(new URL('https://astra-education.top/api/cg/launch'),'POST',JSON.stringify({embedId:'as1366'}),[]);
  await launch();assert.equal(JSON.parse(new TextDecoder().decode(calls.at(-1)[2])).gameId,'roblox');
  selector.value='1';await selector.onchange();assert.equal(f.controller.frames[0],frame);await launch();assert.equal(JSON.parse(new TextDecoder().decode(calls.at(-1)[2])).gameId,'ng_roblox');
  await f.tiles[2].onclick();assert.equal(f.nodes.get('#cloud-server-choice').hidden,true);await f.tiles[0].onclick();assert.equal(f.nodes.get('#cloud-server-choice').hidden,false);assert.equal(selector.value,'1');
  selector.value='unexpected';await selector.onchange();assert.equal(selector.value,'1');
 }finally{f.restore();}
});
test('closing while the shared proxy connects prevents a late game from opening and restores all tiles',async()=>{
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
