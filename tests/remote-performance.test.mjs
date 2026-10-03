import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteInputPump,remotePollDelay} from '../public/remote-viewer.js';

function clock(){
 let time=0,next=0;const tasks=new Map();
 return {now:()=>time,schedule:(fn,delay)=>{const id=++next;tasks.set(id,{fn,at:time+delay});return id;},cancel:id=>tasks.delete(id),async advance(delta){
  const until=time+delta;
  for(;;){const due=[...tasks].filter(([,task])=>task.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;tasks.delete(due[0]);due[1].fn();await Promise.resolve();await Promise.resolve();}
  time=until;await Promise.resolve();await Promise.resolve();
 }};
}

test('continuous pointer movement is sent during movement rather than after it stops',async()=>{
 const time=clock(),sent=[];const pump=createRemoteInputPump({...time,send:async events=>sent.push({at:time.now(),events})});
 for(let index=0;index<125;index++){pump.push({type:'move',x:index/125,y:.5});await time.advance(8);}
 assert.ok(sent.length>=15,'A continuously moving pointer must make regular progress');assert.ok(sent.length<=18,'Movement must stay bounded by the send cadence');
 assert.ok(sent[0].at<20);assert.ok(sent.some(batch=>batch.at>=400&&batch.at<=600));assert.ok(sent.every(batch=>batch.events.length===1));
 await time.advance(80);assert.equal(sent.at(-1).events[0].x,124/125);pump.clear();
});

test('a slow request coalesces movement but preserves button and keyboard transition order',async()=>{
 const time=clock(),sent=[],finish=[];const pump=createRemoteInputPump({...time,send:events=>{sent.push(events);return new Promise(resolve=>finish.push(resolve));}});
 pump.push({type:'move',x:.1,y:.1});await time.advance(1);
 for(let i=0;i<20;i++)pump.push({type:'move',x:i/20,y:.2});
 pump.push({type:'button',button:0,down:true,x:.95,y:.2});pump.push({type:'move',x:.8,y:.8});pump.push({type:'button',button:0,down:false,x:.8,y:.8});pump.push({type:'key',key:65,down:true});pump.push({type:'key',key:65,down:false});
 await time.advance(500);assert.equal(sent.length,1);finish.shift()();await time.advance(1);await time.advance(1);
 assert.deepEqual(sent[1].map(event=>event.type),['move','button','move','button','key','key']);assert.equal(sent[1][0].x,.95);assert.equal(sent[1][1].down,true);assert.equal(sent[1][3].down,false);
 finish.shift()();await time.advance(1);pump.clear();
});

test('disconnect discards queued input and an old failure cannot stop a new session',async()=>{
 const time=clock(),sent=[],finish=[];let failures=0;
 const pump=createRemoteInputPump({...time,onError:()=>failures++,send:events=>{sent.push(events);return new Promise((resolve,reject)=>finish.push({resolve,reject}));}});
 pump.push({type:'key',key:65,down:true});pump.clear();await time.advance(100);assert.equal(sent.length,0);
 pump.push({type:'move',x:.1,y:.1});await time.advance(1);pump.push({type:'key',key:65,down:false});pump.clear();
 pump.push({type:'move',x:.9,y:.9});await time.advance(1);assert.equal(sent.length,2);
 finish[0].reject(Error('Old session failed'));await time.advance(1);assert.equal(failures,0);finish[1].resolve();await time.advance(1);pump.clear();
});

test('an overflowing slow input connection releases controls instead of accumulating old actions',async()=>{
 const time=clock(),sent=[],finish=[];let paused=0;
 const pump=createRemoteInputPump({...time,onOverflow:()=>paused++,send:events=>{sent.push(events);return new Promise(resolve=>finish.push(resolve));}});
 pump.push({type:'move',x:.1,y:.1});await time.advance(1);
 for(let i=0;i<101;i++)pump.push({type:'key',key:65,down:i%2===0});
 assert.equal(paused,1);await time.advance(300);assert.equal(sent.length,1);finish.shift()();await time.advance(1);await time.advance(1);
 assert.deepEqual(sent[1],[{type:'release'}]);finish.shift()();await time.advance(1);pump.clear();
});

test('frame polling counts network time toward the cadence and never adds the old 750ms wait',()=>{
 assert.equal(remotePollDelay(1000,1050),50);assert.equal(remotePollDelay(1000,1300),25);assert.equal(remotePollDelay(1000,1000),100);
});
