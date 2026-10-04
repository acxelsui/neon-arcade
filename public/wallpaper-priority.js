import {wallpapers} from './wallpaper-options.js';
export function startWallpaperEarly(doc=globalThis.document,storage){
 const layer=doc?.querySelector('#wallpaper');if(!layer||layer.querySelector('video'))return;
 let saved;try{saved=JSON.parse((storage||globalThis.localStorage).getItem('neon-wallpaper'));}catch{}
 if(saved==='custom')return;
 const choice=(typeof saved==='string'&&wallpapers.find(item=>item.url===saved||item.legacyUrl===saved))||wallpapers.find(item=>item.url.includes('relaxing-fireplace'))||wallpapers[0];
 if(!choice)return;
 layer.style.backgroundImage=`url(${JSON.stringify(choice.poster||choice.preview)})`;
 const media=doc.createElement('video');media.className='wallpaper-video';media.dataset.neonWallpaperUrl=choice.url;
 media.muted=true;media.defaultMuted=true;media.loop=true;media.autoplay=true;media.playsInline=true;media.preload='auto';media.poster=choice.poster||choice.preview;
 media.setAttribute('aria-hidden','true');media.setAttribute('muted','');media.setAttribute('playsinline','');media.setAttribute('disablepictureinpicture','');
 layer.append(media);media.src=choice.url;if(!doc.hidden&&!doc.fullscreenElement)media.play().catch(()=>{});
 // Register the existing proxy worker early so cached videos can stream locally.
 globalThis.navigator?.serviceWorker?.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
 return media;
}
if(typeof document!=='undefined')startWallpaperEarly();
