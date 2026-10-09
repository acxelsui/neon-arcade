import {wallpapers} from './wallpaper-options.js';
import {wallpaperPreparation} from './wallpaper-preload.js';
import {smoothWallpaperLoop} from './wallpaper-loop.js';
const bundled=new Set(wallpapers.map(item=>item.url));
export function wallpaperStreamUrl(url){return bundled.has(url)?url.replace('/wallpapers/4k/','/wallpapers/4k-start/'):url;}
export function wallpaperFullTime(url,time,duration){
 const offset=wallpapers.find(item=>item.url===url)?.openingOffsetSeconds||0;
 return Number.isFinite(duration)&&duration>0?(Math.max(0,time)+offset)%duration:0;
}
export function createWallpaperVideo(doc,url,poster,source=wallpaperPreparation.isPrepared(url)?url:wallpaperStreamUrl(url)){
 const media=doc.createElement('video');media.className='wallpaper-video';media.dataset??={};media.dataset.neonWallpaperUrl=url;if(source===url)media.dataset.neonWallpaperFull='true';
 media.muted=true;media.defaultMuted=true;media.loop=true;media.autoplay=true;media.playsInline=true;media.preload='auto';
 media.setAttribute('aria-hidden','true');media.setAttribute('disablepictureinpicture','');media.setAttribute('muted','');media.setAttribute('playsinline','');
 if(poster)media.poster=poster;
 media.src=source;smoothWallpaperLoop(media,{doc,fps:wallpapers.find(item=>item.url===url)?.frameRate||30});return media;
}
export function hasWallpaperBuffer(media,seconds=3){
 try{for(let i=0;i<media.buffered.length;i++){if(media.buffered.start(i)<=media.currentTime&&media.buffered.end(i)>=Math.min(media.currentTime+seconds,media.duration-.05))return true;}}catch{}
 return false;
}

export async function cachedWallpaperFull(url,storage=globalThis.caches){
 if(!bundled.has(url)||!storage)return false;
 try{const saved=await (await storage.open('neon-wallpapers-20261008-loops-v3')).match(url);return saved?.status===200&&saved.headers.get('content-type')?.toLowerCase().startsWith('video/mp4');}catch{return false;}
}
