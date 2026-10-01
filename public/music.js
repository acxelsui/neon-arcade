import {watchFrame} from './proxy-feedback.js';
import {brandMusicDocument} from './music-branding.js';
import {readMusicState,performMusicAction} from './music-controls.js';
const MUSIC_URL='https://6ab87f0e6a91203ed89fa447--neoostesting.netlify.app/neo-os/music-v2/index.html?v=20260919-scholarnook-v1&theme=system-v1&widgets=live-v1&runtime=20260908-audio-performance-v1';
export function initMusic(getController){
 const $=s=>document.querySelector(s);let frame,loading=false,version=0,cleanup=()=>{},brandedDoc,lastMusicState='';
 const status=text=>$('#music-status').textContent=text;
 function playerDocument(){try{return frame?.element.contentDocument}catch{return null}}
 function updateMini(){const doc=playerDocument(),state={...readMusicState(doc),active:!!frame},track=state.title,hasTrack=track!=='Choose a song',ready=state.ready,playing=state.playing;
  if(doc?.body&&doc!==brandedDoc)brand();
  $('#shell-now').textContent=ready?(hasTrack?track:(playing?'Neon Arcade Music':'Music paused')):(frame?'Choose a song':'Nothing playing');
  $('#shell-music-toggle').disabled=!ready;$('#shell-music-toggle').textContent=playing?'Ⅱ':'▷';
  $('#shell-music-toggle').title=playing?'Pause music':'Play music';$('#shell-music-toggle').setAttribute('aria-label',playing?'Pause music':'Play music');$('#shell-music-stop').disabled=!frame;
  const signature=JSON.stringify(state);if(signature!==lastMusicState){lastMusicState=signature;window.dispatchEvent(new CustomEvent('neon-music-state',{detail:state}))}
 }
 async function action(name){try{if(!await performMusicAction(playerDocument(),name))status('Choose a song in Music first.')}catch{status('Playback could not start. Open Music and choose the song again.')}updateMini()}
 $('#shell-music-toggle').onclick=()=>action('toggle');
 window.addEventListener('neon-music-action',event=>action(event.detail));
 $('#shell-music-stop').onclick=()=>$('#music-stop').click();
 setInterval(updateMini,500);updateMini();

 function brand(){
  cleanup();
  try{
   const doc=frame?.element.contentDocument;if(!doc?.body)return;
   cleanup=brandMusicDocument(doc,'NEO Music','Neon Arcade Music');
   brandedDoc=doc;
   if(doc.title==='Student Learning Portal')status('The source returned a learning portal instead of music. Try Reload; the music page may require a session on that site.');
  }catch{status('Music opened, but its inner branding could not be changed in this browser.')}
 }
 async function open(reset=false){
  if(loading)return;
  $('#music-dock').hidden=false;
  if(frame){if(reset){status('Connecting to Neon Arcade Music…');frame.go(MUSIC_URL)}return}
  const current=++version;loading=true;status('Connecting to Neon Arcade Music…');
  try{
   const controller=await getController();if(current!==version)return;
   frame=controller.createFrame();frame.element.title='Neon Arcade Music';frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.allowFullscreen=true;
   watchFrame(frame,error=>status(error+' Use Reload to retry.'),()=>status(''));
   frame.element.addEventListener('load',brand);
   $('#music-frame').replaceChildren(frame.element);frame.go(MUSIC_URL);
  }catch(error){if(current===version)status('Music could not connect. '+error.message)}
  finally{if(current===version)loading=false}
 }
 function page(name){const active=name==='music';document.body.classList.toggle('music-view',active);if(active){$('#music-dock').classList.remove('compact');$('#music-minimize').setAttribute('aria-expanded','true');open()}else{$('#music-dock').classList.add('compact');$('#music-minimize').setAttribute('aria-expanded','false')}}
 window.addEventListener('neon-page',e=>page(e.detail));
 $('#music-open').onclick=()=>open();$('#music-home').onclick=()=>open(true);
 $('#music-reload').onclick=()=>{if(frame){status('Reconnecting to music…');frame.reload()}else open()};
 $('#music-minimize').onclick=()=>{const compact=$('#music-dock').classList.toggle('compact');$('#music-minimize').setAttribute('aria-expanded',String(!compact));$('#music-minimize').textContent=compact?'＋':'−'};
 $('#music-stop').onclick=()=>{version++;loading=false;cleanup();cleanup=()=>{};$('#music-frame').replaceChildren();frame=null;$('#music-dock').hidden=true;status('');updateMini();if(!$('#player').hidden)$('#close-game').focus();else if(location.hash==='#music')$('#music-open').focus();else document.querySelector('nav [data-page=music]').focus()};
 page(location.hash.slice(1));
}
