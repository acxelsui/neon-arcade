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
 m.dynCall_iii=(id,p)=>{if(id===8454)return 0;if(id===105142){assert.equal(p,m.HEAPU32[local>>>2]+16);return type;}assert.equal(id,3579);return cameraTransform;};
 m.dynCall_iiiii=(id,p,t)=>{assert.equal(id,67782);assert.equal(t,type);return parents.get(p)||0;};
 m.dynCall_viii=(id,t,out)=>{assert.equal(id,68260);m.HEAPF32.set(positions.get(t),out>>>2);};
 m.dynCall_viiiii=(id,c,pos,eye,out)=>{assert.equal(id,65969);assert.equal(eye,2);m.HEAPF32.set([510,290,10],out>>>2);};
 m.dynCall_fii=id=>{assert.equal(id,6012);return fov;};m.dynCall_vifi=(id,c,value)=>{assert.equal(id,65864);fov=value;};
 const canvas={width:1000,height:600,style:{cursor:'none'}},doc={hidden:false,hasFocus:()=>true,pointerLockElement:canvas},win={gameInstance:{Module:m},document:doc},bridge=createBuildNowNativeCamera(win,{notify:s=>reports.push(s),shots});
 const step=(extra={})=>bridge.step({now:100,elapsed:16,aim:true,canvas,...extra});
 return {m,u,f,object,game,controller,local,enemy,team,dead,helper,teamHelper,positions,enemyHead,doc,bridge,step,reports,get fov(){return fov;},get freed(){return freed;}};
}

test('failed player type lookup retries without requiring another local character class',()=>{
 const staged=[],x=fixture({clear(){},reset(){},update(m,state){staged.push(state);}}),resolve=x.m.dynCall_iii;
 let attempts=0;x.m.dynCall_iii=(id,...args)=>id===105142?(++attempts===1?0:27000):resolve(id,...args);
 assert.deepEqual(x.step({aim:false,tracers:true,silent:true}),[]);
 assert.equal(x.bridge.diagnostics().phase,'type-waiting');
 assert.equal(x.step({now:200,aim:false,tracers:true,silent:true})[0]?.id,x.enemy);
 assert.equal(x.bridge.diagnostics().phase,'weapon-waiting');assert.equal(x.bridge.diagnostics().visible,1);
 assert.equal(attempts,2);
});

test('reused round actors retry invalid reflected types and new weapons through consecutive respawns',()=>{
 const staged=[],x=fixture({clear(){},reset(){},update(m,state){staged.push(state);}}),system=x.object(52000,'WeaponsSystem'),resolve=x.m.dynCall_iii;
 x.u(x.local+0x544,system);x.u(system+0x80,x.local);let currentType=27000,attempts=0;
 x.m.dynCall_iii=(id,...args)=>id===105142?(attempts++,currentType):resolve(id,...args);
 x.m.dynCall_iiiii=(id,helper,type)=>type===currentType&&helper===x.helper?x.enemy:0;
 for(let round=0;round<4;round++){
  const weapon=x.object(60000+round*1000,'RaycastWeapon');x.u(system+0x50,weapon);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;
  const now=100+round*1200;
  assert.equal(x.step({now,aim:false,tracers:true,silent:true})[0]?.id,x.enemy);assert.equal(staged.at(-1).shooting,weapon);
  x.u(currentType,0);currentType=x.object(80000+round*1000,'RuntimeType');
  assert.equal(x.step({now:now+100,aim:false,tracers:true,silent:true})[0]?.id,x.enemy,'lookup recovers while the local class and switches are unchanged');
  assert.equal(staged.at(-1).actor,x.enemy);
  x.m.HEAPU8[x.local+0x533]=1;assert.deepEqual(x.step({now:now+116,aim:false,tracers:true,silent:true}),[]);x.m.HEAPU8[x.local+0x533]=0;
  assert.equal(x.step({now:now+132,aim:false,tracers:true,silent:true})[0]?.id,x.enemy);
 }
 assert.ok(attempts>=5);
});

test('BuildNow reports round gates and clears cached lookups on resume and explicit reconnect',()=>{
 const x=fixture(),resolve=x.m.dynCall_iii;let attempts=0;x.m.dynCall_iii=(id,...args)=>{if(id===105142)attempts++;return resolve(id,...args);};
 x.step({tracers:true});assert.equal(attempts,1);assert.equal(x.bridge.diagnostics().phase,'active');
 x.m.HEAPU8[x.local+0x533]=1;x.step({now:116,tracers:true});assert.equal(x.bridge.diagnostics().phase,'dead');
 assert.equal(x.bridge.diagnostics().lastPlay.phase,'active','opening a menu or dying retains the useful last gameplay report');
 x.m.HEAPU8[x.local+0x533]=0;x.step({now:132,tracers:true});assert.equal(attempts,2);
 x.bridge.reset();x.step({now:148,tracers:true});assert.equal(attempts,3);
 x.u(x.controller+0x10c,x.enemy);x.step({now:164,tracers:true});assert.equal(x.bridge.diagnostics().phase,'spectator');x.u(x.controller+0x10c,x.local);
 x.doc.pointerLockElement=null;x.step({now:180,tracers:true,canvas:{style:{cursor:'default'}}});assert.equal(x.bridge.diagnostics().phase,'pointer');
 x.step({now:196,tracers:true});assert.equal(attempts,4);x.doc.hidden=true;x.step({now:212,tracers:true});assert.equal(x.bridge.diagnostics().phase,'background');
 x.doc.hidden=false;x.step({now:228,aim:false,tracers:false});assert.equal(x.bridge.diagnostics().phase,'disabled');
 const report=x.bridge.diagnostics();report.phase='evil';assert.equal(x.bridge.diagnostics().phase,'disabled','returned diagnostics cannot mutate adapter state');
});

test('BuildNow recognizes active practice dummies separately, stops at death and reacquires reset targets',()=>{
 const x=fixture(),dummy=x.object(44000,'AimTarget'),health=x.object(45000,'TargetHealth'),hit=x.object(46000,'Transform'),type=x.object(47000,'RuntimeType'),str=x.object(48000,'String'),array=49000;
 x.u(dummy+0x2c,health);x.u(dummy+0x28,hit);x.positions.set(hit,[0,2,10]);x.u(array+12,1);x.u(array+16,dummy);let scans=0;
 let requested='';x.m.dynCall_iiiiii=(id,self,p,start,length)=>{assert.equal(id,11650);requested='';for(let i=0;i<length;i++)requested+=String.fromCharCode(x.m.HEAPU8[p+i*2]);return str;};
 const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>{if(id===105148)return requested==='BattleLab.AimTarget, Assembly-CSharp'?type:0;if(id===8454){if(args[0]!==type)return 0;scans++;return array;}return original(id,...args);};
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
test('BuildNow round replacement reconnects tracers and silent shots to the new local actor and weapon',()=>{
 const staged=[];let resets=0;const x=fixture({clear(){},reset(){resets++;},update(m,state){staged.push(state);}}),oldSystem=x.object(52000,'WeaponsSystem'),oldWeapon=x.object(53000,'RaycastWeapon');
 x.u(x.local+0x544,oldSystem);x.u(oldSystem+0x50,oldWeapon);x.u(oldSystem+0x80,x.local);x.u(oldWeapon+0x8c,oldSystem);x.m.HEAPU8[oldWeapon+0x9d]=1;x.step({aim:false,tracers:true,silent:true});assert.equal(staged.at(-1).shooting,oldWeapon);
 x.u(x.game+0x3c,0);assert.deepEqual(x.step({now:108,aim:false,tracers:true,silent:true}),[]);
 const local=x.object(60000,'BaseCharacterController'),enemy=x.object(62000,'BaseCharacterController'),helper=x.object(64000,'AimHelper'),head=x.object(66000,'Transform'),system=x.object(68000,'WeaponsSystem'),weapon=x.object(70000,'RaycastWeapon');
 x.u(local+0x538,40000);x.u(enemy+0x538,41000);x.u(enemy+0x170,head);x.positions.set(head,[0,2,10]);x.u(local+0x544,system);x.u(system+0x50,weapon);x.u(system+0x80,local);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;x.u(x.game+0x3c,local);x.u(x.controller+0x10c,local);x.u(x.enemy+8,0);x.u(30000+12,1);x.u(31000+16,helper);
 const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>id===105142?27000:original(id,...args);x.m.dynCall_iiiii=()=>enemy;
 const points=x.step({now:116,aim:false,tracers:true,silent:true,silentChance:92});assert.equal(points[0].id,enemy);assert.equal(staged.at(-1).shooting,weapon);assert.equal(staged.at(-1).actor,enemy);assert.equal(staged.at(-1).chance,92);assert.equal(x.reports.filter(s=>s==='camera-ready').length,2);assert.ok(resets>=2);
});


test('Zone Wars resumes reused actors/camera and reconnects player detection while the built-in assist registry is empty',()=>{
 const staged=[];let resets=0,scans=0;const x=fixture({clear(){},reset(){resets++;},update(m,state){staged.push(state);}}),system=x.object(52000,'WeaponsSystem'),weapon=x.object(53000,'RaycastWeapon'),array=60000;
 x.u(x.local+0x544,system);x.u(system+0x50,weapon);x.u(system+0x80,x.local);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;
 const step=now=>x.step({now,aim:false,tracers:true,silent:true});assert.equal(step(100)[0].id,x.enemy);
 const canvas=x.doc.pointerLockElement;x.doc.pointerLockElement=null;canvas.style.cursor='default';assert.deepEqual(step(116),[]);const paused=resets;step(132);assert.equal(resets,paused,'reset only on transition, not every paused frame');
 x.u(30000+12,0);x.u(x.enemy+0x4f0,x.helper);x.u(array+12,1);x.u(array+16,x.enemy);
 const method=x.m.dynCall_iii;x.m.dynCall_iii=(id,p,...args)=>{if(id===8454){scans++;assert.equal(p,27000);return array;}return method(id,p,...args);};
 x.doc.pointerLockElement=canvas;assert.equal(step(140)[0].id,x.enemy);assert.equal(staged.at(-1).actor,x.enemy);assert.equal(staged.at(-1).shooting,weapon);assert.equal(x.reports.filter(s=>s==='camera-ready').length,2);assert.equal(scans,1);
});

test('V Arena reacquires a replacement opponent without requiring the local character to respawn',()=>{
 const x=fixture(),array=60000,enemy=x.object(62000,'BaseCharacterController'),helper=x.object(64000,'AimHelper'),head=x.object(66000,'Transform');
 const step=now=>x.step({now,aim:false,tracers:true,silent:true});assert.equal(step(100)[0].id,x.enemy);
 x.m.HEAPU8[x.enemy+0x533]=1;x.u(30000+12,0);x.u(array+12,0);const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>id===8454?array:original(id,...args);assert.deepEqual(step(200),[]);
 x.u(enemy+0x538,41000);x.u(enemy+0x170,head);x.u(enemy+0x4f0,helper);x.positions.set(head,[0,2,10]);x.u(array+12,1);x.u(array+16,enemy);assert.equal(step(300)[0].id,enemy,'empty cached lists cannot stall new opponents for a second');
 x.m.HEAPU8[helper+0x59]=1;assert.deepEqual(step(400),[],'team guard still applies to fallback actors');
});

test('nonempty stale assist entries cannot hide repeated replacement opponents or interrupt silent-shot staging',()=>{
 const staged=[],x=fixture({clear(){},reset(){},update(m,state){staged.push(state);}}),array=60000,system=x.object(52000,'WeaponsSystem');
 x.u(x.local+0x544,system);x.u(system+0x80,x.local);x.u(x.enemy+0x4f0,x.helper);
 const original=x.m.dynCall_iii;x.m.dynCall_iii=(id,...args)=>id===8454?array:original(id,...args);
 // Keep an old registry entry whose controller/health is alive, but whose
 // old scene pivot has been destroyed. This registry never becomes empty.
 x.u(x.enemyHead+8,0);let previous=null;
 for(let round=0;round<6;round++){
  if(previous){x.m.HEAPU8[previous.health+0x99]=1;x.u(previous.actor+8,0);}
  if(round%2){x.m.HEAPU8[x.local+0x533]=1;assert.deepEqual(x.step({now:84+round*1200,aim:false,tracers:true,silent:true}),[]);x.m.HEAPU8[x.local+0x533]=0;}
  const base=80000+round*8000,actor=x.object(base,'BaseCharacterController'),helper=x.object(base+1600,'AimHelper'),head=x.object(base+2000,'Transform'),health=x.object(base+2400,'PlayerHealth'),weapon=x.object(base+2800,'RaycastWeapon');
  x.u(actor+0x538,health);x.u(actor+0x170,head);x.u(actor+0x4f0,helper);x.positions.set(head,[0,2,10]);x.u(array+12,1);x.u(array+16,actor);
  x.u(system+0x50,weapon);x.u(weapon+0x8c,system);x.m.HEAPU8[weapon+0x9d]=1;
  const points=x.step({now:100+round*1200,aim:false,tracers:true,silent:true,silentChance:91});
  assert.deepEqual(points.map(p=>p.id),[actor],`round ${round+1} uses the replacement opponent`);
  assert.equal(staged.at(-1).actor,actor);assert.equal(staged.at(-1).health,health);assert.equal(staged.at(-1).shooting,weapon);assert.equal(staged.at(-1).chance,91);
  previous={actor,health};
 }
});
