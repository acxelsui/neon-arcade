import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameFrameMeter,validFrameSample} from '../public/game-control-monitor.js';
import {createControlWorkspace,normalizeMenuAppearance} from '../public/game-control-workspace.js';
import {installLolRenderer} from '../public/lol-mod-renderer.js';

test('renderer reports game draws rather than heartbeat FPS and stops reporting on revoke',()=>{
 const reports=[],queue=new Map();let serial=0;
 class GL{shaderSource(){}compileShader(){}linkProgram(){}getUniformLocation(){}uniform4fv(){}drawElements(){}useProgram(){}uniform1i(){}uniform1f(){}}
 const canvas={isConnected:true},doc={hidden:false,pointerLockElement:canvas,addEventListener(){},removeEventListener(){}};
 const win={document:doc,WebGL2RenderingContext:GL,requestAnimationFrame(fn){queue.set(++serial,fn);return serial;},cancelAnimationFrame(id){queue.delete(id);}};
 const renderer=installLolRenderer({win,cameraFactory:null,notify:(status,sample)=>reports.push({status,sample})}),gl=new GL();gl.canvas=canvas;
 function tick(now,draw){if(draw)gl.drawElements(4,30,2,0);const pending=[...queue.values()];queue.clear();for(const fn of pending)fn(now);}
 tick(0,false);for(let i=1;i<=60;i++)tick(i*1000/60,i%2===0);
 assert.deepEqual(reports.find(r=>r.status==='telemetry').sample,{fps:30,frameMs:33.3,paused:false});
 tick(2000,false);assert.equal(reports.at(-1).sample.paused,true);
 renderer.revoke();const count=reports.length;tick(3000,true);assert.equal(reports.length,count);assert.equal(queue.size,0);
});

test('FPS counts rendered intervals, reports idle, and excludes hidden or suspended time',()=>{
 const meter=createGameFrameMeter();assert.equal(meter.sample(0,true),null);
 let reading;for(let i=1;i<=60;i++)reading=meter.sample(i*1000/60,true);
 assert.deepEqual(reading,{fps:60,frameMs:16.7,paused:false});
 for(let i=1;i<=60;i++)reading=meter.sample(1000+i*1000/60,i%2===0);
 assert.deepEqual(reading,{fps:30,frameMs:33.3,paused:false});
 assert.deepEqual(meter.sample(3000,false),{fps:0,frameMs:0,paused:true});
 assert.equal(meter.sample(4000,true,true),null);assert.equal(meter.sample(5000,true),null);
 assert.equal(meter.sample(50000,true),null);assert.equal(meter.sample(49900,true),null);
 assert.equal(meter.sample(NaN,true),null);
});

test('native connection details reach the owner telemetry without accepting invalid adapter data',()=>{
 const reports=[],queue=[],controls={phase:'pointer',targets:0,visible:0,shotStaged:false,lastPlay:{phase:'type-waiting',targets:0,visible:0,shotStaged:false}};
 class GL{shaderSource(){}compileShader(){}linkProgram(){}getUniformLocation(){}uniform4fv(){}drawElements(){}useProgram(){}uniform1i(){}uniform1f(){}}
 const win={document:{hidden:false},WebGL2RenderingContext:GL,requestAnimationFrame(fn){queue.push(fn);},cancelAnimationFrame(){}};
 const renderer=installLolRenderer({win,gameId:'581',notify:(status,sample)=>reports.push({status,sample}),cameraFactory:()=>({step:()=>[],diagnostics:()=>controls,reset(){},revoke(){}})});
 queue.shift()(0);queue.shift()(1000);assert.deepEqual(reports.at(-1).sample.controls,controls);
 controls.lastPlay.phase='forged';queue.shift()(2000);assert.equal(reports.at(-1).sample.controls,undefined);renderer.revoke();
});
test('telemetry values are bounded and appearance migration preserves old profiles and bindings',()=>{
 assert.equal(validFrameSample({fps:120,frameMs:8.3,paused:false}),true);
 const sample={fps:60,frameMs:16.7,paused:false},controls={phase:'active',targets:2,visible:1,shotStaged:true};assert.equal(validFrameSample({...sample,controls}),true);
 for(const patch of [{phase:'<script>'},{targets:513},{targets:-1},{visible:3},{visible:NaN},{shotStaged:1}])assert.equal(validFrameSample({...sample,controls:{...controls,...patch}}),false);
 for(const sample of [null,{fps:NaN,frameMs:8,paused:false},{fps:60,frameMs:Infinity,paused:false},{fps:60,frameMs:8,paused:'false'},{fps:1001,frameMs:8,paused:false}])assert.equal(validFrameSample(sample),false);
 assert.deepEqual(normalizeMenuAppearance({theme:'url(evil)',opacity:NaN}),{theme:'midnight',opacity:96,monitor:true});
 const data=new Map([['neon-owner-workspace-v1:581',JSON.stringify({version:1,workspace:{profiles:[{id:'p-arena',name:'Arena',settings:{silent:true}}],keybinds:{menu:'F2'}}})],['game-save','untouched']]);
 const store=createControlWorkspace({localStorage:{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}}),old=store.load('581');
 assert.equal(old.profiles[0].name,'Arena');assert.equal(old.keybinds.menu,'F2');assert.equal(old.appearance.theme,'midnight');
 store.save('581',{...old,appearance:{theme:'arctic',opacity:70,monitor:false}});
 assert.deepEqual(store.load('581').appearance,{theme:'arctic',opacity:70,monitor:false});assert.equal(store.load('58').appearance.theme,'midnight');assert.equal(data.get('game-save'),'untouched');
});
