import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/game-runner.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
const createGameLoadReport=()=>()=>{};
test('Drive Mad launches its complete supplied address inside the proxy frame',async()=>{
 const game=catalog.games.find(g=>g.name==='Drive Mad');assert.ok(game);assert.notEqual(game.launch,'direct');
 let destination,appended,bootstrapped=false;
 const element={setAttribute(){},addEventListener(){}};
 const status={hidden:false};
 const proxyFrame={element,go(url){destination=url}};
 const context={prepareGameSave:async()=>true,createGameLoadReport,URL,URLSearchParams,Error,setTimeout:()=>1,clearTimeout(){},location:{origin:'https://arcade.example',search:'?id='+game.id},document:{querySelector:()=>status,body:{append(frame){appended=frame}}},fetch:async()=>({ok:true,json:async()=>catalog}),watchFrame(){},gameTransport(){},GAME_ORIGIN:'https://games.neon-arcade.invalid',initBootstrap:async()=>{bootstrapped=true;return {createFrame:()=>proxyFrame}}};
 await vm.runInNewContext('(async()=>{'+source+'})()',context);
 assert.equal(bootstrapped,true);assert.equal(appended,element);
 assert.equal(destination,'https://play.fancade.com/5F084A0BCE06B710/?max_w=999999&max_h=9999999&istart=1');
 assert.match(element.allow,/fullscreen/);
});
test('bundled games use the proxy controller even with an old direct launch flag',async()=>{
 const game={id:'bundled',name:'Bundled game',url:'/games/example/index.html',launch:'direct'};
 let destination,appended,configure;const status={hidden:false},element={setAttribute(){},addEventListener(){}};
 const originalTransport={},wrappedTransport={};
 const context={prepareGameSave:async()=>true,createGameLoadReport,URL,URLSearchParams,Error,setTimeout:()=>1,clearTimeout(){},location:{origin:'https://arcade.example',search:'?id=bundled'},document:{querySelector:()=>status,body:{append(frame){appended=frame}}},fetch:async()=>({ok:true,json:async()=>({games:[game]})}),watchFrame(){},gameTransport(transport,origin){assert.equal(transport,originalTransport);assert.equal(origin,'https://arcade.example');return wrappedTransport},GAME_ORIGIN:'https://games.neon-arcade.invalid',initBootstrap:async callback=>{configure=callback(originalTransport);return {createFrame:()=>({element,go(url){destination=url}})}}};
 await vm.runInNewContext('(async()=>{'+source+'})()',context);
 assert.equal(configure,wrappedTransport);assert.equal(appended,element);assert.equal(destination,'https://games.neon-arcade.invalid/games/example/index.html');
});
