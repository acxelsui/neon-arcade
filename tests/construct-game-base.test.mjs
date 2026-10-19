import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {repairConstructBase,repairConstructScheduling} from '../public/construct-game-base.js';
test('Construct workers and runtime use the document asset folder while explicit export bases remain unchanged',()=>{
 const source=`class RuntimeInterface{constructor(opts){this._useWorker=opts.useWorker;this.base=opts.runtimeBaseUrl||'wrong-page-folder';}};new RuntimeInterface(options).base`;
 const context={URL,document:{baseURI:'https://cdn.example/game/index.html'},options:{useWorker:false}};
 assert.equal(vm.runInNewContext(repairConstructBase(source),context),'https://cdn.example/game/');
 assert.equal(vm.runInNewContext(repairConstructBase(source),{...context,options:{useWorker:false,runtimeBaseUrl:'https://explicit.example/assets/'}}),'https://explicit.example/assets/');
 assert.equal(repairConstructBase('startGame();'),'startGame();');
});
test('matching broken Construct exports poll shaders again without disabling cancellation',async()=>{
 const source=`self.C3={};const t=new Set;let q=-1;function r(){q=-1;for(const v of t)v.checkFunc()&&(v.resolve(),t.delete(v));0<t.size&&(q=self.cancelAnimationFrame(r))}const renderer={_WaitForObjectReady(v){const u=new Promise(resolve=>t.add({resolve,checkFunc:v}));if(q===-1)q=self.cancelAnimationFrame(r);return u;}};function stop(id){self.cancelAnimationFrame(id)};stop(42);renderer._WaitForObjectReady(()=>true);`;
 const frames=[],cancelled=[];const promise=vm.runInNewContext(repairConstructScheduling(source),{self:{requestAnimationFrame:fn=>(frames.push(fn),1),cancelAnimationFrame:id=>cancelled.push(id)}});
 assert.equal(frames.length,1);frames.shift()();await promise;assert.deepEqual(cancelled,[42]);
 const other='function cleanup(p){cancelAnimationFrame(p)}';assert.equal(repairConstructScheduling(other),other);
});
