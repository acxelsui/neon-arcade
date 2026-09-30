import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {openBlankGame} from '../accounts/blank-game.js';
function fixture(){
 const opened=[],elements=[],listeners={},messages=[],timers=new Map();let timerId=0;
 const tab={document:{head:{append(){}},body:{append(){}},querySelector(){return elements.find(e=>e.id==='blank-status')},createElement(tag){const e={tag,setAttribute(){},remove(){this.removed=true},contentWindow:{postMessage(...args){messages.push(args)}}};elements.push(e);return e}},addEventListener(type,fn){listeners[type]=fn},removeEventListener(type,fn){if(listeners[type]===fn)delete listeners[type]},setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout(id){timers.delete(id)}};
 const options={game:{id:'34',name:'Retro Bowl College'},contentOrigin:'https://arcade.example',accountOrigin:'https://account.example',pass:'test-pass',host:{open(...args){opened.push(args);return tab}}};
 return {options,tab,messages,opened,elements,timers,emit:e=>listeners.message?.(e)};
}
const moduleSource=(await readFile(new URL('../accounts/blank-game-host.js',import.meta.url),'utf8')).replace('export function startBlankGame','function startBlankGame');
function loadHost(f){vm.runInNewContext(moduleSource,{window:f.tab})}
test('blank tab loads the account handshake in its own module realm',()=>{
 const f=fixture();assert.equal(openBlankGame(f.options),true);assert.deepEqual(f.opened,[['about:blank','_blank']]);
 const script=f.elements.find(e=>e.tag==='script');assert.equal(script.type,'module');assert.equal(script.src,f.options.accountOrigin+'/blank-game-host.js');
 assert.equal(f.elements.some(e=>e.tag==='iframe'),false,'original account window must not own the game handshake');
 loadHost(f);assert.equal(f.tab.neonBlankGameLaunch,undefined,'remove the launch pass from the popup global');
 const frame=f.elements.find(e=>e.tag==='iframe');assert.equal(frame.src,'https://arcade.example/neon-access#game=34');assert.match(frame.allow,/cross-origin-isolated/);assert.equal(f.tab.opener,null);
 const event={source:frame.contentWindow,origin:f.options.contentOrigin,data:{channel:'neon-members-v1',type:'access-ready'}};
 f.emit({...event,origin:'https://other.example'});f.emit({...event,source:{}});assert.equal(f.messages.length,0);
 f.emit(event);f.emit(event);assert.equal(f.messages.length,1);assert.equal(f.messages[0][1],f.options.contentOrigin);assert.equal(f.messages[0][0].pass,'test-pass');
 f.emit({...event,data:{channel:'neon-members-v1',type:'access-granted'}});assert.equal(f.timers.size,0);assert.equal(f.elements.find(e=>e.id==='blank-status').hidden,true);
});
test('failed and stalled account connections clear the frame and report recovery',()=>{
 for(const failure of ['error','timeout']){
  const f=fixture();openBlankGame(f.options);loadHost(f);const frame=f.elements.find(e=>e.tag==='iframe');
  if(failure==='error')f.emit({source:frame.contentWindow,origin:f.options.contentOrigin,data:{channel:'neon-members-v1',type:'access-error'}});
  else [...f.timers.values()][0]();
  assert.equal(frame.removed,true);assert.equal(f.timers.size,0);assert.match(f.elements.find(e=>e.id==='blank-status').textContent,/again/);
 }
});
test('invalid game IDs and blocked popups leave launcher unsuccessful',()=>{
 const f=fixture();assert.equal(openBlankGame({...f.options,game:{id:'../escape',name:'bad'}}),false);assert.equal(f.opened.length,0);
 assert.equal(openBlankGame({...f.options,host:{open:()=>null}}),false);
});
test('every catalog game uses the same authenticated proxy runner in about:blank',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
 for(const game of catalog.games){
  const f=fixture();assert.equal(openBlankGame({...f.options,game}),true,game.name);loadHost(f);
  assert.equal(f.elements.find(e=>e.tag==='iframe').src,'https://arcade.example/neon-access#game='+encodeURIComponent(game.id));
 }
});
