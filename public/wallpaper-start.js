import {wallpapers} from './wallpaper-options.js';
import {setWallpaperMedia} from './wallpaper-media.js';
let saved;try{saved=JSON.parse(localStorage.getItem('neon-wallpaper'))}catch{}
if(saved!=='custom'){
 const choice=wallpapers.find(w=>w.url===saved||w.legacyUrl===saved)||wallpapers.find(w=>w.url.includes('relaxing-fireplace'))||wallpapers[0];
 if(choice)setWallpaperMedia(choice.url,choice.preview);
}
