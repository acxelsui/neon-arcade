import {wallpaperPreparation} from './wallpaper-preload.js';
let video,currentUrl,epoch=0,release=[],visible=Promise.resolve();
function play(){if(video&&!document.hidden&&!document.fullscreenElement)video.play().catch(()=>{});}
export function whenWallpaperVisible(timeout=200){return Promise.race([visible,new Promise(resolve=>setTimeout(resolve,timeout))]);}
export function setWallpaperMedia(url,poster=''){
 if(currentUrl===url&&!video?.error){play();return;}
 const layer=document.querySelector('#wallpaper'),version=++epoch;currentUrl=url;wallpaperPreparation.select(url);
 if(typeof window!=='undefined')window.dispatchEvent(new Event('neon-wallpaper-playback'));
 if(video){video.pause();video.removeAttribute('src');video.load();video.remove();video=null;}
 release.forEach(dispose=>dispose());release=[];
 let ready;visible=new Promise(resolve=>ready=resolve);
 layer.style.backgroundImage=`url(${JSON.stringify(poster||url)})`;
 if(typeof Image!=='undefined'){
  const image=new Image();image.fetchPriority='high';image.onload=()=>{if(version===epoch)ready();};image.onerror=()=>ready();image.src=poster||url;
 }
 if(poster)wallpaperPreparation.source(poster).then(source=>{if(!source)return;if(version!==epoch){source.release();return;}release.push(source.release);layer.style.backgroundImage=`url(${JSON.stringify(source.url)})`;});
 if(!/\.mp4(?:[?#]|$)/i.test(url))return;
 const early=layer.querySelector?.('video[data-neon-wallpaper-url]');
 const reuse=early?.dataset.neonWallpaperUrl===url&&!early.error;
 if(early&&!reuse){early.pause();early.removeAttribute('src');early.load();early.remove();}
 const media=reuse?early:document.createElement('video');video=media;
 media.className='wallpaper-video';media.muted=true;media.defaultMuted=true;media.loop=true;media.autoplay=true;media.playsInline=true;media.preload='auto';
 media.setAttribute('aria-hidden','true');media.setAttribute('disablepictureinpicture','');media.setAttribute('muted','');media.setAttribute('playsinline','');
 if(poster)media.poster=poster;
 media.style.opacity=media.readyState>=2?'1':'0';if(media.readyState>=2)ready();media.addEventListener('loadeddata',()=>{if(version===epoch){media.style.opacity='1';ready();}},{once:true});media.addEventListener('error',()=>{if(version===epoch)ready();});
 media.addEventListener('waiting',()=>{if(version===epoch&&typeof window!=='undefined')window.dispatchEvent(new Event('neon-wallpaper-playback'));});
 if(!reuse){layer.append(media);media.src=url;}
 // The browser and existing worker stream cached bytes directly. Never wait
 // for a whole 4K file to be copied into a blob before starting playback.
 play();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)video?.pause();else play()});
// Fullscreen media covers the wallpaper completely; avoid decoding a second
// video behind it. Resume the same full-quality wallpaper on exit.
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement)video?.pause();else play()});
document.addEventListener('pointerdown',play,{passive:true});
