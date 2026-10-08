// Adapted from GodlySpinxx's supplied 1v1.LOL userscript v0.6.
// This changes rendering and attempts mouse aiming. It does not change shots,
// hitboxes, game saves, accounts, or network traffic.
export function installLolRenderer({win=window,notify=()=>{}}) {
 const doc=win.document,proto=win.WebGL2RenderingContext?.prototype;
 let permitted=true,state={aim:false,esp:false,wireframe:false},supported=false;
 const patches=[],contexts=new Map(),shaders=new WeakMap(),locations=new WeakMap(),programs=new WeakMap();
 if(!proto){notify('unsupported');return;}
 const native={};for(const name of ['shaderSource','compileShader','linkProgram','getUniformLocation','uniform4fv','drawElements','useProgram','uniform1i','uniform1f'])native[name]=proto[name];
 const vertexCode='\nneonModDepth=gl_Position.z; if(neonModEnabled && neonModDepth>neonModThreshold){gl_Position.z=1.0;}\n';
 const fragmentCode='\nif(neonModEnabled && neonModDepth>neonModThreshold){SV_Target0=vec4(1.0,0.0,0.0,1.0);}\n';
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
  state={aim:false,esp:false,wireframe:false};
  for(const [gl,list] of contexts){if(gl.isContextLost())continue;const current=gl.getParameter(gl.CURRENT_PROGRAM);
   for(const program of list){const info=programs.get(program);if(info?.enabled!==null&&gl.isProgram(program)){native.useProgram.call(gl,program);native.uniform1i.call(gl,info.enabled,0);}}
   native.useProgram.call(gl,current);
  }
 }
 patch(proto,'drawElements',(target,gl,args)=>{
  if(!permitted||(!state.aim&&!state.esp&&!state.wireframe))return Reflect.apply(target,gl,args);
  const program=gl.getParameter(gl.CURRENT_PROGRAM),info=program&&programs.get(program);
  if(info){
   const candidate=args[1]>4000&&!info.ui;
   if(info.enabled!==null)native.uniform1i.call(gl,info.enabled,Number((state.esp||state.aim)&&candidate));
   if(info.threshold!==null)native.uniform1f.call(gl,info.threshold,4.5);
   if(state.wireframe&&!info.ui&&args[1]>6)args=[gl.LINES,...args.slice(1)];
  }return Reflect.apply(target,gl,args);
 });
 // One small GPU read at most 25 times/second, rather than the supplied script's
 // 300x300 allocation and GPU read for every potential-player draw call.
 let lastScan=0,pixels=null;
 function aim(now){
  if(!permitted||!state.aim||!supported||doc.hidden||now-lastScan<40)return;lastScan=now;
  for(const [gl] of contexts){
   const canvas=gl.canvas;if(!canvas.isConnected||gl.isContextLost()||!(doc.pointerLockElement===canvas||canvas.style.cursor==='none'))continue;
   const size=Math.min(144,gl.drawingBufferWidth,gl.drawingBufferHeight);if(size<1)continue;
   if(!pixels||pixels.length!==size*size*4)pixels=new Uint8Array(size*size*4);
   const x=Math.floor((gl.drawingBufferWidth-size)/2),y=Math.floor((gl.drawingBufferHeight-size)/2);
   if(gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null)continue;
   const pack=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);if(pack)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
   try{gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);}finally{if(pack)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);}
   let total=0,dx=0,dy=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]===255&&pixels[i+1]===0&&pixels[i+2]===0&&pixels[i+3]===255){const p=i/4;dx+=p%size-size/2;dy+=-(Math.floor(p/size)-size/2);total++;}
   if(total){const move=new win.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(move,{movementX:{value:dx*.15/total},movementY:{value:dy*.15/total}});canvas.dispatchEvent(move);}
   break;
  }
 }
 patch(win,'requestAnimationFrame',(target,receiver,args)=>{
  const callback=args[0];if(typeof callback!=='function')return Reflect.apply(target,receiver,args);
  return Reflect.apply(target,receiver,[function(now){const result=callback.call(this,now);try{aim(now);}catch{state.aim=false;notify('aim-error');}return result;}]);
 });
 notify('installed');
 return {
  settings(next){if(!permitted)return;reset();for(const key of ['aim','esp','wireframe'])state[key]=next?.[key]===true;},
  revoke(){if(!permitted)return;permitted=false;reset();patches.reverse().forEach(restore=>restore());notify('revoked');}
 };
}
