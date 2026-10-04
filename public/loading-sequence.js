export function createAccountLoading({overlay,status,retry,frame,origin,setTimer=setTimeout,clearTimer=clearTimeout,reload=()=>location.reload()}){
 let timer,active=false;
 function finish(){active=false;clearTimer(timer);overlay.hidden=true;retry.hidden=true;}
 function fail(){clearTimer(timer);status.textContent='The arcade is taking longer than expected. Retry when your connection is ready.';retry.hidden=false;}
 retry.onclick=reload;
 return {start(){clearTimer(timer);active=true;overlay.hidden=false;retry.hidden=true;status.textContent='Opening your arcade…';timer=setTimer(fail,20000);},finish,receive(event){
  if(!active||event.source!==frame.contentWindow||event.origin!==origin||event.data?.channel!=='neon-members-v1')return false;
  if(event.data.type==='arcade-ready'){finish();return true;}
  if(event.data.type==='arcade-loading'){status.textContent=event.data.step===2?'Preparing your wallpaper and apps…':'Opening your arcade…';return true;}
  if(['arcade-load-error','access-error'].includes(event.data.type)){fail();return true;}return false;
 }};
}
const accountOrigin=typeof location!=='undefined'?(location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app'):null;
const embedded=typeof window!=='undefined'&&window.parent!==window&&!!document.querySelector('#loading');
if(embedded)document.querySelector('#loading').hidden=true;
function send(type,extra={}){if(embedded)window.parent.postMessage({channel:'neon-members-v1',type,...extra},accountOrigin);}
export function reportArcadeLoading(step){send('arcade-loading',{step});}
export function finishArcadeLoading(){send('arcade-ready');return embedded;}
export function failArcadeLoading(){send('arcade-load-error');}
