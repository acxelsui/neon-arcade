export function tubeNeedsVerification(text){return /sign in to confirm|confirm you[’']?re not a bot|confirm you are not a bot|unusual traffic/i.test(String(text));}
// Report dynamic player failures without hiding or interacting with verification.
export function observeTubePlayback(win,{onVerification,onPlayback}){
 let timer,verification=false,stopped=false,connected=false;
 const check=()=>{timer=null;if(stopped)return;const blocked=tubeNeedsVerification(win.document.body?.innerText||'');if(blocked&&!verification)onVerification();verification=blocked;
  if(!blocked&&!connected&&win.document.querySelector?.('#movie_player video, #movie_player .ytp-large-play-button, #movie_player button[aria-label="Play video"]')){connected=true;onPlayback('Player connected. Press Play below.');}
 };
 const observer=new win.MutationObserver(()=>{if(!timer)timer=win.setTimeout(check,200)});
 const start=()=>{if(stopped)return;check();if(win.document.body)observer.observe(win.document.body,{childList:true,subtree:true,characterData:true});};
 const playing=event=>{if(event.target?.tagName==='VIDEO'&&event.target.readyState>=2){connected=true;onPlayback('Playing');}};
 const waiting=event=>{if(event.target?.tagName==='VIDEO'){connected=true;onPlayback('Buffering...');}};
 const paused=event=>{if(event.target?.tagName==='VIDEO')onPlayback('Paused');};
 const ended=event=>{if(event.target?.tagName==='VIDEO')onPlayback('Video ended');};
 win.document.addEventListener('playing',playing,true);win.document.addEventListener('waiting',waiting,true);
 win.document.addEventListener('pause',paused,true);win.document.addEventListener('ended',ended,true);
 if(win.document.body)start();else win.document.addEventListener('DOMContentLoaded',start,{once:true});
 const stop=()=>{stopped=true;observer.disconnect();win.clearTimeout(timer);win.document.removeEventListener('DOMContentLoaded',start);for(const [name,handler] of [['playing',playing],['waiting',waiting],['pause',paused],['ended',ended]])win.document.removeEventListener(name,handler,true);};
 win.addEventListener('pagehide',stop,{once:true});return stop;
}
