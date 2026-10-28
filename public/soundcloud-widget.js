import {playlistSong} from './playlist-player.js';
import {soundcloudSongURL} from './soundcloud-tracks.js';

let apiPromise;
export function loadSoundCloudWidgetAPI(doc=document){
 if(doc.defaultView.SC?.Widget)return Promise.resolve(doc.defaultView.SC.Widget);
 return apiPromise??=new Promise((resolve,reject)=>{
  const script=doc.createElement('script');script.src='https://w.soundcloud.com/player/api.js';script.async=true;
  const timer=setTimeout(()=>fail(),15000);
  function fail(){clearTimeout(timer);script.remove();apiPromise=null;reject(Error('The SoundCloud player could not connect. Try Play again.'));}
  script.onload=()=>{clearTimeout(timer);const api=doc.defaultView.SC?.Widget;if(api)resolve(api);else fail();};script.onerror=fail;doc.head.append(script);
 });
}

// Use the documented widget events instead of scraping and clicking a full site.
export function createSoundCloudWidget({host,status=()=>{},ended=()=>{},getAPI=loadSoundCloudWidgetAPI}){
 let iframe,widget,song=null,ready=false,playing=false,elapsed=0,duration=0,version=0,volume=70,startTimer,readyTimer,stallTimer,boundEvents=[],failed=false,needsGesture=false;
 const state=()=>({active:!!song,ready,playing,title:song?.title||'Choose a song',song,elapsed,duration,failed,needsGesture});
 const params={auto_play:true,color:'#a68aff',show_artwork:false,show_comments:false,show_user:true,show_reposts:false,visual:false};
 function checkStart(attempt){clearTimeout(startTimer);clearTimeout(stallTimer);stallTimer=setTimeout(()=>{if(attempt===version&&ready&&!playing){failed=true;status('SoundCloud has not started this track. Retry it, choose another song, or open it on SoundCloud.');}},20000);startTimer=setTimeout(()=>{if(attempt===version&&ready&&!playing){needsGesture=true;status('Press Play, or use the SoundCloud player below to start listening.');}},4000);}
 function reportError(){failed=true;playing=false;ready=false;clearTimeout(startTimer);clearTimeout(readyTimer);clearTimeout(stallTimer);status('SoundCloud could not play this song. It may be unavailable or require a provider account. Choose another track.');}
 async function play(value){
  const track=playlistSong(value),url=soundcloudSongURL(track);if(!url)throw Error('Choose a valid SoundCloud song.');
  const attempt=++version;clearTimeout(startTimer);clearTimeout(readyTimer);clearTimeout(stallTimer);song=track;ready=false;playing=false;failed=needsGesture=false;elapsed=0;duration=track.duration||0;status('Loading '+track.title+'...');
  let API;try{API=await getAPI();}catch(error){if(attempt===version)reportError();throw error;}if(attempt!==version)return;
  const onReady=()=>{
   if(attempt!==version)return;clearTimeout(readyTimer);ready=true;status('');
   widget.getDuration(ms=>{if(attempt===version&&Number.isFinite(ms))duration=ms/1000;});
   widget.setVolume(volume);widget.play();checkStart(attempt);
  };
  readyTimer=setTimeout(()=>{if(attempt===version&&!ready)reportError();},30000);
  if(widget){widget.load(url,{...params,callback:onReady});return;}
  iframe=host.ownerDocument.createElement('iframe');iframe.title='SoundCloud audio player';iframe.allow='autoplay';iframe.credentialless=true;iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
  const source=new URL('https://w.soundcloud.com/player/');source.searchParams.set('url',url);for(const [key,value]of Object.entries(params))source.searchParams.set(key,String(value));iframe.src=source.href;
  host.replaceChildren(iframe);widget=API(iframe);const events=API.Events,instance=widget;
  const bind=(event,handler)=>{boundEvents.push(event);instance.bind(event,(...args)=>{if(widget===instance)handler(...args);});};
  bind(events.READY,onReady);
  bind(events.PLAY,()=>{if(!ready)return;playing=true;failed=needsGesture=false;clearTimeout(startTimer);clearTimeout(stallTimer);status('');});
  bind(events.PAUSE,()=>{playing=false;});
  bind(events.PLAY_PROGRESS,event=>{if(ready&&Number.isFinite(event.currentPosition))elapsed=event.currentPosition/1000;});
  bind(events.SEEK,event=>{if(ready&&Number.isFinite(event.currentPosition))elapsed=event.currentPosition/1000;});
  bind(events.FINISH,()=>{if(!ready)return;playing=false;ready=false;elapsed=0;ended();});
  bind(events.ERROR,reportError);
  widget.setVolume(volume);
 }
 function stop(){++version;clearTimeout(startTimer);clearTimeout(readyTimer);clearTimeout(stallTimer);try{widget?.pause();for(const event of boundEvents)widget?.unbind?.(event);}catch{}boundEvents=[];iframe?.remove();host.replaceChildren();iframe=widget=null;song=null;ready=playing=failed=needsGesture=false;elapsed=duration=0;}
 return {play,state,stop,prepare(){return getAPI().catch(()=>{});},pause(){if(ready)widget.pause();},action(name){if(name==='toggle'&&song&&failed){const current=song;stop();play(current).catch(()=>{});return true;}if(!ready||name!=='toggle')return false;widget.toggle();return true;},seek(fraction){if(!ready||!duration)return false;widget.seekTo(Math.max(0,Math.min(1,fraction))*duration*1000);return true;},volume(value){volume=Math.round(Math.max(0,Math.min(1,value))*100);if(ready)widget.setVolume(volume);return true;},reload(){if(song){const current=song;stop();return play(current);}}};
}
