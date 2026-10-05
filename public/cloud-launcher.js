import {createCloudSession,portableCloudFetch} from './neon-cloud-session.js';
const config=JSON.parse(document.querySelector('#config').textContent),status=document.querySelector('#status'),overlay=document.querySelector('#connecting'),mount=document.querySelector('#stream'),show=document.querySelector('#show-stream');
document.querySelector('#game-name').textContent=config.name;
let frame,probe;
const hide=()=>{overlay.hidden=true;clearInterval(probe);frame?.focus();};
const session=createCloudSession({
 fetch:portableCloudFetch(fetch,window.localStorage),
 onStatus:text=>{status.textContent=text;overlay.hidden=false;},
 onStream:url=>{frame=document.createElement('iframe');frame.title=config.name+' cloud game';frame.allow='autoplay; fullscreen; encrypted-media; gamepad; keyboard-map; pointer-lock';frame.allowFullscreen=true;frame.src=url;mount.replaceChildren(frame);show.hidden=false;
  // Loading the iframe alone doesn't mean the video stream has started.
  probe=setInterval(()=>{try{const video=frame.contentDocument?.querySelector('video');if(video&&video.readyState>=2&&video.videoWidth>0)hide();}catch{}},500);
 },
 onEnd:()=>{clearInterval(probe);frame?.remove();frame=null;show.hidden=true;document.querySelector('#retry').hidden=false;}
});
show.onclick=hide;document.querySelector('#retry').onclick=()=>location.reload();
window.addEventListener('pagehide',()=>{session.stop();},{once:true});
session.start(config.key);
