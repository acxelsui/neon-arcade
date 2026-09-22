import {watchFrame} from './proxy-feedback.js';
import {brandMusicDocument} from './music-branding.js';
const URL='https://bcsdny.net/~v/';
export function initTube(getController){
 const $=s=>document.querySelector(s);let frame,loading=false,version=0,cleanup=()=>{};
 const status=text=>$('#tube-status').textContent=text;
 async function open(reset=false){
  if(loading)return;
  if(frame){if(reset)frame.go(URL);return}
  loading=true;const current=++version;status('Connecting to NeonTube…');
  try{
   const controller=await getController();if(current!==version)return;
   frame=controller.createFrame();frame.element.title='NeonTube';frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.allowFullscreen=true;
   watchFrame(frame,error=>status(error+' Use Reload to retry.'),()=>status(''));
   frame.element.addEventListener('load',()=>{cleanup();try{const doc=frame.element.contentDocument;if(doc?.body)cleanup=brandMusicDocument(doc,'VoidTube','NeonTube')}catch{status('The video page opened, but its heading could not be renamed.')}});
   $('#tube-frame').replaceChildren(frame.element);frame.go(URL);
  }catch(error){if(current===version)status('NeonTube could not connect. '+error.message)}finally{if(current===version)loading=false}
 }
 $('#tube-home').onclick=()=>open(true);$('#tube-reload').onclick=()=>{if(frame)frame.reload();else open()};
 $('#tube-full').onclick=()=>$('#tube-frame').requestFullscreen?.().catch(()=>status('Fullscreen is unavailable in this browser.'));
 $('#tube-stop').onclick=()=>{version++;loading=false;cleanup();cleanup=()=>{};$('#tube-frame').replaceChildren();frame=null;status('Video stopped. Select Home or Reload to reopen NeonTube.')};
 window.addEventListener('neon-page',e=>{if(e.detail==='neontube')open()});if(location.hash==='#neontube')open();
}
