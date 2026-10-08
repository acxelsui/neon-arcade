// Original 1v1.LOL 2.700 / Unity 2019.4.24f1 only. Offsets and method IDs
// come from the unchanged build's IL2CPP metadata, not rendered mesh sizes.
// The bridge never writes actor state, saves, hitboxes, or network messages.
import {createNativeTargetTracker} from './native-target-tracking.js';
export function createLolNativeCamera(win,{notify=()=>{},shots=null}={}){
 const tracker=createNativeTargetTracker();
 let disposed=false,scratch=0,module=null,ready=false,lastTarget=0,lastScan=-Infinity,candidates=[],originalFov=null,tracking=false;
 const trackingStatus=value=>{if(tracking===value)return;tracking=value;notify(value?'tracking-active':'tracking-idle');};
 const readString=(m,p)=>{if(!p||p>=m.HEAPU8.length)return '';let s='';for(let i=0;i<80&&p+i<m.HEAPU8.length;i++){const b=m.HEAPU8[p+i];if(!b)return s;s+=String.fromCharCode(b);}return '';};
 const valid=(m,p,size=8)=>Number.isInteger(p)&&p>0&&p%4===0&&p+size<=m.HEAPU8.length;
 const u=(m,p)=>valid(m,p,4)?m.HEAPU32[p>>>2]:0;
 const className=(m,p)=>valid(m,p)?readString(m,u(m,u(m,p)+8)):'';
 function runtime(){
  const m=win.gameInstance?.Module;if(!m?.HEAPU32||!m.HEAPF32||!m.dynCall_ii||!m.dynCall_viii||!m._malloc)return null;
  const klass=u(m,5793604);if(!valid(m,klass,96)||readString(m,u(m,klass+8))!=='GameManager')return null;
  const statics=u(m,klass+0x5c),game=u(m,statics);if(!valid(m,game,0xac)||className(m,game)!=='GameManager')return null;
  const third=m.dynCall_ii(1473,0),manager=m.dynCall_ii(1506,0);
  if(!valid(m,third,0xcc)||!valid(m,manager,0x3c)||className(m,third)!=='vThirdPersonCamera'||className(m,manager)!=='CameraManager')return null;
  const camera=u(m,manager+0x10),local=u(m,game+0x48);
  if(!valid(m,camera)||className(m,camera)!=='Camera'||!valid(m,local,0x118)||className(m,local)!=='PlayerController')return null;
  if(module!==m){module=m;scratch=0;originalFov=null;candidates=[];lastTarget=0;tracker.clear();}
  if(!scratch)scratch=m._malloc(48);if(!valid(m,scratch,48))return null;
  if(!ready){ready=true;notify('camera-ready');}
  return {m,game,third,camera,local,statics};
 }
 function vector(m,transform){
  if(!valid(m,transform)||className(m,transform)!=='Transform'||!u(m,transform+8))return null;
  m.dynCall_viii(9008,transform,scratch,0);const v=Array.from(m.HEAPF32.subarray(scratch>>>2,(scratch>>>2)+3));
  return v.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)?v:null;
 }
 function actorList(r){
  const {m,game,local}=r,result=new Set(),team=new Set([local]),list=u(m,game+0x40),teamArray=u(m,list+8),teamCount=u(m,list+12);
  if(valid(m,teamArray)&&teamCount<=128&&teamCount<=u(m,teamArray+12))for(let i=0;i<teamCount;i++)team.add(u(m,teamArray+16+i*4));
  for(const [collectionOffset,stride,valueOffset,countOffset] of [[0x70,16,12,16],[0x74,12,8,20]]){
   const collection=u(m,game+collectionOffset),array=u(m,collection+12),count=u(m,collection+countOffset);
   if(!valid(m,collection)||!valid(m,array,16)||count>128||count>u(m,array+12)||!valid(m,array,16+count*stride))continue;
   for(let i=0;i<count;i++){const entry=array+16+i*stride;if(m.HEAP32[entry>>>2]<0)continue;const actor=u(m,entry+valueOffset);
    if(!team.has(actor)&&valid(m,actor,0x118)&&className(m,actor)==='PlayerController'&&!m.HEAPU8[actor+0x18]&&m.HEAP32[(actor+0x64)>>>2]>0&&u(m,actor+8))result.add(actor);
   }
  }return [...result];
 }
 function restoreFov(){if(originalFov&&module){const {camera,value}=originalFov;try{if(valid(module,camera)&&className(module,camera)==='Camera')module.dynCall_vifi(243,camera,value,0);}catch{}}originalFov=null;}
 return {
  step({now,elapsed,aim=false,tracers=false,silent=false,silentChance=90,smoothing=70,range=30,fov=null,canvas}){
   shots?.clear();if(disposed)return [];const r=runtime();if(!r){lastTarget=0;candidates=[];trackingStatus(false);return [];}
   const {m,third,camera,game,local,statics}=r;const shooting=u(m,local+0x20);shots?.update(m);
   if(Number.isFinite(fov)){
    if(!originalFov||originalFov.camera!==camera){restoreFov();const value=m.dynCall_fii(340,camera,0);if(Number.isFinite(value)&&value>1&&value<179)originalFov={camera,value};}
    if(originalFov)m.dynCall_vifi(243,camera,Math.max(40,Math.min(110,fov)),0);
   }else restoreFov();
   if(!aim&&!tracers&&!silent){lastTarget=0;trackingStatus(false);return [];}
   // No camera movement in menus, death cameras, unfocused views or paused games.
   if(!canvas||win.document.hidden||(win.document.hasFocus&&!win.document.hasFocus())||!(win.document.pointerLockElement===canvas||canvas.style.cursor==='none')||m.HEAPU8[statics+8]||m.HEAPU8[game+0x99]||m.HEAPU8[local+0x18]||m.HEAPU8[third+0xc8]){lastTarget=0;tracker.clear();trackingStatus(false);return [];}
   if(now-lastScan>=100){candidates=actorList(r);lastScan=now;}
   const transform=m.dynCall_iii(13138,camera,0),origin=vector(m,transform);if(!origin)return [];
   const yaw=m.HEAPF32[(third+0x9c)>>>2],pitch=m.HEAPF32[(third+0x98)>>>2];if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return [];
   const points=[];
   for(const actor of candidates){
    if(actor===local||!valid(m,actor,0x118)||className(m,actor)!=='PlayerController'||!u(m,actor+8)||m.HEAPU8[actor+0x18]||m.HEAP32[(actor+0x64)>>>2]<=0){tracker.remove(actor);continue;}
    const position=vector(m,u(m,actor+0xa0));if(!position)continue;
    tracker.observe(actor,position,now);const desired=anglesToTarget(origin,position);if(!desired)continue;
    const error=Math.hypot(angleDelta(yaw,desired.yaw),angleDelta(pitch,desired.pitch)),limit=Math.max(5,Math.min(60,range))*(actor===lastTarget?1.15:1);if(error>limit)continue;
    m.HEAPF32.set(position,(scratch+16)>>>2);m.dynCall_viiiii(1024,camera,scratch+16,2,scratch+32,0);
    const projected=Array.from(m.HEAPF32.subarray((scratch+32)>>>2,((scratch+32)>>>2)+3));
    if(projected.some(n=>!Number.isFinite(n))||projected[2]<=0)continue;
    points.push({id:actor,position,x:projected[0]-canvas.width/2,y:canvas.height/2-projected[1],error,...desired});
   }
   tracker.prune(now);points.sort((a,b)=>a.error-b.error);const selected=points.find(p=>p.id===lastTarget)||points[0];lastTarget=selected?.id||0;
   // Hitscan redirection uses the current position of the nearest crosshair
   // target; camera-lock prediction must not move the shot ahead of it.
   const closest=points.find(p=>p.error<=Math.max(5,Math.min(60,range)));
   if(silent&&closest&&valid(m,shooting,0xb4)&&className(m,shooting)==='PlayerShooting')shots?.update(m,{enabled:true,shooting,actor:closest.id,point:closest.position,chance:silentChance});
   trackingStatus(aim&&!!selected);
   if(aim&&selected){const desired=anglesToTarget(origin,tracker.predict(selected.id,selected.position,now,smoothing))||selected,next=smoothCameraAngles({yaw,pitch},desired,elapsed,smoothing);m.HEAPF32[(third+0x98)>>>2]=Math.max(m.HEAPF32[(third+0x34)>>>2],Math.min(m.HEAPF32[(third+0x38)>>>2],next.pitch));m.HEAPF32[(third+0x9c)>>>2]=next.yaw;}
   return points;
  },
  reset(){shots?.clear();lastTarget=0;candidates=[];lastScan=-Infinity;tracker.clear();trackingStatus(false);restoreFov();},
  revoke(){shots?.clear();disposed=true;tracker.clear();trackingStatus(false);restoreFov();if(module&&scratch)try{module._free(scratch);}catch{}scratch=0;candidates=[];}
 };
}
export function angleDelta(from,to){return ((to-from+180)%360+360)%360-180;}
export function anglesToTarget(origin,target){const [x,y,z]=target.map((n,i)=>n-origin[i]),horizontal=Math.hypot(x,z);if(![x,y,z].every(Number.isFinite)||Math.hypot(horizontal,y)<.01)return null;return {yaw:Math.atan2(x,z)*180/Math.PI,pitch:-Math.atan2(y,horizontal)*180/Math.PI};}
export function smoothCameraAngles(current,target,elapsed,smoothing=70){const dt=Math.min(50,Math.max(0,elapsed))/1000,alpha=1-Math.exp(-dt/(.02+Math.min(100,Math.max(1,smoothing))*.002)),dx=angleDelta(current.yaw,target.yaw),dy=angleDelta(current.pitch,target.pitch),length=Math.hypot(dx,dy),factor=length<.03?0:Math.min(alpha,length?240*dt/length:0);return {yaw:current.yaw+dx*factor,pitch:current.pitch+dy*factor};}
