import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeTargetTracker} from '../public/native-target-tracking.js';
import {anglesToTarget,smoothCameraAngles,angleDelta} from '../public/lol-native-camera.js';
test('bounded prediction reduces camera trailing for moving targets at 30, 60 and 120 fps',()=>{
 for(const fps of [30,60,120]){
  const tracker=createNativeTargetTracker();let plain={yaw:0,pitch:0},led={yaw:0,pitch:0},plainError=0,ledError=0;
  for(let i=0;i<fps*3;i++){
   const now=i*1000/fps,position=[now*.003,1,25],actual=anglesToTarget([0,1,0],position);tracker.observe(1,position,now);
   plain=smoothCameraAngles(plain,actual,1000/fps,70);led=smoothCameraAngles(led,anglesToTarget([0,1,0],tracker.predict(1,position,now,70)),1000/fps,70);
   if(i>=fps){plainError+=Math.abs(angleDelta(plain.yaw,actual.yaw));ledError+=Math.abs(angleDelta(led.yaw,actual.yaw));}
  }
  assert.ok(ledError<plainError*.3,`${fps} fps: prediction must materially reduce angular lag`);
 }
});
test('stops, reversals, teleports, stale samples and respawns cannot leave a ghost lead offset',()=>{
 const t=createNativeTargetTracker();t.observe(1,[0,1,10],0);t.observe(1,[.3,1,10],100);assert.ok(t.predict(1,[.3,1,10],100)[0]>.3);
 t.observe(1,[.3,1,10],160);assert.deepEqual(t.predict(1,[.3,1,10],160),[.3,1,10]);
 t.observe(1,[0,1,10],220);assert.ok(t.predict(1,[0,1,10],220)[0]<0);
 t.observe(1,[100,1,10],280);assert.deepEqual(t.predict(1,[100,1,10],280),[100,1,10]);
 t.observe(1,[100.3,1,10],340);assert.deepEqual(t.predict(1,[100.3,1,10],600),[100.3,1,10]);
 t.remove(1);assert.deepEqual(t.predict(1,[100.3,1,10],340),[100.3,1,10]);
 t.observe(2,[0,0,0],0);t.observe(2,[.3,0,0],100);t.clear();assert.deepEqual(t.predict(2,[.3,0,0],100),[.3,0,0]);
});
test('prediction stays within 65 cm, dampens vertical bob and discards invalid observations',()=>{
 const t=createNativeTargetTracker();t.observe(1,[0,0,10],0);t.observe(1,[2,1,10],100);const p=[2,1,10],predicted=t.predict(1,p,100,100);
 assert.ok(Math.hypot(...predicted.map((v,i)=>v-p[i]))<=.650001);assert.ok(predicted[1]-p[1]<.35);
 t.observe(2,[NaN,1,10],0);assert.deepEqual(t.predict(2,[0,1,10],0),[0,1,10]);
 t.prune(1000);assert.deepEqual(t.predict(1,p,100),p);
});
