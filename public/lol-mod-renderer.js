// Adapted from GodlySpinxx's supplied 1v1.LOL userscript v0.6.
// Camera assistance uses separate native character adapters for each game.
// Unknown geometry must never move the camera. Visual/camera adapters do
// not edit hitboxes, game saves, accounts, or network traffic. The separate verified
// shot hook redirects only local shot rays when owners enable it.
import {createLolActorMatcher,createBuildNowActorMatcher} from './lol-actor-signatures.js';
import {createLolNativeCamera} from './lol-native-camera.js';
import {createBuildNowNativeCamera} from './buildnow-native-camera.js';
import {installLolSilentShot} from './lol-silent-shot.js';
import {createGameStretch} from './game-stretch.js';
export function installLolRenderer({win=window,notify=()=>{},gameId=null,actorMatcher=gameId==='58'?createLolActorMatcher():gameId==='581'?createBuildNowActorMatcher():null,cameraFactory=gameId==='58'?createLolNativeCamera:gameId==='581'?createBuildNowNativeCamera:null}) {
 const doc=win.document,proto=win.WebGL2RenderingContext?.prototype;
 let permitted=true,state={stretch:false,stretchAmount:125,aim:false,silent:false,silentChance:90,esp:false,wireframe:false,tracers:false,smoothing:70,fovEnabled:false,fov:75,range:30},supported=false;
 const shots=['58','581'].includes(gameId)?installLolSilentShot(win,{notify,gameId}):null;
 const camera=cameraFactory?.(win,{notify,shots})??null;
 const stretch=createGameStretch(doc,{gameId,getModule:()=>win.gameInstance?.Module});
 const patches=[],contexts=new Map(),shaders=new WeakMap(),locations=new WeakMap(),programs=new WeakMap(),buffers=new WeakMap();
 let actorReady=false,actorSeenThisFrame=false,lastProcessedFrame=null,lastEngineFrame=-Infinity,cameraRetryAt=0,cameraFailures=0,lastDrawContext=null;
 if(!proto){shots?.revoke();notify('unsupported');return;}
 const native={};for(const name of ['shaderSource','compileShader','linkProgram','getUniformLocation','uniform4fv','drawElements','useProgram','uniform1i','uniform1f'])native[name]=proto[name];
 const vertexCode='\nneonModDepth=gl_Position.z; if(neonModEnabled && neonModDepth>neonModThreshold){gl_Position.z=1.0;}\n';
 const fragmentCode=actorMatcher?'\nif(neonModEnabled && neonModDepth>neonModThreshold){SV_Target0=vec4(1.0,0.0,1.0,1.0);}\n':'\nif(neonModEnabled && neonModDepth>neonModThreshold){SV_Target0=vec4(1.0,0.0,0.0,1.0);}\n';
 function rewrite(source,vertex){
  if(!/^\s*#version\s+300\s+es\b/.test(source)||(!vertex&&!source.includes('SV_Target0')))return null;
  const match=/void\s+main\s*\([^)]*\)\s*\{/.exec(source);if(!match)return null;
  let depth=1,end=match.index+match[0].length;
  for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
  if(depth)return null;
  const declarations=`\n${vertex?'out':'in'} float neonModDepth;\nuniform bool neonModEnabled;\nuniform float neonModThreshold;\n`;
  const code=vertex?vertexCode:fragmentCode,start=match.index+match[0].length;
  const body=source.slice(start,end-1).replace(/\breturn\s*;/g,code+'return;');
  return source.slice(0,match.index)+declarations+source.slice(match.index,start)+body+code+source.slice(end-1);
 }
 function patch(object,key,handler){const original=object[key];const wrapped=new Proxy(original,{apply:handler});object[key]=wrapped;patches.push(()=>{if(object[key]===wrapped)object[key]=original;});}
 function bytesOf(source,start=0,length){
  if(ArrayBuffer.isView(source)){const size=source.BYTES_PER_ELEMENT||1,offset=start*size;return new Uint8Array(source.buffer,source.byteOffset+offset,(length===undefined?source.byteLength-offset:length*size));}
  if(source instanceof ArrayBuffer)return new Uint8Array(source);return null;
 }
 if(actorMatcher&&typeof proto.bufferData==='function'&&typeof proto.bufferSubData==='function'){
  patch(proto,'bufferData',(target,gl,args)=>{
   const result=Reflect.apply(target,gl,args);if(args[0]!==gl.ELEMENT_ARRAY_BUFFER)return result;
   const buffer=gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);if(!buffer)return result;
   const bytes=bytesOf(args[1],args[3],args[4]),size=bytes?.byteLength??(typeof args[1]==='number'?args[1]:0);
   if(size>0&&size<=4*1024*1024)buffers.set(buffer,{bytes:bytes?new Uint8Array(bytes):new Uint8Array(size),cache:new Map()});else buffers.delete(buffer);
   return result;
  });
  patch(proto,'bufferSubData',(target,gl,args)=>{
   const result=Reflect.apply(target,gl,args);if(args[0]!==gl.ELEMENT_ARRAY_BUFFER)return result;
   const record=buffers.get(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)),bytes=bytesOf(args[2],args[3],args[4]);
   if(record&&bytes&&args[1]>=0&&args[1]+bytes.byteLength<=record.bytes.length){record.bytes.set(bytes,args[1]);record.cache.clear();}
   return result;
  });
 }
 function isActor(gl,args){
  if(!actorMatcher)return false;
  const size=args[2]===gl.UNSIGNED_SHORT?2:args[2]===gl.UNSIGNED_INT?4:0,length=args[1]*size,offset=args[3];
  if(!size||!actorMatcher.acceptsLength(length))return false;
  const record=buffers.get(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING));if(!record||offset<0||offset+length>record.bytes.length)return false;
  const key=offset+':'+length;if(!record.cache.has(key))record.cache.set(key,actorMatcher.matches(record.bytes.subarray(offset,offset+length)));
  return record.cache.get(key);
 }
 patch(proto,'shaderSource',(target,gl,args)=>{
  const [shader,source]=args;const vertex=gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER;
  const modified=permitted?rewrite(source,vertex):null;
  shaders.set(shader,{source,vertex,modified:!!modified});return Reflect.apply(target,gl,[shader,modified||source]);
 });
 patch(proto,'compileShader',(target,gl,args)=>{
  const result=Reflect.apply(target,gl,args),info=shaders.get(args[0]);
  if(info?.modified&&!gl.getShaderParameter(args[0],gl.COMPILE_STATUS)){
   native.shaderSource.call(gl,args[0],info.source);native.compileShader.call(gl,args[0]);info.modified=false;notify('fallback');
  }return result;
 });
 patch(proto,'linkProgram',(target,gl,args)=>{
  const result=Reflect.apply(target,gl,args),program=args[0],attached=gl.getAttachedShaders(program)||[];
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)&&attached.some(shader=>shaders.get(shader)?.modified)){
   for(const shader of attached){const info=shaders.get(shader);if(info?.modified){native.shaderSource.call(gl,shader,info.source);native.compileShader.call(gl,shader);info.modified=false;}}
   Reflect.apply(target,gl,args);notify('fallback');
  }
  if(gl.getProgramParameter(program,gl.LINK_STATUS)){
   const paired=attached.some(shader=>shaders.get(shader)?.modified&&shaders.get(shader).vertex)&&attached.some(shader=>shaders.get(shader)?.modified&&!shaders.get(shader).vertex);
   const info={ui:false,enabled:paired?native.getUniformLocation.call(gl,program,'neonModEnabled'):null,threshold:paired?native.getUniformLocation.call(gl,program,'neonModThreshold'):null};programs.set(program,info);
   if(!contexts.has(gl))contexts.set(gl,new Set());contexts.get(gl).add(program);
   if(info.enabled!==null&&info.threshold!==null&&!supported){supported=true;notify('supported');}
  }return result;
 });
 patch(proto,'getUniformLocation',(target,gl,args)=>{
  const location=Reflect.apply(target,gl,args);if(location!==null)locations.set(location,{program:args[0],name:args[1]});return location;
 });
 patch(proto,'uniform4fv',(target,gl,args)=>{
  const location=args[0]&&locations.get(args[0]);
  if(location?.name==='hlslcc_mtx4x4unity_ObjectToWorld'){const info=programs.get(location.program);if(info)info.ui=true;}
  return Reflect.apply(target,gl,args);
 });
 function reset(){
  state={stretch:false,stretchAmount:125,aim:false,silent:false,silentChance:90,esp:false,wireframe:false,tracers:false,smoothing:70,fovEnabled:false,fov:75,range:30};camera?.reset();stretch.reset();
  targets=[];tracked=null;motion=createLolMotion();lastScan=-Infinity;lastFrame=null;
  if(overlay)overlay.hidden=true;
  for(const [gl,list] of contexts){if(gl.isContextLost())continue;const current=gl.getParameter(gl.CURRENT_PROGRAM);
   for(const program of list){const info=programs.get(program);if(info?.enabled!==null&&gl.isProgram(program)){native.useProgram.call(gl,program);native.uniform1i.call(gl,info.enabled,0);}}
   native.useProgram.call(gl,current);
  }
 }
 patch(proto,'drawElements',(target,gl,args)=>{
  lastDrawContext=gl;
  if(!permitted||(!state.esp&&!state.wireframe&&(!state.tracers||camera)))return Reflect.apply(target,gl,args);
  const program=gl.getParameter(gl.CURRENT_PROGRAM),info=program&&programs.get(program);
  if(info){
   const verified=actorMatcher&&isActor(gl,args),candidate=actorMatcher?verified:args[1]>4000&&!info.ui;
   if(verified&&info.enabled!==null){actorSeenThisFrame=true;if(!actorReady){actorReady=true;notify('actor-ready');}}
   if(info.enabled!==null)native.uniform1i.call(gl,info.enabled,Number((state.esp||(!camera&&state.tracers))&&candidate));
   if(info.threshold!==null)native.uniform1f.call(gl,info.threshold,4.5);
   if(state.wireframe&&!info.ui&&args[1]>6)args=[gl.LINES,...args.slice(1)];
  }return Reflect.apply(target,gl,args);
 });
 // One reusable GPU read at most 25 times/second, rather than allocating and
 // reading pixels again for every potential-player draw call.
 let lastScan=-Infinity,lastFrame=null,pixels=null,targets=[],tracked=null,motion=createLolMotion(),overlay=null;
 function clearTracking(){if(targets.length||tracked)motion=createLolMotion();targets=[];tracked=null;if(overlay)overlay.hidden=true;}
 function paintTracers(canvas){
  if(!state.tracers||!targets.length){if(overlay)overlay.hidden=true;return;}
  if(!overlay||overlay.isConnected===false){overlay?.remove();overlay=doc.createElement('canvas');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;';doc.body.append(overlay);}
  const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1){overlay.hidden=true;return;}
  const width=Math.round(rect.width),height=Math.round(rect.height);
  if(overlay.width!==width)overlay.width=width;if(overlay.height!==height)overlay.height=height;
  overlay.style.left=rect.left+'px';overlay.style.top=rect.top+'px';overlay.style.width=rect.width+'px';overlay.style.height=rect.height+'px';overlay.hidden=false;
  const context=overlay.getContext('2d');if(!context)return;
  context.clearRect(0,0,width,height);context.lineWidth=1.3;context.strokeStyle='#82e9ffc4';
  for(const point of targets.slice(0,8)){
   const x=width/2+point.x*width/glSize(canvas,'width'),y=height/2+point.y*height/glSize(canvas,'height');
   context.beginPath();context.moveTo(width/2,height-14);context.lineTo(x,y);context.stroke();context.beginPath();context.arc(x,y,4,0,Math.PI*2);context.stroke();
  }
 }
 function glSize(canvas,axis){return Math.max(1,axis==='width'?canvas.width:canvas.height);}
 function aim(now){
  if(now===lastProcessedFrame)return;lastProcessedFrame=now;
  const elapsed=lastFrame===null?0:Math.max(0,Math.min(50,now-lastFrame));lastFrame=now;
  if(camera&&permitted){
   if(now<cameraRetryAt){clearTracking();return;}
   const available=gl=>gl?.canvas?.isConnected&&!gl.isContextLost();
   const gl=available(lastDrawContext)?lastDrawContext:[...contexts.keys()].reverse().find(available),canvas=gl?.canvas;stretch.step(canvas);
   targets=camera.step({now,elapsed,aim:state.aim,tracers:state.tracers,silent:state.silent,silentChance:state.silentChance,smoothing:state.smoothing,range:state.range,fov:state.fovEnabled?state.fov:null,canvas});
   cameraRetryAt=0;cameraFailures=0;if(canvas)paintTracers(canvas);actorSeenThisFrame=false;return;
  }
  if(!permitted||(!state.aim&&!state.tracers)||!supported||doc.hidden||(doc.hasFocus&& !doc.hasFocus())){actorSeenThisFrame=false;clearTracking();return;}
  let active=false;
  for(const [gl] of contexts){
   const canvas=gl.canvas;if(!canvas.isConnected||gl.isContextLost()||!(doc.pointerLockElement===canvas||canvas.style.cursor==='none'))continue;
   active=true;
   const size=Math.min(actorMatcher?320:144,gl.drawingBufferWidth,gl.drawingBufferHeight);if(size<1)continue;
   if(now-lastScan>=40){
    lastScan=now;
    if(!pixels||pixels.length!==size*size*4)pixels=new Uint8Array(size*size*4);
    const x=Math.floor((gl.drawingBufferWidth-size)/2),y=Math.floor((gl.drawingBufferHeight-size)/2);
    if(gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null){clearTracking();break;}
    const pack=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);if(pack)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    try{gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);}finally{if(pack)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);}
    targets=actorMatcher&&!actorSeenThisFrame?[]:detectLolTargets(pixels,size,actorMatcher?'magenta':'red');const selected=selectLolTarget(targets,tracked);
    if(!selected)motion=createLolMotion();tracked=selected;
   }
   paintTracers(canvas);
   break;
  }
  actorSeenThisFrame=false;
  if(!active)clearTracking();
 }
 function runAim(now){try{aim(now);}catch(error){cameraFailures++;cameraRetryAt=now+Math.min(2000,250*2**Math.min(3,cameraFailures-1));if(cameraFailures===1){win.console?.warn('Neon camera reconnecting:',error);notify('aim-error');}try{camera?.reset();}catch{}clearTracking();}}
 const schedule=win.requestAnimationFrame;
 patch(win,'requestAnimationFrame',(target,receiver,args)=>{
  const callback=args[0];if(typeof callback!=='function')return Reflect.apply(target,receiver,args);
  return Reflect.apply(target,receiver,[function(now){try{return callback.call(this,now);}finally{lastEngineFrame=now;runAim(now);}}]);
 });
 // Use the engine's completed frame normally; continue independently if its
 // round transition replaces the animation callback with a cached scheduler.
 const cancel=win.cancelAnimationFrame;let heartbeat;
 function pulse(now){if(!permitted)return;if(now-lastEngineFrame>40)runAim(now);heartbeat=schedule.call(win,pulse);}
 if(camera)heartbeat=schedule.call(win,pulse);
 const shortcut=event=>{if(!permitted||event.repeat||event.ctrlKey||event.altKey||event.metaKey||!(event.code==='Tab'||event.key==='Tab')||event.target?.closest?.('input,textarea,select,button,[contenteditable=true]'))return;event.preventDefault();event.stopImmediatePropagation();doc.exitPointerLock?.();notify('toggle-menu');};
 doc.addEventListener?.('keydown',shortcut,true);
 notify('installed');
 return {
  settings(next){if(!permitted)return;stretch.settings(next);for(const key of ['esp','wireframe','tracers'])state[key]=next?.[key]===true;state.aim=!!camera&&next?.aim===true;state.silent=!!shots&&next?.silent===true;state.silentChance=Number.isFinite(next?.silentChance)?Math.min(100,Math.max(1,Math.round(next.silentChance))):90;if(state.silent)state.aim=false;else shots?.clear();state.range=Number.isFinite(next?.range)?Math.max(5,Math.min(60,next.range)):30;state.fovEnabled=!!camera&&next?.fovEnabled===true;state.fov=Number.isFinite(next?.fov)?Math.max(40,Math.min(110,next.fov)):75;state.smoothing=Number.isFinite(next?.smoothing)?Math.min(100,Math.max(1,next.smoothing)):70;if(!state.aim&&!state.tracers)clearTracking();},
  revoke(){if(!permitted)return;permitted=false;if(heartbeat!==undefined)cancel?.call(win,heartbeat);doc.removeEventListener?.('keydown',shortcut,true);reset();camera?.revoke();shots?.revoke();stretch.revoke();overlay?.remove();overlay=null;patches.reverse().forEach(restore=>restore());notify('revoked');}
 };
}

// Conservative screen-space components, not game entities. These bounds reject
// tiny pixels and broad surfaces but cannot prove that a shape is a character.
export function detectLolTargets(pixels,size,marker='red'){
 const seen=new Uint8Array(size*size),queue=new Int32Array(size*size),targets=[];
 const marked=p=>pixels[p*4]===255&&pixels[p*4+1]===0&&pixels[p*4+2]===(marker==='magenta'?255:0)&&pixels[p*4+3]===255;
 for(let p=0;p<seen.length;p++){
  if(seen[p]||!marked(p))continue;
  let head=0,tail=1,count=0,sx=0,sy=0,minX=size,minY=size,maxX=0,maxY=0;queue[0]=p;seen[p]=1;
  while(head<tail){
   const at=queue[head++],x=at%size,y=Math.floor(at/size);count++;sx+=x;sy+=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const next of [x>0?at-1:-1,x<size-1?at+1:-1,y>0?at-size:-1,y<size-1?at+size:-1])if(next>=0&&!seen[next]&&marked(next)){seen[next]=1;queue[tail++]=next;}
  }
  const width=maxX-minX+1,height=maxY-minY+1;
  if(count<8||count>size*size*.3||width>size*.55||height<4||width>height*1.8||minX===0||maxX===size-1||minY===0||maxY===size-1)continue;
  targets.push({x:sx/count-size/2,y:marker==='magenta'?size/2-(maxY-Math.max(1,height*.22)):size/2-sy/count,count});
 }
 return targets.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
}
export function selectLolTarget(targets,previous){
 if(!targets.length)return null;
 if(previous){const nearest=[...targets].sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y))[0];if(Math.hypot(nearest.x-previous.x,nearest.y-previous.y)<24)return nearest;}
 return targets[0];
}
export function createLolMotion(){
 let vx=0,vy=0;
 return {step(target,elapsed,smoothing=70){
  if(!target||Math.hypot(target.x,target.y)<=2){vx=vy=0;return {x:0,y:0};}
  const dt=Math.max(0,Math.min(50,elapsed))/1000,tau=.015+Math.min(100,Math.max(1,smoothing))*.0009,alpha=1-Math.exp(-dt/tau);
  const cap=Math.min(1,720/Math.max(1,Math.hypot(target.x,target.y)*7.5)),tx=target.x*7.5*cap,ty=target.y*7.5*cap;
  const delta={x:tx*dt+(vx-tx)*tau*alpha,y:ty*dt+(vy-ty)*tau*alpha};vx+=(tx-vx)*alpha;vy+=(ty-vy)*alpha;return delta;
 }};
}
