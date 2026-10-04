import {canPrepareWallpapers} from './wallpaper-idle.js';
import {wallpapers} from './wallpaper-options.js';
import {setWallpaperMedia,warmWallpaperMedia} from './wallpaper-media.js';
import {wallpaperPreparation} from './wallpaper-preload.js';
let saved;try{saved=JSON.parse(localStorage.getItem('neon-wallpaper'))}catch{}
if(saved!=='custom'){
 const choice=(typeof saved==='string'&&wallpapers.find(w=>w.url===saved||w.legacyUrl===saved))||wallpapers.find(w=>w.url.includes('relaxing-fireplace'))||wallpapers[0];
 if(choice)setWallpaperMedia(choice.url,choice.poster||choice.preview);
}
let page=location.hash.slice(1)||'home',music=false,game=false,timer;
function eligible(){return !document.hidden&&!document.fullscreenElement&&!game&&!music&&['home','settings'].includes(page);}
function prepare(){if(!eligible())return;if(canPrepareWallpapers(document.querySelector('#wallpaper video')))wallpaperPreparation.resume();else timer=setTimeout(prepare,1500);}
function update(){clearTimeout(timer);wallpaperPreparation.pause();if(eligible())timer=setTimeout(prepare,page==='settings'?0:3500);}
window.addEventListener('neon-wallpaper-playback',update);
window.addEventListener('neon-page',event=>{page=event.detail;update();});
window.addEventListener('neon-music-state',event=>{music=!!event.detail?.playing;update();});
window.addEventListener('neon-game',event=>{game=!!event.detail;update();});window.addEventListener('online',()=>{wallpaperPreparation.retry();update();});
document.addEventListener('visibilitychange',update);document.addEventListener('fullscreenchange',update);
window.addEventListener('pagehide',()=>{clearTimeout(timer);wallpaperPreparation.pause();});
window.addEventListener('neon-wallpaper-preparation',event=>{
 const el=document.querySelector('#wallpaper-preload-status');if(!el)return;const {ready,total,state}=event.detail;
 const retry=document.querySelector('#wallpaper-preload-retry');if(retry){retry.hidden=!['partial','storage','unavailable'].includes(state);retry.onclick=()=>{wallpaperPreparation.retry();update();};}
 el.textContent=ready===total?`All ${total} wallpapers are ready for quicker starts on this browser.`:state==='storage'?`${ready} of ${total} wallpapers prepared. The browser has no more wallpaper storage available.`:state==='unavailable'?'Wallpapers still play normally. This browser cannot keep them ready between visits.':state==='partial'?`${ready} of ${total} wallpapers prepared. Some could not download; you can retry them.`:`${ready} of ${total} wallpapers prepared · ${state==='preparing'?'preparing the rest in the background':'waits for your wallpaper, then continues in the background'}.`;
});update();

// Prepare the next selection before the click, while preserving original 4K frames.
function warmChoice(event){
 if(!eligible())return;
 const button=event.target.closest?.('#wallpaper-grid .wallpaper-choice');
 const choice=button&&wallpapers.find(item=>item.url===button.dataset.url);
 if(choice)warmWallpaperMedia(choice.url,choice.poster||choice.preview);
}
document.addEventListener('pointerover',warmChoice,{passive:true});
document.addEventListener('focusin',warmChoice);
