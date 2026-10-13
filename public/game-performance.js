const channel='neon-game-performance-v1';
// Refresh the layout, never the page, GL context, timer or save. Restarting an
// arbitrary game's loop can duplicate simulation updates and lose the session.
export function attachGamePerformance(frame,{win=window,gameId,Tap=win.$scramjet.Tap}={}){
 let gameWindow=null;
 Tap.tap(frame.hooks.init.post,context=>{if(context.isTopLevel)gameWindow=context.window;});
 const receive=event=>{
  const data=event.data;
  if(event.source!==win.parent||event.origin!==win.location.origin||data?.channel!==channel||data.gameId!==gameId||data.action!=='refresh'||typeof data.requestId!=='string'||data.requestId.length>80)return;
  let ready=false;
  try{if(gameWindow){gameWindow.dispatchEvent(new gameWindow.Event('resize'));ready=true;}}catch{}
  win.parent.postMessage({channel,action:'result',requestId:data.requestId,gameId,ready},event.origin);
 };
 win.addEventListener('message',receive);
 win.addEventListener('pagehide',()=>{gameWindow=null;win.removeEventListener('message',receive);},{once:true});
}
export function initGamePerformance({doc=document,win=window}={}){
 const panel=doc.querySelector('#game-menu-panel'),left=panel?.querySelector('.game-menu-left');if(!left)return;
 const button=doc.createElement('button');button.id='game-performance';button.type='button';button.title='Boost FPS without restarting the game';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','false');
 button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-12h-7z"/></svg>';
 left.append(button);
 const status=doc.createElement('p');status.className='game-performance-status';status.hidden=true;status.setAttribute('role','status');panel.append(status);
 let gameId=null,boosted=false,pending=null,timer;
 function state(value){boosted=value;button.setAttribute('aria-pressed',String(value));doc.body.classList.toggle('neon-game-performance',value);}
 function finish(text){clearTimeout(timer);pending=null;button.disabled=!gameId;status.textContent=text;status.hidden=false;}
 win.addEventListener('neon-game',event=>{clearTimeout(timer);pending=null;gameId=event.detail?.id||null;state(false);button.disabled=!gameId;status.hidden=true;});
 win.addEventListener('message',event=>{
  const frame=doc.querySelector('#game-frame-wrap > iframe');const data=event.data;
  if(event.source!==frame?.contentWindow||event.origin!==win.location.origin||data?.channel!==channel||data.gameId!==gameId||data.action!=='result'||data.requestId!==pending)return;
  finish(data.ready?'Performance mode on. Game kept running.':'Background effects reduced. The game is still loading; try again once it opens.');
 });
 button.onclick=()=>{
  if(!gameId||pending)return;
  if(boosted){state(false);status.textContent='Normal effects restored. Game kept running.';status.hidden=false;return;}
  const frame=doc.querySelector('#game-frame-wrap > iframe');if(!frame?.contentWindow)return;
  state(true);pending=win.crypto.randomUUID();button.disabled=true;status.textContent='Giving the game more room…';status.hidden=false;
  frame.contentWindow.postMessage({channel,action:'refresh',requestId:pending,gameId},win.location.origin);
  timer=win.setTimeout(()=>finish('Background effects reduced. Frame refresh did not respond; your game was not restarted.'),2500);
 };
 return {button};
}
