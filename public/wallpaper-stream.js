import {wallpapers} from './wallpaper-options.js';
const bundled=new Set(wallpapers.map(item=>item.url));
export function wallpaperStreamUrl(url){return bundled.has(url)?url.replace('/wallpapers/4k/','/wallpapers/4k-start/'):url;}
export function createWallpaperVideo(doc,url,poster,source=wallpaperStreamUrl(url)){
 const media=doc.createElement('video');media.className='wallpaper-video';media.dataset??={};media.dataset.neonWallpaperUrl=url;
 media.muted=true;media.defaultMuted=true;media.loop=true;media.autoplay=true;media.playsInline=true;media.preload='auto';
 media.setAttribute('aria-hidden','true');media.setAttribute('disablepictureinpicture','');media.setAttribute('muted','');media.setAttribute('playsinline','');
 if(poster)media.poster=poster;
 media.src=source;return media;
}
export function hasWallpaperBuffer(media,seconds=3){
 try{for(let i=0;i<media.buffered.length;i++){if(media.buffered.start(i)<=media.currentTime&&media.buffered.end(i)>=Math.min(media.currentTime+seconds,media.duration-.05))return true;}}catch{}
 return false;
}
