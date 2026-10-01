import {watchFrame} from './proxy-feedback.js';
import {cloudTransport,robloxServers} from './cloud-transport.js';
export const cloudGames={
 roblox:{name:'Roblox',embedId:'as1366',url:'https://astra-education.top/embed/truffled/as1366'},
 stumble:{name:'Stumble Guys',embedId:'as3455',url:'https://astra-education.top/embed/truffled/as3455'},
 clash:{name:'Clash Royale',embedId:'as5575',url:'https://astra-education.top/embed/truffled/as5575'},
 fortnite:{name:'Fortnite',embedId:'as1560',url:'https://astra-education.top/embed/truffled/as1560'},
 subnautica:{name:'Subnautica: Below Zero',embedId:'as2377',url:'https://astra-education.top/embed/truffled/as2377'},
 schedule:{name:'Schedule I',embedId:'as2638',url:'https://astra-education.top/embed/truffled/as2638'},
 nba:{name:'NBA 2K23',embedId:'as7788',url:'https://astra-education.top/embed/truffled/as7788'},
 madden:{name:'Madden NFL 24 Mobile',embedId:'as0161',url:'https://astra-education.top/embed/truffled/as0161'},
 tcg:{name:'TCG Card Shop',embedId:'as7398',url:'https://astra-education.top/embed/truffled/as7398'},
 raft:{name:'Raft',embedId:'as4277',url:'https://astra-education.top/embed/truffled/as4277'},
 onlyup:{name:'Only Up',embedId:'as5726',url:'https://astra-education.top/embed/truffled/as5726'},
 ranch:{name:'Ranch Simulator22',embedId:'as3714',url:'https://astra-education.top/embed/truffled/as3714'},
 cuphead:{name:'Cuphead',embedId:'as3729',url:'https://astra-education.top/embed/truffled/as3729'},
 builder:{name:'Builder Simulator',embedId:'as9587',url:'https://astra-education.top/embed/truffled/as9587'},
 eurotruck:{name:'Euro Truck Simulator 2',embedId:'as0656',url:'https://astra-education.top/embed/truffled/as0656'}
};
export function initCloud(getController){
 const $=s=>document.querySelector(s),tiles=[...document.querySelectorAll('[data-cloud-game]')];let frame,controller,version=0,loading=false,activeGame='roblox',activeUrl=cloudGames.roblox.url,server='1';
 const status=text=>$('#cloud-status').textContent=text;
 const busy=value=>{tiles.forEach(tile=>tile.disabled=value);$('#cloud-server').disabled=value;};
 function removeFrame(){if(frame){const index=controller.frames?.indexOf(frame);if(index>=0)controller.frames.splice(index,1);frame.element.remove();frame=null;}}
 function selection(){const name=cloudGames[activeGame].name,label=activeGame==='roblox'?name+' · '+robloxServers[server].label:name;$('#cloud-selected').textContent=name;$('#cloud-session-title').textContent='Neon Cloud Gaming · '+label;$('#cloud-server-choice').hidden=activeGame!=='roblox';$('#cloud-server').value=server;tiles.forEach(tile=>tile.setAttribute('aria-pressed',String(tile.dataset.cloudGame===activeGame)));if(frame)frame.element.title=label+' cloud launcher';}
 async function open(game=activeGame,url=cloudGames[game]?.url){
  if(loading||!cloudGames[game]||!url)return;activeGame=game;activeUrl=url;selection();status('Opening '+cloudGames[game].name+' launcher…');
  if(frame){frame.go(activeUrl);$('#cloud-session').scrollIntoView({block:'start'});return;}
  const current=++version;loading=true;busy(true);
  try{const connected=await getController();if(current!==version)return;controller=connected;
   frame=controller.createFrame();frame.element.allow='autoplay; fullscreen; encrypted-media; gamepad';frame.element.allowFullscreen=true;selection();
   frame.fetchHandler.client.transport=cloudTransport(controller.transport,()=>cloudGames[activeGame].embedId||null,()=>activeGame==='roblox'?server:null);
   const ownedFrame=frame;
   watchFrame(frame,error=>{if(frame===ownedFrame)status(error+' Use Reload to retry.');},()=>{if(frame===ownedFrame)status(cloudGames[activeGame].name+' launcher connected.');});
   $('#cloud-frame').replaceChildren(frame.element);$('#cloud-session').hidden=false;frame.go(activeUrl);$('#cloud-session').scrollIntoView({block:'start'});
  }catch(error){if(current===version){removeFrame();status('Could not connect to '+cloudGames[game].name+'. '+error.message);}}
  finally{if(current===version){loading=false;busy(false);}}
 }
 tiles.forEach(tile=>tile.onclick=()=>open(tile.dataset.cloudGame));$('#cloud-reload').onclick=()=>frame?frame.reload():open();
 $('#cloud-server').onchange=()=>{const next=$('#cloud-server').value;if(loading||!Object.hasOwn(robloxServers,next)){selection();return;}server=next;selection();if(frame&&activeGame==='roblox')return open('roblox');};
 $('#cloud-full').onclick=()=>$('#cloud-frame').requestFullscreen?.().catch(()=>status('Fullscreen is unavailable in this browser.'));
 $('#cloud-stop').onclick=()=>{version++;loading=false;removeFrame();busy(false);$('#cloud-frame').replaceChildren();$('#cloud-session').hidden=true;status('');tiles.find(tile=>tile.dataset.cloudGame===activeGame)?.focus();};
 selection();
}
