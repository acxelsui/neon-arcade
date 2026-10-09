// A single decoder keeps playing. One tail frame covers its brief loop restart.
// Pixels are copied only in the final two frames, never throughout the video.
const cleanups=new WeakMap();
export function smoothWallpaperLoop(media,{doc=globalThis.document,fps=30}={}){
 if(!doc?.createElement||!media.addEventListener)return()=>{};
 let cover,ctx,frame,raf,timer,previous=0,disposed=false,captured=false;
 function hide(){if(cover)cover.style.opacity='0';}
 function capture(){
  const width=media.videoWidth,height=media.videoHeight,layer=media.parentNode;
  if(!width||!height||!layer)return;
  if(!cover){
   const canvas=doc.createElement('canvas');ctx=canvas.getContext?.('2d',{alpha:false});if(!ctx)return;
   cover=canvas;cover.className='wallpaper-loop-cover';cover.setAttribute('aria-hidden','true');
   Object.assign(cover.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none',opacity:'0'});layer.append(cover);
  }
  if(cover.width!==width)cover.width=width;if(cover.height!==height)cover.height=height;
  try{ctx.drawImage(media,0,0,width,height);captured=true;}catch{captured=false;}
 }
 function tick(time){
  if(disposed||media.paused||!media.loop)return;
  const duration=media.duration;if(!Number.isFinite(duration)||duration<=0)return;
  if(captured&&time<previous-duration/2){
   clearTimeout(timer);if(raf!==undefined)globalThis.cancelAnimationFrame?.(raf);
   cover.style.transition='none';cover.style.opacity='1';
   // Flush the held frame before fading it over the newly decoded opening.
   void cover.offsetWidth;
   const fade=()=>{if(disposed)return;cover.style.transition='opacity 180ms linear';hide();timer=setTimeout(()=>{if(cover)cover.style.transition='';},220);};
   raf=globalThis.requestAnimationFrame?requestAnimationFrame(fade):setTimeout(fade,0);
   captured=false;
  }
  if(time>=duration-2/Math.max(24,fps)&&time<duration)capture();
  previous=time;
 }
 function next(){
  if(disposed)return;
  frame=media.requestVideoFrameCallback?.((_,info)=>{tick(info.mediaTime);next();});
 }
 function fallback(){if(!media.requestVideoFrameCallback)tick(media.currentTime);}
 const reset=()=>{previous=media.currentTime||0;captured=false;hide();};
 media.addEventListener('timeupdate',fallback);media.addEventListener('seeking',()=>{if(media.currentTime>.25)reset();});media.addEventListener('error',reset);next();
 function cleanup(){disposed=true;clearTimeout(timer);if(raf!==undefined){globalThis.cancelAnimationFrame?.(raf);clearTimeout(raf);}media.cancelVideoFrameCallback?.(frame);cover?.remove();cleanups.delete(media);}
 cleanups.set(media,cleanup);return cleanup;
}
export function releaseWallpaperLoop(media){cleanups.get(media)?.();}
