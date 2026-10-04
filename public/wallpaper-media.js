import {wallpaperPreparation} from './wallpaper-preload.js';
import {wallpaperStreamUrl,createWallpaperVideo,hasWallpaperBuffer,wallpaperDropsFrames} from './wallpaper-stream.js';
let video,pending,currentUrl,epoch=0,release=[],timers=[],visible=Promise.resolve();
function canPlay(){return !document.hidden&&!document.fullscreenElement;}
function play(){if(video&&canPlay())video.play().catch(()=>{});}
function dispose(media){if(!media)return;media.pause();media.removeAttribute('src');media.load();media.remove();}
function status(text){
 let el=document.querySelector('#wallpaper-playback-status');const preparation=document.querySelector('#wallpaper-preload-status');
 if(!el&&preparation?.parentNode){el=document.createElement('p');el.id='wallpaper-playback-status';el.setAttribute('aria-live','polite');preparation.parentNode.insertBefore(el,preparation);}
 if(el)el.textContent=text;
}
function changed(){if(typeof window!=='undefined')window.dispatchEvent(new Event('neon-wallpaper-playback'));}
export function whenWallpaperVisible(timeout=200){return Promise.race([visible,new Promise(resolve=>setTimeout(resolve,timeout))]);}
export function setWallpaperMedia(url,poster=''){
 if(currentUrl===url&&!video?.error&&video?.dataset?.neonWallpaper4kFailed!=='true'){play();return;}
 const layer=document.querySelector('#wallpaper'),version=++epoch;currentUrl=url;wallpaperPreparation.select(url);
 timers.forEach(clearTimeout);timers=[];dispose(video);dispose(pending);video=pending=null;release.forEach(fn=>fn());release=[];
 let ready;visible=new Promise(resolve=>ready=resolve);
 layer.style.backgroundImage=`url(${JSON.stringify(poster||url)})`;
 if(typeof Image!=='undefined'){const image=new Image();image.fetchPriority='high';image.onload=()=>{if(version===epoch)ready();};image.onerror=()=>ready();image.src=poster||url;}
 if(poster)wallpaperPreparation.source(poster).then(source=>{if(!source)return;if(version!==epoch){source.release();return;}release.push(source.release);layer.style.backgroundImage=`url(${JSON.stringify(source.url)})`;});
 if(!/\.mp4(?:[?#]|$)/i.test(url)){changed();return;}
 const stream=wallpaperStreamUrl(url),early=layer.querySelector?.('video[data-neon-wallpaper-url]');
 if(early&&(early.dataset.neonWallpaperUrl!==url||early.error))dispose(early);
 const media=early?.dataset.neonWallpaperUrl===url&&!early.error?early:createWallpaperVideo(document,url,poster);
 video=media;if(media!==early)layer.append(media);media.style.opacity=media.readyState>=2?'1':'0';
 status('Starting your live wallpaper…');
 let upgrading=false,retries=0;
 function live(){if(version!==epoch||video!==media)return;media.style.opacity='1';ready();status(stream===url?'Live wallpaper playing.':'Live wallpaper playing · preparing 4K.');upgrade();}
 function upgrade(){
  if(upgrading||stream===url||version!==epoch||video!==media)return;upgrading=true;media.dataset.neonWallpaperPending4k='true';changed();
  const high=createWallpaperVideo(document,url,poster,url);pending=high;high.autoplay=false;high.style.opacity='0';layer.append(high);
  let seeking=false,stopped=false,stall;
  function stop(){
   if(stopped)return;stopped=true;clearTimeout(stall);if(pending===high)pending=null;
   if(version===epoch&&video===high){
    const fallback=createWallpaperVideo(document,url,poster,stream);fallback.style.opacity='0';fallback.dataset.neonWallpaper4kFailed='true';layer.append(fallback);video=fallback;
    fallback.addEventListener('loadeddata',()=>{if(version===epoch&&video===fallback)fallback.style.opacity='1';},{once:true});
    fallback.addEventListener('error',()=>{if(version===epoch&&video===fallback)status('Wallpaper could not connect. Select it again to retry.');},{once:true});play();
   }
   dispose(high);delete media.dataset.neonWallpaperPending4k;media.dataset.neonWallpaper4kFailed='true';
   if(version===epoch){status('Live wallpaper playing · HD. Select it again to retry 4K.');changed();}
  }
  function promote(){
   if(stopped||version!==epoch||video!==media||!canPlay()||high.readyState<3)return;
   const target=media.currentTime%high.duration;
   if(!seeking){seeking=true;if(Number.isFinite(target)&&Math.abs(high.currentTime-target)>.15){high.currentTime=target;return;}}
   if(!hasWallpaperBuffer(high))return;
   high.play().catch(stop);
  }
  high.addEventListener('error',stop,{once:true});
  high.addEventListener('waiting',()=>{if(version===epoch&&video===high){clearTimeout(stall);stall=setTimeout(stop,1800);timers.push(stall);}});
  high.addEventListener('playing',()=>clearTimeout(stall));
  high.addEventListener('playing',()=>{
   if(stopped||version!==epoch||video!==media)return;
   high.style.opacity='1';video=high;pending=null;delete media.dataset.neonWallpaperPending4k;dispose(media);status('Live wallpaper playing · 4K.');changed();
   let previous=high.getVideoPlaybackQuality?.();
   function smooth(){
    if(stopped||version!==epoch||video!==high)return;
    const quality=high.getVideoPlaybackQuality?.();
    if(canPlay()&&wallpaperDropsFrames(previous,quality)){stop();return;}
    previous=quality;timers.push(setTimeout(smooth,4000));
   }
   timers.push(setTimeout(smooth,4000));
  },{once:true});
  for(const event of ['canplay','progress','seeked'])high.addEventListener(event,promote);
  timers.push(setTimeout(()=>{if(video!==high)stop();},20000));
 }
 function retry(){
  if(version!==epoch||video!==media||retries>=2)return;
  retries++;status('Reconnecting your live wallpaper…');
  timers.push(setTimeout(()=>{
   if(version!==epoch||video!==media)return;
   // Bypass an interrupted cached response without deleting game or account data.
   media.src=stream+'?wallpaper-retry='+retries;media.load();play();
  },retries*500));
 }
 media.addEventListener('loadeddata',live);media.addEventListener('playing',()=>{if(version===epoch&&video===media){media.style.opacity='1';ready();if(upgrading)status('Live wallpaper playing · preparing 4K.');else live();}});
 media.addEventListener('error',()=>{if(version!==epoch||video!==media)return;ready();if(retries<2)retry();else status('Wallpaper could not connect. Select it again to retry.');});
 let lightStall;
 media.addEventListener('waiting',()=>{clearTimeout(lightStall);lightStall=setTimeout(retry,6000);timers.push(lightStall);});
 media.addEventListener('playing',()=>clearTimeout(lightStall));
 if(media.readyState>=2)live();
 changed();play();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)video?.pause();else play();});
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement)video?.pause();else play();});
document.addEventListener('pointerdown',play,{passive:true});
