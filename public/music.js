import {createSoundCloudMusic} from './soundcloud-music.js';
import {watchFrame} from './proxy-feedback.js';
import {readMusicState,performMusicAction} from './music-controls.js';
import {playlistSong,createPlaylistQueue} from './playlist-player.js';
import {MUSIC_URL,musicStartup} from './music-startup.js';
export function initMusic(getController){
 const $=s=>document.querySelector(s);let frame,loading=null,version=0,cleanup=()=>{},lastMusicState='';
 const status=text=>$('#music-status').textContent=text;
 const cloudHost=document.getElementById?.('music-cloud-frame'),savedHost=document.getElementById?.('music-playlist-engine');
 const cloud=cloudHost?createSoundCloudMusic(getController,cloudHost,status):null;let source=cloud?'cloud':'saved';
 function selectSource(name){if(name!==source){if(name==='saved')cloud?.pause();else if(readMusicState(playerDocument()).playing)performMusicAction(playerDocument(),'toggle');}source=name;if(cloudHost)cloudHost.hidden=false;if(savedHost)savedHost.hidden=true;}
 const welcome=$('.music-welcome');if(welcome)welcome.hidden=true;
 const queue=createPlaylistQueue({changed:state=>window.dispatchEvent(new CustomEvent('neon-playlist-state',{detail:state})),failed:error=>window.dispatchEvent(new CustomEvent('neon-playlist-error',{detail:error.message}))});
 let playlistLaunch=0;
 function playerDocument(){try{return frame?.element.contentDocument}catch{return null}}
 function updateMini(){const doc=playerDocument();let song=null;try{queue.sync();song=playlistSong(doc?.defaultView?.__NEO_METING_PLAYER__?.track?.());}catch{}const state=source==='cloud'?cloud.state():{...readMusicState(doc),active:!!frame,song},track=state.title,hasTrack=track!=='Choose a song',ready=state.ready,playing=state.playing;
  $('#shell-now').textContent=ready?(hasTrack?track:(playing?'Neon Music':'Music paused')):(frame?'Choose a song':'Nothing playing');
  $('#shell-music-toggle').disabled=!ready;$('#shell-music-toggle').textContent=playing?'Ⅱ':'▷';
  $('#shell-music-toggle').title=playing?'Pause music':'Play music';$('#shell-music-toggle').setAttribute('aria-label',playing?'Pause music':'Play music');$('#shell-music-stop').disabled=!frame&&!cloud?.state().active;
  const signature=JSON.stringify(state);if(signature!==lastMusicState){lastMusicState=signature;window.dispatchEvent(new CustomEvent('neon-music-state',{detail:state}))}
 }
 async function action(name){if(source==='cloud'){if(!cloud.action(name))status('Choose a song in Neon Music first.');updateMini();return;}try{if(!queue.action(name)&&!await performMusicAction(playerDocument(),name))status('Choose a song in Music first.')}catch{status('Playback could not start. Open Music and choose the song again.')}updateMini()}
 window.addEventListener('neon-play-playlist',async event=>{
  const launch=++playlistLaunch,playlist=event.detail;selectSource('saved');
  try{const connected=await open();if(launch!==playlistLaunch)return;if(!connected)throw Error('Music could not connect. Open Music and select Reload to retry.');for(let i=0;i<180&&launch===playlistLaunch;i++){const doc=playerDocument();if(typeof doc?.defaultView?.playTrack==='function'&&doc.defaultView.__NEO_METING_PLAYER__){queue.start(doc,playlist.tracks,playlist.name,playlist.index||0,playlist.shuffle===true);updateMini();return;}await new Promise(resolve=>setTimeout(resolve,250));}if(launch===playlistLaunch)throw Error('Music is still connecting. Open Music, then try playing your playlist again.');}
  catch(error){if(launch===playlistLaunch)window.dispatchEvent(new CustomEvent('neon-playlist-error',{detail:error.message}));}
 });
 window.addEventListener('neon-playlist-stop',()=>{playlistLaunch++;queue.clear();updateMini();});
 $('#shell-music-toggle').onclick=()=>action('toggle');
 window.addEventListener('neon-music-action',event=>action(event.detail));
 $('#shell-music-stop').onclick=()=>$('#music-stop').click();
 setInterval(updateMini,500);updateMini();

 function open(reset=false,{background=false}={}){
  if(!background)$('#music-dock').hidden=false;
  if(loading)return loading;
  if(frame){if(reset){status('Connecting to Neon Music…');frame.go(MUSIC_URL)}return Promise.resolve(frame)}
  const current=++version;status('Connecting to Neon Music…');
  const pending=(async()=>{
  try{
   const controller=await getController();if(current!==version)return;
   musicStartup.warm(controller.transport);
   frame=controller.createFrame();frame.element.title='Neon Music';frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.allowFullscreen=true;
   watchFrame(frame,error=>status(error+' Use Reload to retry.'),()=>status(''));
   (savedHost||$('#music-frame')).replaceChildren(frame.element);frame.go(MUSIC_URL);return frame;
  }catch(error){if(current===version)status('Music could not connect. '+error.message);return null}
  })();loading=pending;pending.finally(()=>{if(loading===pending)loading=null;});return pending;
 }
 function page(name){const active=name==='music';document.body.classList.toggle('music-view',active);if(active){$('#music-dock').classList.remove('compact');$('#music-minimize').setAttribute('aria-expanded','true');if(cloud){$('#music-dock').hidden=false;cloud.open();}else open()}else{$('#music-dock').classList.add('compact');$('#music-minimize').setAttribute('aria-expanded','false')}}
 window.addEventListener('neon-page',e=>{page(e.detail);if(e.detail==='playlists')open(false,{background:true});});
 window.addEventListener('neon-music-prepare',()=>open(false,{background:true}));
 const prepareProxy=event=>{if(event.target?.closest?.('[data-page="music"],[data-app="music"],#shell-music'))getController().catch(()=>{});};
 document.addEventListener?.('pointerover',prepareProxy,{passive:true});document.addEventListener?.('focusin',prepareProxy);
 const openButton=$('#music-open');if(openButton)openButton.onclick=()=>cloud?cloud.open():open();$('#music-home').onclick=()=>{if(cloud){selectSource('cloud');cloud.open(true);}else open(true);};
 $('#music-reload').onclick=()=>{if(cloud){cloud.reload();return;}if(frame){status('Reconnecting to music…');frame.reload()}else open()};
 $('#music-minimize').onclick=()=>{const compact=$('#music-dock').classList.toggle('compact');$('#music-minimize').setAttribute('aria-expanded',String(!compact));$('#music-minimize').textContent=compact?'＋':'−'};
 $('#music-stop').onclick=()=>{cloud?.stop();playlistLaunch++;queue.clear();version++;loading=null;cleanup();cleanup=()=>{};(savedHost||$('#music-frame')).replaceChildren();frame=null;const inMusic=location.hash==='#music';$('#music-dock').hidden=!inMusic;status(inMusic?'Music stopped. Select Reload to reconnect.':'');updateMini();if(!$('#player').hidden)$('#close-game').focus();else if(inMusic)$('#music-reload').focus();else document.querySelector('#shell-music').focus()};
 selectSource(source);page(location.hash.slice(1));
}
