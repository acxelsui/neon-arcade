// BuildNow.gg's unchanged Unity/IL2CPP 31 build has a different camera and
// actor layout from 1v1.LOL. Keep its verified method map separate.
// Camera angles/FOV and our scratch space are separate from the guarded shot hook.
import {anglesToTarget,angleDelta,smoothCameraAngles} from './lol-native-camera.js';
import {createNativeTargetTracker} from './native-target-tracking.js';
export function createBuildNowNativeCamera(win,{notify=()=>{},shots=null}={}){
 const tracker=createNativeTargetTracker();
 let practiceInfo={stage:'waiting',found:0,alive:0},lastPractice='';
 function practiceStatus(canvas,extra={}){const value=JSON.stringify({...practiceInfo,...extra});if(value!==lastPractice){lastPractice=value;canvas?.setAttribute?.('data-neon-training',value);}}
 let activeContext=null,playing=false,resumePending=false,lastPlayerScan=-Infinity,scenePlayers=[];
 let disposed=false,module=null,scratch=0,ready=false,tracking=false,lastTarget=0,lastScan=-Infinity,candidates=[],originalFov=null,actorType=0,localClass=0,lastDummyScan=-Infinity,dummies=[],dummyReady=false;
 const trainingTypes=[{className:'AimTarget',typeName:'BattleLab.AimTarget, Assembly-CSharp',healthOffset:0x2c,kind:'dummy'}, {className:'TrainingBotAI',typeName:'BattleLab.AI.TrainingBotAI, Assembly-CSharp',healthOffset:0x40,kind:'training-bot'}, {className:'TargetTrainer',typeName:'BattleLab.TargetTrainer, Assembly-CSharp',healthOffset:0x1c,kind:'trainer'}];
 const typeCache=new Map();
 const valid=(m,p,size=8)=>Number.isInteger(p)&&p>0&&p%4===0&&p+size<=m.HEAPU8.length;
 const u=(m,p)=>valid(m,p,4)?m.HEAPU32[p>>>2]:0;
 const text=(m,p)=>{if(!Number.isInteger(p)||p<=0||p>=m.HEAPU8.length)return '';let s='';for(let i=0;i<80&&p+i<m.HEAPU8.length;i++){const b=m.HEAPU8[p+i];if(!b)return s;s+=String.fromCharCode(b);}return '';};
 const name=(m,p)=>valid(m,p)?text(m,u(m,u(m,p)+8)):'';
 const status=value=>{if(tracking!==value){tracking=value;notify(value?'tracking-active':'tracking-idle');}};
 const call=(m,sig,id,...args)=>m['dynCall_'+sig](id,...args);
 const living=(m,actor)=>valid(m,actor,0x548)&&name(m,actor)==='BaseCharacterController'&&u(m,actor+8)&&!m.HEAPU8[actor+0x533]&&valid(m,u(m,actor+0x538),0x9b)&&!m.HEAPU8[u(m,actor+0x538)+0x99];
 const liveDummy=(m,actor,profile=trainingTypes[0])=>valid(m,actor,Math.max(0x3c,profile.healthOffset+4))&&name(m,actor)===profile.className&&u(m,actor+8)&&valid(m,u(m,actor+profile.healthOffset),0x9b)&&(profile.kind==='training-bot'?['AIHealth','TargetHealth'].includes(name(m,u(m,actor+profile.healthOffset))):name(m,u(m,actor+profile.healthOffset))==='TargetHealth')&&u(m,u(m,actor+profile.healthOffset)+8)&&!m.HEAPU8[u(m,actor+profile.healthOffset)+0x99];
 function runtime(){
  const m=win.gameInstance?.Module;if(!m?.HEAPU32||!m.HEAPF32||!m._malloc||!['ii','iii','iiiii','viii','viiiii','fii','vifi'].every(s=>typeof m['dynCall_'+s]==='function'))return null;
  // Each type starts as this exact build's encoded metadata token. Its getter
  // initializes that token into a class pointer; accept only that token or
  // the corresponding live class signature before calling native methods.
  for(const [address,expected,token] of [[7005400,'GameManager',0x2000a1c9],[7001488,'CameraController',0x2000846d],[6999896,'AimAssist',0x20007881]]){const klass=u(m,address);if(klass!==token&&(!valid(m,klass,96)||text(m,u(m,klass+8))!==expected))return null;}
  const game=call(m,'ii',20231,0),controller=call(m,'ii',32388,0);
  if(!valid(m,game,0x54)||name(m,game)!=='GameManager'||!valid(m,controller,0x158)||name(m,controller)!=='CameraController'||!u(m,game+8)||!u(m,controller+8))return null;
  const local=u(m,game+0x3c),camera=u(m,controller+0x1c);
  if(!valid(m,local,0x548)||name(m,local)!=='BaseCharacterController'||!valid(m,camera)||name(m,camera)!=='Camera'||(!u(m,camera+8)||!u(m,local+8)))return null;
  if(module!==m){module=m;activeContext=null;ready=false;scratch=0;originalFov=null;lastTarget=0;candidates=[];dummies=[];actorType=localClass=0;typeCache.clear();lastDummyScan=-Infinity;tracker.clear();}
  if(!scratch)scratch=m._malloc(256);if(!valid(m,scratch,256))return null;
  const context=[game,local,camera,controller];if(!activeContext||context.some((id,i)=>id!==activeContext[i])){activeContext=context;ready=false;lastTarget=0;lastScan=-Infinity;candidates=[];lastDummyScan=-Infinity;dummies=[];dummyReady=false;tracker.clear();shots?.reset?.();}
  if(!ready){restartRound();resumePending=false;ready=true;notify('camera-ready');}
  return {m,game,controller,local,camera};
 }
 function vector(m,transform){if(!valid(m,transform)||name(m,transform)!=='Transform'||!u(m,transform+8))return null;call(m,'viii',68260,transform,scratch,0);const v=Array.from(m.HEAPF32.subarray(scratch>>>2,(scratch>>>2)+3));return v.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)?v:null;}
 function sceneActors(m,local,now){
  if(now-lastPlayerScan<1000&&scenePlayers.some(p=>living(m,p.actor)&&u(m,p.helper+8)))return scenePlayers;lastPlayerScan=now;scenePlayers=[];
  if(!valid(m,actorType)||name(m,actorType)!=='RuntimeType')return scenePlayers;
  const array=call(m,'iii',8454,actorType,0),count=u(m,array+12);
  if(!valid(m,array,16)||count>128||!valid(m,array,16+count*4))return scenePlayers;
  for(let i=0;i<count;i++){const actor=u(m,array+16+4*i),helper=u(m,actor+0x4f0);
   if(actor!==local&&living(m,actor)&&valid(m,helper,0x5a)&&name(m,helper)==='AimHelper'&&u(m,helper+8)&&!m.HEAPU8[helper+0x59])scenePlayers.push({actor,helper});
  }return scenePlayers;
 }
 function restartRound(){playing=false;lastTarget=0;lastScan=lastDummyScan=lastPlayerScan=-Infinity;candidates=[];dummies=[];scenePlayers=[];tracker.clear();shots?.reset?.();}
 function actors({m,local}){
  const klass=u(m,local);if(localClass!==klass){localClass=klass;actorType=call(m,'iii',105142,klass+16,0);}
  if(!valid(m,actorType)||name(m,actorType)!=='RuntimeType')return [];
  const assistClass=u(m,6999896);if(assistClass!==0x20007881&&(!valid(m,assistClass,96)||text(m,u(m,assistClass+8))!=='AimAssist'))return [];
  const assist=call(m,'ii',29898,0);if(!valid(m,assist,0xb0)||name(m,assist)!=='AimAssist')return [];
  const list=u(m,assist+0x10),items=u(m,list+8),count=u(m,list+12),result=[];
  if(!valid(m,list,16)||!valid(m,items,16)||count>128||count>u(m,items+12)||!valid(m,items,16+count*4))return [];
  const seen=new Set();
  for(let i=0;i<count;i++){
   const helper=u(m,items+16+i*4);if(!valid(m,helper,0x5a)||name(m,helper)!=='AimHelper'||!u(m,helper+8)||m.HEAPU8[helper+0x59])continue;
   const actor=call(m,'iiiii',67782,helper,actorType,0,0);
   if(actor===local||seen.has(actor)||!living(m,actor))continue;
   seen.add(actor);result.push({actor,helper});
  }return result;
 }
 function trainingTargets(m,now){
  // The game's practice dummies are AimTarget/TargetHealth objects, not
  // player controllers. Resolve that exact type and scan at most once/second.
  if(now-lastDummyScan<1000)return dummies;lastDummyScan=now;dummies=[];
  practiceInfo={stage:'type lookup',found:0,alive:0};
  if(typeof m.dynCall_iiiiii!=='function'){practiceInfo.stage='string constructor unavailable';return dummies;}
  practiceInfo.types={};
  for(const profile of trainingTypes){
  let dummyType=typeCache.get(profile.kind)||0;
  if(!valid(m,dummyType)||name(m,dummyType)!=='RuntimeType'){
   const typeName=profile.typeName;
   for(let i=0;i<typeName.length;i++){m.HEAPU8[scratch+64+i*2]=typeName.charCodeAt(i);m.HEAPU8[scratch+65+i*2]=0;}
   const string=call(m,'iiiiii',11650,0,scratch+64,0,typeName.length,0);
   if(!valid(m,string)||name(m,string)!=='String'){practiceInfo.types[profile.className]='string lookup failed';continue;}
   dummyType=call(m,'iii',105148,string,0);
  }
  if(!valid(m,dummyType)||name(m,dummyType)!=='RuntimeType'){practiceInfo.types[profile.className]='type lookup failed';continue;}
  typeCache.set(profile.kind,dummyType);
  const array=call(m,'iii',8454,dummyType,0),count=u(m,array+12);
  if(!valid(m,array,16)||count>128||!valid(m,array,16+count*4)){practiceInfo.types[profile.className]='target list unavailable';continue;}
  practiceInfo.stage='scanned';practiceInfo.found+=count;practiceInfo.types[profile.className]=count;
  for(let i=0;i<count;i++){const actor=u(m,array+16+i*4);if(liveDummy(m,actor,profile))dummies.push({actor,kind:profile.kind,profile});else{practiceInfo.rejected=name(m,actor);practiceInfo.health=name(m,u(m,actor+profile.healthOffset));}}
  }
  practiceInfo.alive=dummies.length;
  if(dummies.length&&!dummyReady){dummyReady=true;notify('practice-ready');}
  return dummies;
 }
 function spawnedTrainingBots(m){
  // Start spawns and replaces these quickly. Read its live registry at the
  // normal actor scan interval instead of waiting for the scene-wide scan.
  const klass=u(m,7016896);if(klass!==0x2000ede9&&(!valid(m,klass,96)||text(m,u(m,klass+8))!=='TrainingAIManager'))return [];
  const manager=call(m,'ii',32695,0);if(!valid(m,manager,0x5c)||name(m,manager)!=='TrainingAIManager'||!u(m,manager+8))return [];
  const list=u(m,manager+0x48);if(!valid(m,list,16))return [];
  const items=u(m,list+8),count=u(m,list+12),profile=trainingTypes[1];
  if(count>128||!valid(m,items,16+count*4)||count>u(m,items+12))return [];
  const found=[];for(let i=0;i<count;i++){const actor=u(m,items+16+4*i);if(liveDummy(m,actor,profile))found.push({actor,kind:profile.kind,profile});}return found;
 }
 function trainingPosition(m,actor,profile){
  if(profile.kind==='dummy')return vector(m,u(m,actor+0x28)||call(m,'iii',3579,actor,0));
  const renderer=profile.kind==='training-bot'?u(m,actor+0x1c):u(m,actor+0x14),expected=profile.kind==='training-bot'?'SkinnedMeshRenderer':null;
  if(!valid(m,renderer)||!u(m,renderer+8)||(expected?name(m,renderer)!==expected:!['BoxCollider','SphereCollider','CapsuleCollider','MeshCollider'].includes(name(m,renderer))))return null;
  call(m,'viii',profile.kind==='training-bot'?66517:72007,renderer,scratch+160,0);
  const bounds=Array.from(m.HEAPF32.subarray((scratch+160)>>>2,((scratch+160)>>>2)+6));
  if(bounds.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)||bounds.slice(3).some(n=>n<0||n>50)||Math.max(...bounds.slice(3))<.01)return null;
  // Aim inside the actual visible collider/mesh, rather than at its foot pivot.
  return bounds.slice(0,3);
 }
 function restoreFov(){if(originalFov&&module){const {controller,camera,value,cameraValue}=originalFov;try{if(valid(module,controller,0xb4)&&name(module,controller)==='CameraController'&&u(module,controller+8))module.HEAPF32[(controller+0xb0)>>>2]=value;if(valid(module,camera)&&name(module,camera)==='Camera'&&u(module,camera+8))call(module,'vifi',65864,camera,cameraValue,0);}catch{}}originalFov=null;}
 return {
  step({now,elapsed,aim=false,tracers=false,silent=false,silentChance=90,smoothing=70,range=30,fov=null,canvas}){
   shots?.clear();if(disposed)return [];const r=runtime();if(!r){if(ready)shots?.reset?.();ready=false;activeContext=null;lastTarget=0;lastScan=lastDummyScan=-Infinity;candidates=[];dummies=[];tracker.clear();status(false);practiceStatus(canvas,{stage:'waiting for game camera'});return [];}
   const {m,controller,local,camera}=r;shots?.update(m);
   if(Number.isFinite(fov)){
    if(originalFov?.controller!==controller||originalFov?.camera!==camera){restoreFov();const value=m.HEAPF32[(controller+0xb0)>>>2],cameraValue=call(m,'fii',6012,camera,0);if([value,cameraValue].every(v=>Number.isFinite(v)&&v>1&&v<179))originalFov={controller,camera,value,cameraValue};}
    if(originalFov){const value=Math.max(40,Math.min(110,fov));m.HEAPF32[(controller+0xb0)>>>2]=value;call(m,'vifi',65864,camera,value,0);}
   }else restoreFov();
   if(!aim&&!tracers&&!silent){lastTarget=0;tracker.clear();status(false);return [];}
   if(!canvas||win.document.hidden||(win.document.hasFocus&&!win.document.hasFocus())||!(win.document.pointerLockElement===canvas||canvas.style.cursor==='none')||!living(m,local)||u(m,controller+0x10c)!==local){if(playing){restartRound();resumePending=true;}status(false);practiceStatus(canvas,{stage:'game paused'});return [];}
   if(!playing){restartRound();playing=true;if(resumePending){resumePending=false;notify('camera-ready');}shots?.update(m);}
   if(now-lastScan>=100){const seen=new Set();const registered=actors(r);candidates=[...registered,...(registered.length?[]:sceneActors(m,local,now)),...spawnedTrainingBots(m),...trainingTargets(m,now)].filter(p=>{if(seen.has(p.actor))return false;seen.add(p.actor);return true;});lastScan=now;}
   const origin=vector(m,call(m,'iii',3579,camera,0));if(!origin)return [];
   const yaw=m.HEAPF32[(controller+0x54)>>>2],pitch=m.HEAPF32[(controller+0x58)>>>2];if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return [];
   const points=[];let positionsRead=0,nearestError=180;
   for(const {actor,helper,kind,profile} of candidates){
    const dummy=!!profile;
    if(actor===local||(dummy?!liveDummy(m,actor,profile):!living(m,actor)||!valid(m,helper,0x5a)||name(m,helper)!=='AimHelper'||!u(m,helper+8)||m.HEAPU8[helper+0x59])){tracker.remove(actor);continue;}
    const position=dummy?trainingPosition(m,actor,profile):vector(m,u(m,actor+0x170));if(!position)continue;if(dummy)positionsRead++;
    tracker.observe(actor,position,now);const desired=anglesToTarget(origin,position);if(!desired)continue;
    const error=Math.hypot(angleDelta(yaw,desired.yaw),angleDelta(pitch,desired.pitch));if(dummy)nearestError=Math.min(nearestError,error);if(error>Math.max(5,Math.min(60,range))*(actor===lastTarget?1.15:1))continue;
    m.HEAPF32.set(position,(scratch+16)>>>2);call(m,'viiiii',65969,camera,scratch+16,2,scratch+32,0);
    const projected=Array.from(m.HEAPF32.subarray((scratch+32)>>>2,((scratch+32)>>>2)+3));if(projected.some(n=>!Number.isFinite(n))||projected[2]<=0)continue;
    points.push({id:actor,kind:dummy?'dummy':'player',...(dummy?{shotKind:kind}:{}),health:u(m,actor+(dummy?profile.healthOffset:0x538)),position,x:projected[0]-canvas.width/2,y:canvas.height/2-projected[1],error,...desired});
   }
   tracker.prune(now);points.sort((a,b)=>a.error-b.error);const selected=points.find(p=>p.id===lastTarget)||points[0];lastTarget=selected?.id||0;status(aim&&!!selected);
   const practiceFrame={positionsRead,nearestError:Math.round(nearestError),inRange:points.filter(p=>p.kind==='dummy').length,locked:aim&&selected?.kind==='dummy',silentStaged:false};
   if(silent){const target=points.find(p=>p.error<=Math.max(5,Math.min(60,range))),system=u(m,local+0x544),weapon=u(m,system+0x50);
    if(target&&valid(m,system,0xa0)&&name(m,system)==='WeaponsSystem'&&u(m,system+0x80)===local&&valid(m,weapon,0xcc)&&['RaycastWeapon','ShotgunWeapon'].includes(name(m,weapon))&&u(m,weapon+0x8c)===system&&m.HEAPU8[weapon+0x9d]){shots?.update(m,{enabled:true,shooting:weapon,actor:target.id,kind:target.shotKind||target.kind,health:target.health,point:target.position,chance:silentChance});practiceFrame.silentStaged=target.kind==='dummy';practiceFrame.weapon=name(m,weapon);}
   }
   practiceStatus(canvas,practiceFrame);
   if(aim&&selected){const desired=anglesToTarget(origin,tracker.predict(selected.id,selected.position,now,smoothing))||selected,next=smoothCameraAngles({yaw,pitch},desired,elapsed,smoothing),min=m.HEAPF32[(controller+0x5c)>>>2],max=m.HEAPF32[(controller+0x60)>>>2];if(Number.isFinite(min)&&Number.isFinite(max)&&min<=max){m.HEAPF32[(controller+0x54)>>>2]=next.yaw;m.HEAPF32[(controller+0x58)>>>2]=Math.max(min,Math.min(max,next.pitch));}}
   return points;
  },
  reset(){restartRound();shots?.reset?.();shots?.clear();ready=false;activeContext=null;lastTarget=0;lastScan=lastDummyScan=-Infinity;candidates=[];dummies=[];tracker.clear();status(false);restoreFov();},
  revoke(){shots?.clear();disposed=true;tracker.clear();status(false);restoreFov();if(module&&scratch)try{module._free(scratch);}catch{}scratch=0;candidates=[];}
 };
}
