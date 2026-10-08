import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuildNowNativeCamera} from '../public/buildnow-native-camera.js';
function fixture(shots=null){
 const buffer=new ArrayBuffer(9*1024*1024),m={HEAPU8:new Uint8Array(buffer),HEAPU32:new Uint32Array(buffer),HEAPF32:new Float32Array(buffer)},reports=[],positions=new Map();let address=7200000,fov=65,freed=0;
 const u=(p,v)=>m.HEAPU32[p>>>2]=v,f=(p,v)=>m.HEAPF32[p>>>2]=v;
 const object=(p,name)=>{const klass=address;address+=128;const str=address+3;address+=128;u(p,klass);u(p+8,1);u(klass+8,str);m.HEAPU8.set(new TextEncoder().encode(name),str);return p;};
 const game=object(10000,'GameManager'),controller=object(11000,'CameraController'),local=object(12000,'BaseCharacterController'),enemy=object(14000,'BaseCharacterController'),team=object(16000,'BaseCharacterController'),dead=object(18000,'BaseCharacterController'),camera=object(20000,'Camera'),cameraTransform=object(21000,'Transform'),enemyHead=object(22000,'Transform'),helper=object(23000,'AimHelper'),teamHelper=object(24000,'AimHelper'),deadHelper=object(25000,'AimHelper'),assist=object(26000,'AimAssist'),type=object(27000,'RuntimeType');
 u(7005400,m.HEAPU32[game>>>2]);u(7001488,m.HEAPU32[controller>>>2]);u(6999896,m.HEAPU32[assist>>>2]);u(game+0x3c,local);u(controller+0x1c,camera);u(controller+0x10c,local);f(controller+0x5c,-80);f(controller+0x60,80);f(controller+0xb0,65);
 for(const [actor,health] of [[local,40000],[enemy,41000],[team,42000],[dead,43000]]){object(health,'PlayerHealth');u(actor+0x538,health);u(actor+0x170,enemyHead);}m.HEAPU8[dead+0x533]=1;m.HEAPU8[teamHelper+0x59]=1;
 const parents=new Map([[helper,enemy],[teamHelper,team],[deadHelper,dead]]),list=30000,items=31000;u(assist+0x10,list);u(list+8,items);u(list+12,3);u(items+12,3);[helper,teamHelper,deadHelper].forEach((p,i)=>u(items+16+4*i,p));
 positions.set(cameraTransform,[0,1,0]);positions.set(enemyHead,[1,2,10]);
 m._malloc=()=>32000;m._free=()=>freed++;
 m.dynCall_ii=(id)=>{assert.ok([20231,32388,29898].includes(id));return id===20231?game:id===32388?controller:assist;};
 m.dynCall_iii=(id,p)=>{if(id===105142){assert.equal(p,m.HEAPU32[local>>>2]+16);return type;}assert.equal(id,3579);return cameraTransform;};
 m.dynCall_iiiii=(id,p,t)=>{assert.equal(id,67782);assert.equal(t,type);return parents.get(p)||0;};
 m.dynCall_viii=(id,t,out)=>{assert.equal(id,68260);m.HEAPF32.set(positions.get(t),out>>>2);};
 m.dynCall_viiiii=(id,c,pos,eye,out)=>{assert.equal(id,65969);assert.equal(eye,2);m.HEAPF32.set([510,290,10],out>>>2);};
 m.dynCall_fii=id=>{assert.equal(id,6012);return fov;};m.dynCall_vifi=(id,c,value)=>{assert.equal(id,65864);fov=value;};
 const canvas={width:1000,height:600,style:{cursor:'none'}},doc={hidden:false,hasFocus:()=>true,pointerLockElement:canvas},win={gameInstance:{Module:m},document:doc},bridge=createBuildNowNativeCamera(win,{notify:s=>reports.push(s),shots});
 const step=(extra={})=>bridge.step({now:100,elapsed:16,aim:true,canvas,...extra});
 return {m,u,f,object,game,controller,local,enemy,team,dead,helper,teamHelper,positions,enemyHead,doc,bridge,step,reports,get fov(){return fov;},get freed(){return freed;}};
}

test('BuildNow recognizes active practice dummies separately, stops at death and reacquires reset targets',()=>{
 const x=fixture(),dummy=x.object(44000,'AimTarget'),health=x.object(45000,'TargetHealth'),hit=x.object(46000,'Transform'),type=x.object(47000,'RuntimeType'),str=x.object(48000,'String'),array=49000;
 x.u(dummy+0x2c,health);x.u(dummy+0x28,hit);x.positions.set(hit,[0,2,10]);x.u(array+12,1);x.u(array+16,dummy);let scans=0;
 let requested='';x.m.dynCall_iiiiii=(id,self,p,start,length)=>{assert.equal(id,11650);requested='';for(let i=0;i<length;i++)requested+=String.fromCharCode(x.m.HEAPU8[p+i*2]);return str;};
 const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>{if(id===105148)return requested==='BattleLab.AimTarget, Assembly-CSharp'?type:0;if(id===8454){scans++;return array;}return original(id,...args);};
 let points=x.step();assert.equal(points.length,2);assert.equal(points[0].id,dummy);assert.equal(points[0].kind,'dummy');assert.ok(x.m.HEAPF32[(x.controller+0x58)>>>2]<0);
 x.m.HEAPU8[health+0x99]=1;points=x.step({now:200});assert.equal(points.length,1);assert.equal(points[0].kind,'player');assert.equal(scans,1);
 x.m.HEAPU8[health+0x99]=0;points=x.step({now:1200});assert.equal(points.length,2);assert.equal(scans,2);
 x.u(dummy+8,0);assert.equal(x.step({now:1300}).length,1);
});
test('training bots use their separate health field and visible bounds; silent shots follow that same live target and stop at death',()=>{
 const staged=[],x=fixture({clear(){},update(m,state){staged.push(state);}}),bot=x.object(44000,'TrainingBotAI'),health=x.object(45000,'AIHealth'),mesh=x.object(46000,'SkinnedMeshRenderer'),type=x.object(47000,'RuntimeType'),str=x.object(48000,'String'),array=49000,system=x.object(52000,'WeaponsSystem'),weapon=x.object(53000,'RaycastWeapon');
 x.u(bot+0x40,health);x.u(bot+0x1c,mesh);x.u(array+12,1);x.u(array+16,bot);x.u(x.local+0x544,system);x.u(system+0x50,weapon);x.u(system+0x80,x.local);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;
 let requested='';x.m.dynCall_iiiiii=(id,self,p,start,length)=>{requested='';for(let i=0;i<length;i++)requested+=String.fromCharCode(x.m.HEAPU8[p+i*2]);return str;};
 const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>id===105148?(requested==='BattleLab.AI.TrainingBotAI, Assembly-CSharp'?type:0):id===8454?array:original(id,...args);
 const vector=x.m.dynCall_viii;x.m.dynCall_viii=(id,t,out,...args)=>{if(id===66517){assert.equal(t,mesh);x.m.HEAPF32.set([0,2,10,.4,1,.4],out>>>2);}else vector(id,t,out,...args);};
 const points=x.step({aim:false,silent:true});assert.equal(points[0].id,bot);assert.equal(points[0].shotKind,'training-bot');assert.deepEqual(staged.at(-1),{enabled:true,shooting:weapon,actor:bot,kind:'training-bot',health,point:[0,2,10],chance:90});
 x.step({now:200});assert.ok(x.m.HEAPF32[(x.controller+0x58)>>>2]<0,'upward target never drags pitch down');
 x.m.HEAPU8[health+0x99]=1;assert.equal(x.step({now:300}).some(p=>p.id===bot),false);x.m.HEAPU8[health+0x99]=0;assert.equal(x.step({now:1200}).some(p=>p.id===bot),true);
 x.u(mesh+8,0);assert.equal(x.step({now:1300}).some(p=>p.id===bot),false,'destroyed renderers cannot produce a ghost target');
});
test('TargetTrainer dummies lock and stage shots at the live collider center, reacquire on reset and skip invalid bounds',()=>{
 const staged=[],x=fixture({clear(){},update(m,state){staged.push(state);}}),dummy=x.object(44000,'TargetTrainer'),health=x.object(45000,'TargetHealth'),collider=x.object(46000,'BoxCollider'),type=x.object(47000,'RuntimeType'),str=x.object(48000,'String'),array=49000,system=x.object(52000,'WeaponsSystem'),weapon=x.object(53000,'RaycastWeapon');
 x.u(dummy+0x1c,health);x.u(dummy+0x14,collider);x.u(array+12,1);x.u(array+16,dummy);x.u(x.local+0x544,system);x.u(system+0x50,weapon);x.u(system+0x80,x.local);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;
 let requested='',bounds=[0,2,10,.4,1,.4];x.m.dynCall_iiiiii=(id,self,p,start,length)=>{requested='';for(let i=0;i<length;i++)requested+=String.fromCharCode(x.m.HEAPU8[p+i*2]);return str;};
 const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>id===105148?(requested==='BattleLab.TargetTrainer, Assembly-CSharp'?type:0):id===8454?array:original(id,...args);
 const vector=x.m.dynCall_viii;x.m.dynCall_viii=(id,t,out,...args)=>{if(id===72007){assert.equal(t,collider);x.m.HEAPF32.set(bounds,out>>>2);}else vector(id,t,out,...args);};
 assert.equal(x.step()[0].id,dummy);assert.ok(x.m.HEAPF32[(x.controller+0x58)>>>2]<0);
 x.step({now:200,aim:false,silent:true,silentChance:88});assert.deepEqual(staged.at(-1),{enabled:true,shooting:weapon,actor:dummy,kind:'trainer',health,point:[0,2,10],chance:88});
 x.m.HEAPU8[health+0x99]=1;assert.equal(x.step({now:300}).some(p=>p.id===dummy),false);x.m.HEAPU8[health+0x99]=0;assert.equal(x.step({now:1200}).some(p=>p.id===dummy),true);
 bounds=[0,2,10,0,0,0];assert.equal(x.step({now:1300}).some(p=>p.id===dummy),false,'disabled colliders return empty bounds');
 bounds=[NaN,2,10,1,1,1];assert.equal(x.step({now:1400}).some(p=>p.id===dummy),false,'invalid positions never steer');
});
test('Start-spawned training bots are reacquired from the live registry within the actor scan, without scene-wide reflection',()=>{
 const x=fixture(),manager=x.object(56000,'TrainingAIManager'),bot=x.object(44000,'TrainingBotAI'),health=x.object(45000,'AIHealth'),mesh=x.object(46000,'SkinnedMeshRenderer'),list=57000,items=58000;
 x.u(7016896,x.m.HEAPU32[manager>>>2]);x.u(manager+0x48,list);x.u(list+8,items);x.u(items+12,1);x.u(bot+0x40,health);x.u(bot+0x1c,mesh);
 const getter=x.m.dynCall_ii;x.m.dynCall_ii=(id,...args)=>id===32695?manager:getter(id,...args);
 const vector=x.m.dynCall_viii;x.m.dynCall_viii=(id,t,out,...args)=>{if(id===66517)x.m.HEAPF32.set([0,2,10,.4,1,.4],out>>>2);else vector(id,t,out,...args);};
 assert.equal(x.step().some(p=>p.id===bot),false);x.u(list+12,1);x.u(items+16,bot);assert.equal(x.step({now:200}).some(p=>p.id===bot),true);
 x.m.HEAPU8[health+0x99]=1;assert.equal(x.step({now:216}).some(p=>p.id===bot),false);x.m.HEAPU8[health+0x99]=0;x.u(bot+8,0);assert.equal(x.step({now:300}).some(p=>p.id===bot),false);
 x.u(7016896,0x2000edeb);x.m.dynCall_ii=(id,...args)=>{assert.notEqual(id,32695);return getter(id,...args);};assert.doesNotThrow(()=>x.step({now:400}));
});
test('BuildNow targets live non-team characters from its own registry and never pulls downward toward an elevated head',()=>{
 const x=fixture(),before=x.m.HEAPU8.slice(),points=x.step();assert.equal(points.length,1);assert.equal(points[0].id,x.enemy);assert.ok(x.m.HEAPF32[(x.controller+0x58)>>>2]<0);assert.ok(x.m.HEAPF32[(x.controller+0x54)>>>2]>0);assert.deepEqual(x.reports,['camera-ready','tracking-active']);
 for(let i=0;i<before.length;i++)if(before[i]!==x.m.HEAPU8[i])assert.ok((i>=x.controller+0x54&&i<x.controller+0x5c)||(i>=32000&&i<32048),'no actor, health, save or network writes');
 x.m.HEAPU8[x.local+0x533]=1;assert.deepEqual(x.step({now:200}),[]);x.m.HEAPU8[x.local+0x533]=0;assert.equal(x.step({now:300}).length,1);
 x.m.HEAPU8[41000+0x99]=1;assert.deepEqual(x.step({now:400}),[]);
});
test('BuildNow refuses unfamiliar builds, spectator cameras, background input and out-of-range targets',()=>{
 const x=fixture();x.u(x.controller+0x10c,x.enemy);assert.deepEqual(x.step(),[]);x.u(x.controller+0x10c,x.local);
 x.doc.hidden=true;assert.deepEqual(x.step(),[]);x.doc.hidden=false;x.positions.set(x.enemyHead,[0,2,-10]);assert.deepEqual(x.step(),[]);
 x.u(7001488,0);assert.deepEqual(x.step(),[]);assert.equal(x.m.HEAPF32[(x.controller+0x58)>>>2],0);
});
test('BuildNow FOV updates the camera default and restores both values on disable or role revocation',()=>{
 const x=fixture();x.step({aim:false,fov:150});assert.equal(x.fov,110);assert.equal(x.m.HEAPF32[(x.controller+0xb0)>>>2],110);
 x.step({aim:false,fov:null});assert.equal(x.fov,65);assert.equal(x.m.HEAPF32[(x.controller+0xb0)>>>2],65);
 x.step({aim:false,fov:90});x.bridge.revoke();assert.equal(x.fov,65);assert.equal(x.freed,1);assert.deepEqual(x.step(),[]);
});
test('exact lazy metadata tokens initialize through their getters; foreign tokens never invoke native methods',()=>{
 const x=fixture(),addresses=[7005400,7001488,6999896],classes=addresses.map(p=>x.m.HEAPU32[p>>>2]),original=x.m.dynCall_ii;
 addresses.forEach((p,i)=>x.u(p,[0x2000a1c9,0x2000846d,0x20007881][i]));
 x.m.dynCall_ii=(...args)=>{addresses.forEach((p,i)=>x.u(p,classes[i]));return original(...args);};
 assert.equal(x.step().length,1);
 const y=fixture();y.u(7005400,0x2000a1cb);y.m.dynCall_ii=()=>assert.fail('foreign metadata must never invoke a getter');assert.deepEqual(y.step(),[]);
});


test('BuildNow stages local silent shots independently from camera lock and clears on death, pause and revocation',()=>{
 const staged=[];let clears=0;const shots={clear(){clears++;},update(m,state){staged.push(state);return true;}},x=fixture(shots),system=x.object(52000,'WeaponsSystem'),weapon=x.object(53000,'RaycastWeapon');
 x.u(x.local+0x544,system);x.u(system+0x50,weapon);x.u(system+0x80,x.local);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;
 const yaw=x.m.HEAPF32[(x.controller+0x54)/4],pitch=x.m.HEAPF32[(x.controller+0x58)/4];x.step({aim:false,silent:true,silentChance:77});
 assert.deepEqual(staged.at(-1),{enabled:true,shooting:weapon,actor:x.enemy,kind:'player',health:41000,point:[1,2,10],chance:77});assert.equal(x.m.HEAPF32[(x.controller+0x54)/4],yaw);assert.equal(x.m.HEAPF32[(x.controller+0x58)/4],pitch);
 x.doc.hidden=true;x.step({aim:false,silent:true,now:200});assert.equal(staged.at(-1),undefined);x.doc.hidden=false;x.m.HEAPU8[x.local+0x533]=1;x.step({aim:false,silent:true,now:300});assert.equal(staged.at(-1),undefined);x.m.HEAPU8[x.local+0x533]=0;
 x.m.HEAPU8[weapon+0x9d]=0;x.step({aim:false,silent:true,now:400});assert.equal(staged.at(-1),undefined);x.m.HEAPU8[weapon+0x9d]=1;x.step({aim:false,silent:true,now:500});assert.equal(staged.at(-1).actor,x.enemy);x.bridge.revoke();assert.ok(clears>=6);
});
