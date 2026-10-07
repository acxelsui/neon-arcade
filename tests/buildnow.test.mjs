import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../math-tutors-main/math-tutors-main/581-f.html',import.meta.url),'utf8');
const loader=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(match=>match[1].includes('const PART_SIZES'))[1];
const download=loader.slice(0,loader.indexOf('    async function preMergeAll()'));
const file='7db022abd161455e3cc5f207e75d294b.wasm';

test('an interrupted BuildNow chunk retries without probing or falling back to a missing whole file',async()=>{
 const calls=[];let blob;
 class TestURL extends URL {static createObjectURL(value){blob=value;return 'blob:engine';}}
 const context={URL:TestURL,Blob,Uint8Array,Error,Promise,document:{baseURI:'https://cdn.jsdelivr.net/gh/bubblfan/cg-rip@main/buildnow-gg/'},setTimeout(callback){callback();},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,arrayBuffer:async()=>new Uint8Array(calls.length===1?[0,97]:[0,97,115,109]).buffer};}};
 const result=await vm.runInNewContext('(async()=>{'+download+'PART_SIZES["'+file+'"]=[4];return mergeParts("Build/'+file+'");})()',context);
 assert.equal(result,'blob:engine');assert.equal(calls.length,2);
 assert.ok(calls.every(call=>call.url.endsWith('.wasm.part1')&&call.options===undefined));
 assert.equal(blob.type,'application/wasm');assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[0,97,115,109]);
});

test('a full-length error body is never accepted as a valid game engine',async()=>{
 const context={URL,Blob,Uint8Array,Error,Promise,document:{baseURI:'https://cdn.jsdelivr.net/gh/bubblfan/cg-rip@main/buildnow-gg/'},setTimeout(callback){callback();},fetch:async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([9,9,9,9]).buffer})};
 await assert.rejects(vm.runInNewContext('(async()=>{'+download+'PART_SIZES["'+file+'"]=[4];return mergeParts("Build/'+file+'");})()',context),/engine download is invalid/);
});

test('only the CrazyGames duplicate is removed; original BuildNow identity, saves and fullscreen stay available',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
 assert.equal(catalog.games.filter(game=>/buildnow/i.test(game.name)).length,1);
 const game=catalog.games.find(game=>game.id==='581');assert.equal(game.name,'BuildNow.gg');assert.equal(game.url,'/games/581-f.html');
 assert.ok(!catalog.games.some(game=>game.id==='buildnow-gg'));
 assert.match(html,/companyName: "BuildNow GG"/);assert.match(html,/productName: "BuildNow GG"/);
 assert.match(html,/window.gameInstance = unityInstance/);assert.doesNotMatch(html,/alert\(message\)/);
 const runner=await readFile(new URL('../public/game-runner.js',import.meta.url),'utf8');assert.match(runner,/allowFullscreen = true/);assert.match(runner,/prepareGameSave\(game.id/);
});
