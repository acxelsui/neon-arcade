import test from 'node:test';
import assert from 'node:assert/strict';
import {createLolNativeCamera,anglesToTarget,smoothCameraAngles,angleDelta} from '../public/lol-native-camera.js';
test('world coordinates produce upward camera pitch and shortest yaw turns',()=>{
 assert.ok(anglesToTarget([0,0,0],[0,2,10]).pitch<0);
 assert.ok(anglesToTarget([0,0,0],[0,-2,10]).pitch>0);
 assert.equal(anglesToTarget([0,0,0],[10,0,0]).yaw,90);
 assert.equal(angleDelta(179,-179),2);assert.equal(angleDelta(-179,179),-2);
 assert.equal(anglesToTarget([1,2,3],[1,2,3]),null);
 for(const fps of [30,60,120]){let current={yaw:179,pitch:0};for(let i=0;i<fps;i++)current=smoothCameraAngles(current,{yaw:-170,pitch:-20},1000/fps,70);assert.ok(Math.abs(current.pitch+20)<.05);assert.ok(Math.abs(angleDelta(current.yaw,-170))<.05);}
 const limited=smoothCameraAngles({yaw:0,pitch:0},{yaw:180,pitch:90},50,1);assert.ok(Math.hypot(limited.yaw,limited.pitch)<=12.001);
});
function fixture(shots=null){
 const buffer=new ArrayBuffer(8*1024*1024),m={HEAPU8:new Uint8Array(buffer),HEAPU32:new Uint32Array(buffer),HEAP32:new Int32Array(buffer),HEAPF32:new Float32Array(buffer)},reports=[],positions=new Map();let address=6_000_000,freed=0,fov=60;
 const u=(p,v)=>m.HEAPU32[p>>>2]=v,f=(p,v)=>m.HEAPF32[p>>>2]=v;
 const klass=name=>{const p=address;address+=128;const str=address;address+=128;u(p+8,str);m.HEAPU8.set(new TextEncoder().encode(name),str);return p;};
 const object=(p,name)=>{u(p,klass(name));u(p+8,1);return p;};
 const game=object(10000,'GameManager'),third=object(11000,'vThirdPersonCamera'),manager=object(12000,'CameraManager'),camera=object(13000,'Camera'),local=object(14000,'PlayerController'),head=object(15000,'Transform'),enemy=object(16000,'PlayerController'),team=object(17000,'PlayerController'),dead=object(18000,'PlayerController'),scenery=object(19000,'GameObject'),enemyHead=object(20000,'Transform');
 const gameClass=m.HEAPU32[game>>>2],statics=30000;u(5793604,gameClass);u(gameClass+0x5c,statics);u(statics,game);u(game+0x48,local);u(manager+0x10,camera);f(third+0x34,-70);f(third+0x38,70);f(third+0x98,0);f(third+0x9c,0);
 for(const actor of [enemy,team,dead,local]){m.HEAP32[(actor+0x64)>>>2]=100;u(actor+0xa0,enemyHead);}m.HEAPU8[dead+0x18]=1;
 const dictionary=31000,entries=32000,list=33000,teamArray=34000;u(game+0x70,dictionary);u(dictionary+12,entries);u(dictionary+16,5);u(entries+12,5);[enemy,team,dead,scenery,local].forEach((actor,i)=>u(entries+16+i*16+12,actor));u(game+0x40,list);u(list+8,teamArray);u(list+12,1);u(teamArray+12,1);u(teamArray+16,team);
 positions.set(head,[0,1,0]);positions.set(enemyHead,[1,2,10]);
 m._malloc=()=>35000;m._free=()=>freed++;
 m.dynCall_ii=id=>id===1473?third:id===1506?manager:camera;
 m.dynCall_iii=()=>head;
 m.dynCall_viii=(id,transform,out)=>{assert.equal(id,9008);m.HEAPF32.set(positions.get(transform),out>>>2);};
 m.dynCall_viiiii=(id,camera,pos,eye,out)=>{assert.equal(id,1024);assert.equal(eye,2);m.HEAPF32.set([510,290,10],out>>>2);};
 m.dynCall_fii=()=>fov;m.dynCall_vifi=(id,camera,value)=>{assert.equal(id,243);fov=value;};
 const canvas={width:1000,height:600,style:{cursor:'none'}},doc={hidden:false,hasFocus:()=>true,pointerLockElement:canvas};
 const win={gameInstance:{Module:m},document:doc},bridge=createLolNativeCamera(win,{notify:s=>reports.push(s),shots});
 const step=(extra={})=>bridge.step({now:100,elapsed:16,aim:true,canvas,...extra});
 return {bridge,step,m,reports,u,f,object,game,third,local,enemy,team,dead,enemyHead,positions,canvas,doc,statics,get fov(){return fov;},get freed(){return freed;}};
}
test('native lock selects living enemy heads without synthetic input and recovers after death',()=>{
 const x=fixture(),before=x.m.HEAPU8.slice(),points=x.step();assert.equal(points.length,1);assert.equal(points[0].id,x.enemy);assert.ok(x.m.HEAPF32[(x.third+0x98)>>>2]<0,'target above camera moves upward');assert.ok(x.m.HEAPF32[(x.third+0x9c)>>>2]>0);assert.deepEqual(x.reports,['camera-ready','tracking-active']);
 for(let i=0;i<before.length;i++)if(x.m.HEAPU8[i]!==before[i])assert.ok((i>=x.third+0x98&&i<x.third+0xa0)||(i>=35000&&i<35048),'writes only camera angles and allocated scratch');
 x.m.HEAPU8[x.local+0x18]=1;const pitch=x.m.HEAPF32[(x.third+0x98)>>>2];assert.deepEqual(x.step({now:200}),[]);assert.equal(x.m.HEAPF32[(x.third+0x98)>>>2],pitch);
 x.m.HEAPU8[x.local+0x18]=0;assert.equal(x.step({now:300}).length,1);
 x.m.HEAPU8[x.enemy+0x18]=1;assert.equal(x.step({now:400}).length,0);
 x.bridge.revoke();assert.equal(x.freed,1);assert.deepEqual(x.step(),[]);
});
test('invalid builds, menus, loss of focus and out-of-range actors never rotate the camera',()=>{
 const x=fixture();x.doc.hidden=true;assert.deepEqual(x.step(),[]);assert.equal(x.m.HEAPF32[(x.third+0x98)>>>2],0);x.doc.hidden=false;
 x.m.HEAPU8[x.statics+8]=1;assert.deepEqual(x.step(),[]);x.m.HEAPU8[x.statics+8]=0;
 x.positions.set(x.enemyHead,[0,2,-10]);assert.deepEqual(x.step(),[]);
 x.u(5793604,0);assert.deepEqual(x.step(),[]);assert.equal(x.m.HEAPF32[(x.third+0x98)>>>2],0);
});
test('custom camera FOV is bounded and restored when disabled or owner access ends',()=>{
 const x=fixture();x.step({aim:false,fov:130});assert.equal(x.fov,110);x.step({aim:false,fov:null});assert.equal(x.fov,60);x.step({aim:false,fov:80});assert.equal(x.fov,80);x.bridge.revoke();assert.equal(x.fov,60);
});


test('target lock remains stable when another character crosses, then switches after target death',()=>{
 const x=fixture();x.step();const chosen=x.enemy;
 x.m.HEAPU8[x.team+0x18]=0;
 const dictionary=x.m.HEAPU32[(x.game+0x70)>>>2],entries=x.m.HEAPU32[(dictionary+12)>>>2];
 // Replace scenery with a second enemy and remove it from the team list.
 x.u(entries+16+3*16+12,x.team);x.u(x.game+0x40,0);
 const otherHead=22000;x.u(otherHead,x.m.HEAPU32[x.enemyHead>>>2]);x.u(otherHead+8,1);x.u(x.team+0xa0,otherHead);x.positions.set(otherHead,[0,1,10]);
 let points=x.step({now:200});assert.equal(points.length,2);assert.equal(x.reports.filter(s=>s==='tracking-active').length,1);
 // A closer competitor must not drag the existing lock toward a different head.
 assert.ok(x.m.HEAPF32[(x.third+0x9c)>>>2]>0);
 x.m.HEAPU8[chosen+0x18]=1;points=x.step({now:300});assert.equal(points.length,1);assert.equal(points[0].id,x.team);
});
test('a new 1v1 round reacquires the replacement local character, enemies and shot component without toggles',()=>{
 const staged=[];let resets=0;const x=fixture({clear(){},reset(){resets++;},update(m,state){staged.push(state);}});
 const oldWeapon=x.object(45000,'PlayerShooting');x.u(x.local+0x20,oldWeapon);assert.equal(x.step({aim:false,tracers:true,silent:true}).length,1);assert.equal(staged.at(-1).shooting,oldWeapon);
 x.u(x.game+0x48,0);assert.deepEqual(x.step({now:108,aim:false,tracers:true,silent:true}),[]);
 const local=x.object(46000,'PlayerController'),enemy=x.object(47000,'PlayerController'),head=x.object(48000,'Transform'),weapon=x.object(49000,'PlayerShooting');x.u(local+0x20,weapon);x.u(enemy+0xa0,head);x.m.HEAP32[(enemy+0x64)>>>2]=100;x.positions.set(head,[0,2,10]);x.u(x.game+0x48,local);x.u(x.enemy+8,0);
 const dictionary=x.m.HEAPU32[(x.game+0x70)>>>2],entries=x.m.HEAPU32[(dictionary+12)>>>2];x.u(entries+16+12,enemy);
 const points=x.step({now:116,aim:false,tracers:true,silent:true,silentChance:93});assert.equal(points[0].id,enemy);assert.equal(staged.at(-1).shooting,weapon);assert.equal(staged.at(-1).actor,enemy);assert.equal(staged.at(-1).chance,93);assert.equal(x.reports.filter(s=>s==='camera-ready').length,2);assert.ok(resets>=2);
});
