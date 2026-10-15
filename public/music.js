import {applyEmbeddedAppearance} from './embedded-appearance.js';
import {watchFrame} from './proxy-feedback.js';
import {brandMusicDocument} from './music-branding.js';
import {readMusicState,performMusicAction} from './music-controls.js';
import {playlistSong,createPlaylistQueue} from './playlist-player.js';
import {MUSIC_URL,musicStartup} from './music-startup.js';
export function initMusic(getController){
 const $=s=>document.querySelector(s);let frame,loading=null,version=0,cleanup=()=>{},brandedDoc,lastMusicState='';
 const status=text=>$('#music-status').textContent=text;
 const welcome=$('.music-welcome');if(welcome)welcome.hidden=true;
 const queue=createPlaylistQueue({changed:state=>window.dispatchEvent(new CustomEvent('neon-playlist-state',{detail:state})),failed:error=>window.dispatchEvent(new CustomEvent('neon-playlist-error',{detail:error.message}))});
 let playlistLaunch=0;
 function playerDocument(){try{return frame?.element.contentDocument}catch{return null}}
 function updateMini(){const doc=playerDocument();let song=null;try{queue.sync();song=playlistSong(doc?.defaultView?.__NEO_METING_PLAYER__?.track?.());}catch{}const state={...readMusicState(doc),active:!!frame,song},track=state.title,hasTrack=track!=='Choose a song',ready=state.ready,playing=state.playing;
  if(doc?.body&&doc!==brandedDoc)brand();
  $('#shell-now').textContent=ready?(hasTrack?track:(playing?'Neon Arcade Music':'Music paused')):(frame?'Choose a song':'Nothing playing');
  $('#shell-music-toggle').disabled=!ready;$('#shell-music-toggle').textContent=playing?'Ⅱ':'▷';
  $('#shell-music-toggle').title=playing?'Pause music':'Play music';$('#shell-music-toggle').setAttribute('aria-label',playing?'Pause music':'Play music');$('#shell-music-stop').disabled=!frame;
  const signature=JSON.stringify(state);if(signature!==lastMusicState){lastMusicState=signature;window.dispatchEvent(new CustomEvent('neon-music-state',{detail:state}))}
 }
 async function action(name){try{if(!queue.action(name)&&!await performMusicAction(playerDocument(),name))status('Choose a song in Music first.')}catch{status('Playback could not start. Open Music and choose the song again.')}updateMini()}
 window.addEventListener('neon-play-playlist',async event=>{
  const launch=++playlistLaunch,playlist=event.detail;
  try{const connected=await open();if(launch!==playlistLaunch)return;if(!connected)throw Error('Music could not connect. Open Music and select Reload to retry.');for(let i=0;i<180&&launch===playlistLaunch;i++){const doc=playerDocument();if(typeof doc?.defaultView?.playTrack==='function'&&doc.defaultView.__NEO_METING_PLAYER__){queue.start(doc,playlist.tracks,playlist.name,playlist.index||0,playlist.shuffle===true);updateMini();return;}await new Promise(resolve=>setTimeout(resolve,250));}if(launch===playlistLaunch)throw Error('Music is still connecting. Open Music, then try playing your playlist again.');}
  catch(error){if(launch===playlistLaunch)window.dispatchEvent(new CustomEvent('neon-playlist-error',{detail:error.message}));}
 });
 window.addEventListener('neon-playlist-stop',()=>{playlistLaunch++;queue.clear();updateMini();});
 $('#shell-music-toggle').onclick=()=>action('toggle');
 window.addEventListener('neon-music-action',event=>action(event.detail));
 $('#shell-music-stop').onclick=()=>$('#music-stop').click();
 setInterval(updateMini,500);updateMini();

 function brand(){
  cleanup();
  try{
   const doc=frame?.element.contentDocument;if(!doc?.body)return;
   const stopBrand=brandMusicDocument(doc,'NEO Music','Neon Arcade Music'),stopTheme=applyEmbeddedAppearance(doc,'music');cleanup=()=>{stopBrand();stopTheme();};
   brandedDoc=doc;
   if(doc.title==='Student Learning Portal')status('The source returned a learning portal instead of music. Try Reload; the music page may require a session on that site.');
  }catch{status('Music opened, but its inner branding could not be changed in this browser.')}
 }
 function open(reset=false,{background=false}={}){
  if(!background)$('#music-dock').hidden=false;
  if(loading)return loading;
  if(frame){if(reset){status('Connecting to Neon Arcade Music…');frame.go(MUSIC_URL)}return Promise.resolve(frame)}
  const current=++version;status('Connecting to Neon Arcade Music…');
  const pending=(async()=>{
  try{
   const controller=await getController();if(current!==version)return;
   musicStartup.warm(controller.transport);
   frame=controller.createFrame();frame.element.title='Neon Arcade Music';frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.allowFullscreen=true;
   watchFrame(frame,error=>status(error+' Use Reload to retry.'),()=>status(''));
   frame.element.addEventListener('load',brand);
   $('#music-frame').replaceChildren(frame.element);frame.go(MUSIC_URL);return frame;
  }catch(error){if(current===version)status('Music could not connect. '+error.message);return null}
  })();loading=pending;pending.finally(()=>{if(loading===pending)loading=null;});return pending;
 }
 function page(name){const active=name==='music';document.body.classList.toggle('music-view',active);if(active){$('#music-dock').classList.remove('compact');$('#music-minimize').setAttribute('aria-expanded','true');open()}else{$('#music-dock').classList.add('compact');$('#music-minimize').setAttribute('aria-expanded','false')}}
 window.addEventListener('neon-page',e=>{page(e.detail);if(e.detail==='playlists')open(false,{background:true});});
 window.addEventListener('neon-music-prepare',()=>open(false,{background:true}));
 const prepareProxy=event=>{if(event.target?.closest?.('[data-page="music"],[data-app="music"],#shell-music'))getController().catch(()=>{});};
 document.addEventListener?.('pointerover',prepareProxy,{passive:true});document.addEventListener?.('focusin',prepareProxy);
 const openButton=$('#music-open');if(openButton)openButton.onclick=()=>open();$('#music-home').onclick=()=>open(true);
 $('#music-reload').onclick=()=>{if(frame){status('Reconnecting to music…');frame.reload()}else open()};
 $('#music-minimize').onclick=()=>{const compact=$('#music-dock').classList.toggle('compact');$('#music-minimize').setAttribute('aria-expanded',String(!compact));$('#music-minimize').textContent=compact?'＋':'−'};
 $('#music-stop').onclick=()=>{playlistLaunch++;queue.clear();version++;loading=null;cleanup();cleanup=()=>{};$('#music-frame').replaceChildren();frame=null;const inMusic=location.hash==='#music';$('#music-dock').hidden=!inMusic;status(inMusic?'Music stopped. Select Reload to reconnect.':'');updateMini();if(!$('#player').hidden)$('#close-game').focus();else if(inMusic)$('#music-reload').focus();else document.querySelector('#shell-music').focus()};
 page(location.hash.slice(1));
}
