// This module runs in about:blank, so its postMessage source is the actual
// parent of the authenticated game iframe, rather than the account opener.
export function startBlankGame({game,contentOrigin,pass},host=window){
 const doc=host.document,status=doc.querySelector('#blank-status');
 const frame=doc.createElement('iframe');frame.title=game.name;
 frame.allow='cross-origin-isolated; autoplay; fullscreen; gamepad';frame.allowFullscreen=true;
 frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-modals');
 let sent=false,timer;
 const cleanup=()=>{host.clearTimeout(timer);host.removeEventListener('message',receive);pass=null};
 const fail=message=>{cleanup();frame.remove();status.textContent=message;status.hidden=false};
 function receive(event){
  if(event.source!==frame.contentWindow||event.origin!==contentOrigin||event.data?.channel!=='neon-members-v1')return;
  if(event.data.type==='access-ready'&&!sent){
   sent=true;frame.contentWindow.postMessage({channel:'neon-members-v1',type:'access-pass',pass},contentOrigin);
  }else if(event.data.type==='access-granted'){cleanup();status.hidden=true}
  else if(event.data.type==='access-error')fail('Could not connect your account. Return to Neon Arcade, refresh, and open about:blank again.');
 }
 host.addEventListener('message',receive);
 timer=host.setTimeout(()=>fail('The game could not connect. Keep Neon Arcade open, then close this tab and try again.'),30000);
 frame.src=contentOrigin+'/neon-access#game='+encodeURIComponent(game.id);doc.body.append(frame);
 host.addEventListener('pagehide',cleanup,{once:true});
 return frame;
}
if(typeof window!=='undefined'&&window.neonBlankGameLaunch){
 const launch=window.neonBlankGameLaunch;delete window.neonBlankGameLaunch;startBlankGame(launch);
}
