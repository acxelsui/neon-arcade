import {installLolRenderer} from './lol-mod-renderer.js';
import {GAME_ORIGIN} from './game-transport.js';
import {getLolModGame} from './lol-mod-games.js';
export function attachLolMod(frame,mod,{Tap=window.$scramjet.Tap,install=installLolRenderer,notify}={}){
 const game=getLolModGame(mod?.gameId??'58');if(!mod?.allowed||!game)return;
 Tap.tap(frame.hooks.init.post,context=>{
  if(!mod.allowed||!context.isTopLevel||context.client.url.origin!==GAME_ORIGIN||context.client.url.pathname!==game.path)return;
  // Use the controller's native initialization hook. The proxied game's
  // parent/top isolation, cookies, saves and transport are never relaxed.
  mod.renderer?.revoke();mod.renderer=install({win:context.window,notify,gameId:game.id});
 });
}
export async function prepareLolMod({gameId='58',win=window,origin=location.origin,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(!getLolModGame(gameId))return null;
 // A detached about:blank game still launches normally. Its parent is the
 // account host, not the desktop that verifies owner access for this menu.
 try{if(win.parent===win||win.parent.location.origin!==origin)return null;}catch{return null;}
 const channel='neon-lol-mod-v1',requestId=crypto.randomUUID();
 const granted=await new Promise(resolve=>{
  const finish=value=>{clearTimer(timer);win.removeEventListener('message',receive);resolve(value);};
  const receive=event=>{const data=event.data;if(event.source===win.parent&&event.origin===origin&&data?.channel===channel&&data.gameId===gameId&&data.requestId===requestId&&data.action==='authorization')finish(data.allowed===true);};
  const timer=setTimer(()=>finish(false),8000);win.addEventListener('message',receive);win.parent.postMessage({channel,gameId,action:'authorize',requestId},origin);
 });
 if(!granted)return null;
 const mod={allowed:true,gameId,renderer:null};
 const notify=status=>win.parent.postMessage({channel,gameId,action:'status',status},origin);
 win.addEventListener('message',event=>{
  const data=event.data;
  if(event.source===win.parent&&event.origin===origin&&data?.channel===channel&&data.gameId===gameId){
   if(data.action==='revoke'){mod.allowed=false;mod.renderer?.revoke();}
   else if(mod.allowed&&data.action==='settings')mod.renderer?.settings(data.settings);
  }
 });
 mod.attach=frame=>attachLolMod(frame,mod,{Tap:win.$scramjet.Tap,notify});return mod;
}
