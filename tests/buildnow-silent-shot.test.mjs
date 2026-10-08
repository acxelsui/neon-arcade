import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchBuildNowShotWasm,installLolSilentShot} from '../public/lol-silent-shot.js';
const kernel=fs.readFileSync(new URL('./fixtures/buildnow-shot-kernel.wasm',import.meta.url));
async function fixture(kind='player'){
 const {instance}=await WebAssembly.instantiate(kernel),e=instance.exports,u=new Uint32Array(e.memory.buffer),f=new Float32Array(e.memory.buffer),b=new Uint8Array(e.memory.buffer);
 e.state.value=4096;u[1024]=1;u[1025]=1000;u[1026]=['player','dummy','training-bot','trainer'].indexOf(kind);u[1027]=1234567;f.set([1,2,10],1028);u[1031]=100;u[1032]=8000;u[1035]=5000;u[(5000+8)/4]=1;u[(5000+({dummy:44,'training-bot':64,trainer:28}[kind]||1336))/4]=8000;b[1000+157]=1;
 return {e,u,f,b,shoot:()=>e.fire(1000,0,0),direction:()=>[...f.slice(750,753)]};
}
test('BuildNow redirects native Fire direction for players and dummies while preserving weapon and target state',async()=>{
 for(const kind of ['player','dummy','training-bot','trainer']){const x=await fixture(kind),before=x.b.slice();x.shoot();const n=Math.sqrt(102),v=x.direction();assert.ok(Math.abs(v[0]-1/n)<1e-6);assert.ok(Math.abs(v[1]-1/n)<1e-6);assert.ok(Math.abs(v[2]-10/n)<1e-6);assert.equal(x.u[1033],1);
  for(let i=0;i<before.length;i++)if(before[i]!==x.b[i])assert.ok((i>=2288&&i<2300)||(i>=3000&&i<3012)||(i>=4096&&i<4144),'only scratch, output direction and own state change');}
});
test('BuildNow respects shot chance, off, remote weapons, dead players/dummies and replaced health objects',async()=>{
 for(const kind of ['player','dummy','training-bot','trainer'])for(const mode of ['off','other','remote','dead','replaced','destroyed','revoked','bad-kind']){const x=await fixture(kind);if(mode==='off')x.u[1024]=0;if(mode==='other')x.u[1025]=2000;if(mode==='remote')x.b[1157]=0;if(mode==='dead')x.b[8153]=1;if(mode==='replaced')x.u[1032]=8100;if(mode==='destroyed')x.u[1252]=0;if(mode==='revoked')x.e.state.value=0;if(mode==='bad-kind')x.u[1026]=255;x.shoot();assert.deepEqual(x.direction(),[0,0,1],kind+' '+mode);}
 const x=await fixture();x.u[1031]=90;for(let i=0;i<10000;i++)x.shoot();assert.ok(x.u[1033]>8800&&x.u[1033]<9200);assert.equal(x.u[1034],10000);
 const dead=await fixture();dead.b[5000+1331]=1;dead.shoot();assert.deepEqual(dead.direction(),[0,0,1]);
});
test('unknown BuildNow engines remain unchanged, and exported-memory builds connect and revoke',async()=>{
 assert.equal(await patchBuildNowShotWasm(kernel),null);
 const memory=new WebAssembly.Memory({initial:1}),g=new WebAssembly.Global({value:'i32',mutable:true},0),original=async()=>({instance:{exports:{ek:memory,neonSilentState:g}}}),wa={instantiate:original,validate:()=>true};
 const hook=installLolSilentShot({WebAssembly:wa,crypto,console},{gameId:'581'});await wa.instantiate(kernel,{});const m={HEAPU8:new Uint8Array(memory.buffer),HEAPU32:new Uint32Array(memory.buffer),HEAPF32:new Float32Array(memory.buffer),_malloc:()=>4096,_free(){}};
 assert.equal(hook.update(m,{enabled:true,shooting:1000,actor:5000,health:8000,kind:'dummy',point:[1,2,10],chance:85}),true);assert.equal(g.value,4096);assert.equal(m.HEAPU32[1032],8000);assert.equal(m.HEAPU32[1026],1);assert.equal(m.HEAPU32[1031],85);hook.revoke();assert.equal(g.value,0);assert.equal(m.HEAPU32[1024],0);assert.equal(wa.instantiate,original);
});
