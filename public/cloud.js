import {watchFrame} from './proxy-feedback.js';
const ROBLOX_URL='https://now.gg/apps/roblox-corporation/5349/roblox.html';
const FALLBACK_URL='https://nowgg.lol/apps/a/19900/b.html';
export function initCloud(getController){
 const $=s=>document.querySelector(s);let frame,version=0,loading=false,observer,activeUrl=ROBLOX_URL;
 const status=text=>$('#cloud-status').textContent=text;
 async function open(url=ROBLOX_URL){
  if(loading)return;activeUrl=url;observer?.disconnect();if(frame){status('Opening Roblox provider…');frame.go(activeUrl);return}
  const current=++version;loading=true;status('Opening Roblox provider…');$('#cloud-tile').disabled=true;
  try{const controller=await getController();if(current!==version)return;
   frame=controller.createFrame();frame.element.title='Roblox cloud provider';frame.element.allow='autoplay; fullscreen; encrypted-media; gamepad';frame.element.allowFullscreen=true;
   watchFrame(frame,error=>status(error+' Use Reload to retry.'),()=>status('Provider page connected. A working Roblox stream has not yet been confirmed.'));
   frame.element.addEventListener('load',()=>{
    try{
     observer?.disconnect();const doc=frame.element.contentDocument;
     const check=()=>{if(activeUrl===ROBLOX_URL&&doc.title==='Play Online Games for Free | now.gg Mobile Cloud'&&[...doc.querySelectorAll('h1,h2')].some(el=>el.textContent.trim()==='Top Games')){
      observer?.disconnect();
      $('#cloud-session').hidden=true;$('#cloud-frame').replaceChildren();frame=null;
      status('The official link redirected away from Roblox. Opening the alternate Roblox link…');
      open(FALLBACK_URL);
     }};
     observer=new MutationObserver(check);observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true});check();
    }catch{}
   });
   $('#cloud-frame').replaceChildren(frame.element);$('#cloud-session').hidden=false;frame.go(activeUrl);$('#cloud-session').scrollIntoView({block:'start'});
  }catch(error){if(current===version)status('Could not connect to now.gg. '+error.message)}finally{if(current===version){loading=false;$('#cloud-tile').disabled=false}}
 }
 $('#cloud-tile').onclick=()=>open();$('#cloud-reload').onclick=()=>frame?frame.reload():open(activeUrl);
 $('#cloud-full').onclick=()=>$('#cloud-frame').requestFullscreen?.().catch(()=>status('Fullscreen is unavailable in this browser.'));
 $('#cloud-stop').onclick=()=>{version++;loading=false;observer?.disconnect();$('#cloud-tile').disabled=false;$('#cloud-frame').replaceChildren();frame=null;$('#cloud-session').hidden=true;status('');$('#cloud-tile').focus()};
}
