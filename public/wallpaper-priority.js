import {wallpapers} from './wallpaper-options.js';
import {createWallpaperVideo} from './wallpaper-stream.js';
export function startWallpaperEarly(doc=globalThis.document,storage){
 const layer=doc?.querySelector('#wallpaper');if(!layer||layer.querySelector('video'))return;
 let saved;try{saved=JSON.parse((storage||globalThis.localStorage).getItem('neon-wallpaper'));}catch{}
 if(saved==='custom')return;
 const choice=(typeof saved==='string'&&wallpapers.find(item=>item.url===saved||item.legacyUrl===saved))||wallpapers.find(item=>item.url.includes('relaxing-fireplace'))||wallpapers[0];
 if(!choice)return;
 layer.style.backgroundImage=`url(${JSON.stringify(choice.poster||choice.preview)})`;
 const media=createWallpaperVideo(doc,choice.url,choice.poster||choice.preview);
 layer.append(media);if(!doc.hidden&&!doc.fullscreenElement)media.play().catch(()=>{});
 // Register the existing proxy worker early so cached videos can stream locally.
 globalThis.navigator?.serviceWorker?.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
 return media;
}
if(typeof document!=='undefined')startWallpaperEarly();
