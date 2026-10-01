import {watchFrame} from './proxy-feedback.js';
import {cloudTransport} from './cloud-transport.js';
const ROBLOX_URL='https://now.gg/apps/roblox-corporation/5349/roblox.html';
const FALLBACK_URL='https://nowgg.lol/apps/a/19900/b.html';
export const cloudGames={
 roblox:{name:'Roblox',url:ROBLOX_URL},
 stumble:{name:'Stumble Guys',embedId:'as3455',url:'https://astra-education.top/embed/truffled/as3455'},
 clash:{name:'Clash Royale',embedId:'as5575',url:'https://astra-education.top/embed/truffled/as5575'},
 fortnite:{name:'Fortnite',embedId:'as1560',url:'https://astra-education.top/embed/truffled/as1560'},
 subnautica:{name:'Subnautica: Below Zero',embedId:'as2377',url:'https://astra-education.top/embed/truffled/as2377'},
 schedule:{name:'Schedule I',embedId:'as2638',url:'https://astra-education.top/embed/truffled/as2638'}
};
export function initCloud(getController){
 const $=s=>document.querySelector(s),tiles=[...document.querySelectorAll('[data-cloud-game]')];let frame,controller,version=0,loading=false,observer,activeGame='roblox',activeUrl=ROBLOX_URL;
 const status=text=>$('#cloud-status').textContent=text;
 const busy=value=>tiles.forEach(tile=>tile.disabled=value);
 function removeFrame(){observer?.disconnect();if(frame){const index=controller.frames?.indexOf(frame);if(index>=0)controller.frames.splice(index,1);frame.element.remove();frame=null;}}
 function selection(){const name=cloudGames[activeGame].name;$('#cloud-selected').textContent=name;$('#cloud-session-title').textContent='Neon Cloud Gaming · '+name;tiles.forEach(tile=>tile.setAttribute('aria-pressed',String(tile.dataset.cloudGame===activeGame)));if(frame)frame.element.title=name+' cloud launcher';}
 async function open(game=activeGame,url=cloudGames[game]?.url){
  if(loading||!cloudGames[game]||!url)return;activeGame=game;activeUrl=url;observer?.disconnect();selection();status('Opening '+cloudGames[game].name+' launcher…');
  if(frame){frame.go(activeUrl);$('#cloud-session').scrollIntoView({block:'start'});return;}
  const current=++version;loading=true;busy(true);
  try{const connected=await getController();if(current!==version)return;controller=connected;
   frame=controller.createFrame();frame.element.allow='autoplay; fullscreen; encrypted-media; gamepad';frame.element.allowFullscreen=true;selection();
   frame.fetchHandler.client.transport=cloudTransport(controller.transport,()=>cloudGames[activeGame].embedId||null);
   const ownedFrame=frame;
   watchFrame(frame,error=>{if(frame===ownedFrame)status(error+' Use Reload to retry.');},()=>{if(frame===ownedFrame)status(cloudGames[activeGame].name+' launcher connected.');});
   frame.element.addEventListener('load',()=>{
    if(frame!==ownedFrame)return;
    try{
     observer?.disconnect();const doc=frame.element.contentDocument;
     const check=()=>{if(frame===ownedFrame&&activeGame==='roblox'&&activeUrl===ROBLOX_URL&&doc.title==='Play Online Games for Free | now.gg Mobile Cloud'&&[...doc.querySelectorAll('h1,h2')].some(el=>el.textContent.trim()==='Top Games')){
      removeFrame();$('#cloud-session').hidden=true;$('#cloud-frame').replaceChildren();open('roblox',FALLBACK_URL);
     }};
     observer=new MutationObserver(check);observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true});check();
    }catch{}
   });
   $('#cloud-frame').replaceChildren(frame.element);$('#cloud-session').hidden=false;frame.go(activeUrl);$('#cloud-session').scrollIntoView({block:'start'});
  }catch(error){if(current===version){removeFrame();status('Could not connect to '+cloudGames[game].name+'. '+error.message);}}
  finally{if(current===version){loading=false;busy(false);}}
 }
 tiles.forEach(tile=>tile.onclick=()=>open(tile.dataset.cloudGame));$('#cloud-reload').onclick=()=>frame?frame.reload():open();
 $('#cloud-full').onclick=()=>$('#cloud-frame').requestFullscreen?.().catch(()=>status('Fullscreen is unavailable in this browser.'));
 $('#cloud-stop').onclick=()=>{version++;loading=false;removeFrame();busy(false);$('#cloud-frame').replaceChildren();$('#cloud-session').hidden=true;status('');tiles.find(tile=>tile.dataset.cloudGame===activeGame)?.focus();};
 selection();
}
