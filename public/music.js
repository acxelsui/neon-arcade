import {watchFrame} from './proxy-feedback.js';
import {brandMusicDocument} from './music-branding.js';
const MUSIC_URL='https://bcsdny.net/~a/';
export function initMusic(getController){
 const $=s=>document.querySelector(s);let frame,loading=false,version=0,cleanup=()=>{};
 const status=text=>$('#music-status').textContent=text;
 function audio(){try{return frame?.element.contentDocument?.querySelector('audio')}catch{return null}}
 function updateMini(){const media=audio(),ready=!!(media&&(media.currentSrc||media.getAttribute('src'))),playing=ready&&!media.paused&&!media.ended;
  $('#shell-now').textContent=ready?(playing?'Neon Music':'Music paused'):(frame?'Choose a song':'Nothing playing');
  $('#shell-music-toggle').disabled=!ready;$('#shell-music-toggle').textContent=playing?'Ⅱ':'▷';
  $('#shell-music-toggle').title=playing?'Pause music':'Play music';$('#shell-music-toggle').setAttribute('aria-label',playing?'Pause music':'Play music');$('#shell-music-stop').disabled=!frame;
 }
 $('#shell-music-toggle').onclick=async()=>{const media=audio();if(!media)return;try{if(media.paused)await media.play();else media.pause()}catch{status('Playback could not start. Open Music and choose the song again.')}updateMini()};
 $('#shell-music-stop').onclick=()=>$('#music-stop').click();
 setInterval(updateMini,500);updateMini();

 function brand(){
  cleanup();
  try{
   const doc=frame?.element.contentDocument;if(!doc?.body)return;
   cleanup=brandMusicDocument(doc);
   if(doc.title==='Student Learning Portal')status('The source returned a learning portal instead of music. Try Reload; the music page may require a session on that site.');
  }catch{status('Music opened, but its inner branding could not be changed in this browser.')}
 }
 async function open(reset=false){
  if(loading)return;
  $('#music-dock').hidden=false;
  if(frame){if(reset){status('Connecting to Neon Music…');frame.go(MUSIC_URL)}return}
  const current=++version;loading=true;status('Connecting to Neon Music…');
  try{
   const controller=await getController();if(current!==version)return;
   frame=controller.createFrame();frame.element.title='Neon Music';frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.allowFullscreen=true;
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
 $('#music-stop').onclick=()=>{version++;loading=false;cleanup();cleanup=()=>{};$('#music-frame').replaceChildren();frame=null;$('#music-dock').hidden=true;status('');if(!$('#player').hidden)$('#close-game').focus();else if(location.hash==='#music')$('#music-open').focus();else document.querySelector('nav [data-page=music]').focus()};
 page(location.hash.slice(1));
}
