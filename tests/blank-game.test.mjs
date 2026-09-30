import test from 'node:test';
import assert from 'node:assert/strict';
import {openBlankGame} from '../accounts/blank-game.js';
import {readFile} from 'node:fs/promises';
function fixture(){
 const messages=[],opened=[],elements=[];let listener;
 const tab={document:{head:{append(){}},body:{append(){}},createElement(tag){const e={tag,setAttribute(){},contentWindow:{postMessage(...args){messages.push(args)}}};elements.push(e);return e}},addEventListener(type,fn){listener=fn}};
 const options={game:{id:'34',name:'Retro Bowl College'},contentOrigin:'https://arcade.example',accountOrigin:'https://account.example',pass:'test-pass',host:{open(...args){opened.push(args);return tab}}};
 return {options,tab,messages,opened,elements,emit:e=>listener(e)};
}
test('game stays in about:blank with an authenticated isolated frame',()=>{
 const f=fixture();assert.equal(openBlankGame(f.options),true);assert.deepEqual(f.opened,[['about:blank','_blank']]);
 const frame=f.elements.find(e=>e.tag==='iframe');assert.equal(frame.src,'https://arcade.example/neon-access#game=34');assert.match(frame.allow,/cross-origin-isolated/);assert.equal(f.tab.opener,null);
 const event={source:frame.contentWindow,origin:f.options.contentOrigin,data:{channel:'neon-members-v1',type:'access-ready'}};
 f.emit({...event,origin:'https://other.example'});f.emit({...event,source:{}});assert.equal(f.messages.length,0);
 f.emit(event);f.emit(event);assert.equal(f.messages.length,1);assert.equal(f.messages[0][1],f.options.contentOrigin);
});
test('invalid game IDs and blocked popups leave launcher unsuccessful',()=>{
 const f=fixture();assert.equal(openBlankGame({...f.options,game:{id:'../escape',name:'bad'}}),false);assert.equal(f.opened.length,0);
 assert.equal(openBlankGame({...f.options,host:{open:()=>null}}),false);
});

test('every catalog game can open through the authenticated blank-tab launcher',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
 for(const game of catalog.games){
  const f=fixture();assert.equal(openBlankGame({...f.options,game}),true,game.name);
  assert.equal(f.elements.find(e=>e.tag==='iframe').src,'https://arcade.example/neon-access#game='+encodeURIComponent(game.id));
 }
});
