import {wallpapers} from './wallpaper-options.js';
import {setWallpaperMedia} from './wallpaper-media.js';
import {wallpaperPreparation} from './wallpaper-preload.js';
let saved;try{saved=JSON.parse(localStorage.getItem('neon-wallpaper'))}catch{}
if(saved!=='custom'){
 const choice=wallpapers.find(w=>w.url===saved||w.legacyUrl===saved)||wallpapers.find(w=>w.url.includes('relaxing-fireplace'))||wallpapers[0];
 if(choice)setWallpaperMedia(choice.url,choice.preview);
}
let page=location.hash.slice(1)||'home',music=false,game=false,timer;
function update(){clearTimeout(timer);wallpaperPreparation.pause();if(!document.hidden&&!document.fullscreenElement&&!game&&!music&&['home','settings'].includes(page))timer=setTimeout(()=>wallpaperPreparation.resume(),2500);}
window.addEventListener('neon-page',event=>{page=event.detail;update();});
window.addEventListener('neon-music-state',event=>{music=!!event.detail?.playing;update();});
window.addEventListener('neon-game',event=>{game=!!event.detail;update();});window.addEventListener('online',()=>{wallpaperPreparation.retry();update();});
document.addEventListener('visibilitychange',update);document.addEventListener('fullscreenchange',update);
window.addEventListener('pagehide',()=>{clearTimeout(timer);wallpaperPreparation.pause();});
window.addEventListener('neon-wallpaper-preparation',event=>{
 const el=document.querySelector('#wallpaper-preload-status');if(!el)return;const {ready,total,state}=event.detail;
 const retry=document.querySelector('#wallpaper-preload-retry');if(retry){retry.hidden=!['partial','storage','unavailable'].includes(state);retry.onclick=()=>{wallpaperPreparation.retry();update();};}
 el.textContent=ready===total?`All ${total} wallpapers are ready for quicker starts on this browser.`:state==='storage'?`${ready} of ${total} wallpapers prepared. The browser has no more wallpaper storage available.`:state==='unavailable'?'Wallpapers still play normally. This browser cannot keep them ready between visits.':state==='partial'?`${ready} of ${total} wallpapers prepared. Some could not download; you can retry them.`:`${ready} of ${total} wallpapers prepared · ${state==='preparing'?'preparing the rest in the background':'continues while Home or Settings is open'}.`;
});update();
