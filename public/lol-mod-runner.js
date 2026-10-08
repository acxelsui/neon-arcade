import {installLolRenderer} from './lol-mod-renderer.js';
import {GAME_ORIGIN} from './game-transport.js';
export function attachLolMod(frame,mod,{Tap=window.$scramjet.Tap,install=installLolRenderer,notify}={}){
 if(!mod?.allowed)return;
 Tap.tap(frame.hooks.init.post,context=>{
  if(!mod.allowed||!context.isTopLevel||context.client.url.origin!==GAME_ORIGIN||context.client.url.pathname!=='/games/58.html')return;
  // Use the controller's native initialization hook. The proxied game's
  // parent/top isolation, cookies, saves and transport are never relaxed.
  mod.renderer?.revoke();mod.renderer=install({win:context.window,notify});
 });
}
export async function prepareLolMod({win=window,origin=location.origin,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 // A detached about:blank game still launches normally. Its parent is the
 // account host, not the desktop that verifies owner access for this menu.
 try{if(win.parent===win||win.parent.location.origin!==origin)return null;}catch{return null;}
 const channel='neon-lol-mod-v1',requestId=crypto.randomUUID();
 const granted=await new Promise(resolve=>{
  const finish=value=>{clearTimer(timer);win.removeEventListener('message',receive);resolve(value);};
  const receive=event=>{const data=event.data;if(event.source===win.parent&&event.origin===origin&&data?.channel===channel&&data.gameId==='58'&&data.requestId===requestId&&data.action==='authorization')finish(data.allowed===true);};
  const timer=setTimer(()=>finish(false),8000);win.addEventListener('message',receive);win.parent.postMessage({channel,gameId:'58',action:'authorize',requestId},origin);
 });
 if(!granted)return null;
 const mod={allowed:true,renderer:null};
 const notify=status=>win.parent.postMessage({channel,gameId:'58',action:'status',status},origin);
 win.addEventListener('message',event=>{
  const data=event.data;
  if(event.source===win.parent&&event.origin===origin&&data?.channel===channel&&data.gameId==='58'){
   if(data.action==='revoke'){mod.allowed=false;mod.renderer?.revoke();}
   else if(mod.allowed&&data.action==='settings')mod.renderer?.settings(data.settings);
  }
 });
 mod.attach=frame=>attachLolMod(frame,mod,{Tap:win.$scramjet.Tap,notify});return mod;
}
