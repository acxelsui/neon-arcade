import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../math-tutors-main/math-tutors-main/basket-random/',import.meta.url);
test('Basket Random has its engine, physics, image and sound assets locally',async()=>{
 const data=await readFile(new URL('data.json',root),'utf8');
 const images=[...data.matchAll(/"(\/games\/basket-random\/images\/[^"?]+)"/g)].map(match=>match[1].replace('/games/basket-random/',''));
 const audio=[...data.matchAll(/\["([^"/]+)",\[\["audio\/webm;/g)].map(match=>'media/'+match[1]+'.webm');
 assert.ok(images.length>=30);assert.equal(audio.length,16);
 for(const file of ['box2d.wasm','box2d.js','scripts/main.js','scripts/c3runtime.js','scripts/dispatchworker.js','scripts/jobworker.js',...new Set(images),...audio])assert.ok((await stat(new URL(file,root))).size>0,file);
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
 assert.equal(catalog.games.find(game=>game.id==='66').url,'/games/basket-random/index.html');
});
test('the actual Construct shader scheduler queues and polls until compilation completes',async()=>{
 const source=await readFile(new URL('scripts/c3runtime.js',root),'utf8');
 const start=source.indexOf('const t=new Set;let q=-1;function r()');const end=source.indexOf('function y(v,u,A)',start);
 assert.ok(start>0&&end>start);
 const method=source.match(/_WaitForObjectReady\(v\)\{const u=new Promise\(A=>\s*t\.add\(\{resolve:A,checkFunc:v\}\)\);[^}]+return u\}/)?.[0];assert.ok(method);
 const frames=[];let ready=false,cancelled=0;
 const context=vm.createContext({self:{requestAnimationFrame:fn=>(frames.push(fn),frames.length),cancelAnimationFrame:()=>cancelled++},check:()=>ready});
 const promise=vm.runInContext(source.slice(start,end)+`;const renderer={${method}};renderer._WaitForObjectReady(check)`,context);
 assert.equal(frames.length,1);frames.shift()();assert.equal(frames.length,1);ready=true;frames.shift()();await promise;assert.equal(frames.length,0);assert.equal(cancelled,0);
 // Ordinary stop/cancel operations remain present in the supplied engine.
 assert.match(source,/self\.cancelAnimationFrame\(this\._rafId\)/);
});
