import {blooketTransport,attachBlooketSocket} from './blooket-transport.js';
import {createHacksAccess} from './hacks-access.js';
import {watchFrame} from './proxy-feedback.js';
import {attachHacksDrag,attachEmbeddedHacksMenu} from './hacks-layout.js';
const launchers={blooket:{name:'Blooket',url:'https://x-client.x-network.lol/play'},kahoot:{name:'Kahoot',url:'https://kahootx-client.x-network.lol/'}};
export function validHackEntry(entry){return !!entry&&Object.hasOwn(launchers,entry.id)&&entry.url===launchers[entry.id].url;}
export function createHacksGate({check,changed}){
 let allowed=false,version=0;return {isAllowed:()=>allowed,revoke(){version++;allowed=false;changed(false);},async verify(){const current=++version;try{await check();if(current!==version)return false;if(!allowed){allowed=true;changed(true);}return true;}catch{if(current===version&&allowed){allowed=false;changed(false);}return false;}}};
}
export function initHacks({getController,navigate,doc=document,win=window,access=createHacksAccess()}={}){
 const main=doc.querySelector('main'),rail=doc.querySelector('.side-rail');
 const nav=doc.createElement('button');nav.id='hacks-nav';nav.type='button';nav.dataset.page='hacks';nav.hidden=true;nav.title='Hacks';nav.setAttribute('aria-label','Hacks');nav.innerHTML='<span class="rail-icon">⌘</span><span class="rail-label">Hacks</span>';nav.onclick=()=>navigate('hacks');rail.append(nav);
 const page=doc.createElement('section');page.id='hacks';page.className='page hacks-page';page.hidden=true;
 page.innerHTML='<header class="hacks-heading"><div><span class="eyebrow">NEON / PRIVATE COLLECTION</span><h1>Hacks<span>.</span></h1><p>Blooket and Kahoot. One place to launch.</p></div><span class="hacks-badge">ADMIN + OWNER</span></header><div class="hacks-library"><div class="hacks-library-heading"><h2>Your launchers</h2><span>02 APPS</span></div><div class="hacks-grid"></div><p class="hacks-note">Join with your game PIN. Each client stays inside Neon.</p></div><p class="hacks-status" role="status" aria-live="polite"></p><section class="hacks-session" hidden aria-label="Hacks player"><div class="hacks-controls"><span class="hacks-neon" aria-hidden="true">N</span><strong class="hacks-now"></strong><button type="button" data-hack-action="back" aria-label="Back to Hacks">← Library</button><button type="button" data-hack-action="reload">↻ Reload</button><button type="button" data-hack-action="fullscreen">⛶ Fullscreen</button><button type="button" data-hack-action="close">× Close</button></div><div class="hacks-frame"></div></section>';
 main.append(page);const grid=page.querySelector('.hacks-grid'),library=page.querySelector('.hacks-library'),session=page.querySelector('.hacks-session'),host=page.querySelector('.hacks-frame'),status=page.querySelector('.hacks-status'),buttons=[];
 let frame=null,controller=null,version=0,busy=false,account=null,cleanupMenu=()=>{},disposeTransport=()=>{};
 const floating=attachHacksDrag(page.querySelector('.hacks-controls'),page.querySelector('.hacks-neon'),{win,bounds:()=>{const box=session.getBoundingClientRect();return {left:box.left+8,top:box.top+8,right:box.right-8,bottom:box.bottom-8};}});
 function stop(){version++;busy=false;disposeTransport();disposeTransport=()=>{};cleanupMenu();cleanupMenu=()=>{};buttons.forEach(button=>button.disabled=!gate.isAllowed());if(frame){const index=controller?.frames?.indexOf(frame);if(index>=0)controller.frames.splice(index,1);frame.element.remove();frame=null;}host.replaceChildren();session.hidden=true;library.hidden=false;page.classList.remove('has-session');if(doc.fullscreenElement===session)doc.exitFullscreen().catch(()=>{});}
 const gate=createHacksGate({check:()=>access.request(),changed:allowed=>{nav.hidden=!allowed;buttons.forEach(button=>button.disabled=!allowed);if(!allowed){stop();if(!page.hidden)navigate('home');}win.dispatchEvent(new CustomEvent('neon-hacks-access',{detail:allowed}));}});
 for(const [id,{name}] of Object.entries(launchers)){
  const tile=doc.createElement('button');tile.type='button';tile.className='hacks-card';tile.setAttribute('aria-label','Open '+name);tile.disabled=true;
  const image=doc.createElement('img');image.src='/artwork/hacks/'+id+'.svg';image.alt='';image.width=640;image.height=400;image.decoding='async';const caption=doc.createElement('span');caption.className='hacks-caption';const title=doc.createElement('strong');title.textContent=name;const arrow=doc.createElement('span');arrow.textContent='↗';caption.append(title,arrow);tile.append(image,caption);tile.onclick=()=>open(id);buttons.push(tile);grid.append(tile);
 }
 async function open(id){
  if(busy||!gate.isAllowed())return;const current=++version,owner=access.self();busy=true;buttons.forEach(button=>button.disabled=true);status.textContent='Opening '+launchers[id].name+'…';
  try{
   const result=await access.request(id);if(current!==version||owner!==access.self())return;if(!validHackEntry(result.entry))throw Error('This launcher is unavailable.');
   const connected=await getController();if(current!==version||!gate.isAllowed()||owner!==access.self())return;controller=connected;
   disposeTransport();disposeTransport=()=>{};cleanupMenu();cleanupMenu=()=>{};if(frame){const index=controller.frames?.indexOf(frame);if(index>=0)controller.frames.splice(index,1);frame.element.remove();}
   frame=controller.createFrame();frame.element.title=launchers[id].name+' · Neon Hacks';frame.element.allow='autoplay; fullscreen; gamepad';frame.element.allowFullscreen=true;frame.element.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-pointer-lock');
   if(id==='blooket'){const adapter=blooketTransport(controller.transport);disposeTransport=()=>adapter.dispose();frame.fetchHandler.client.transport=adapter;attachBlooketSocket(frame,adapter,win.$scramjet.Tap.tap);}
   const owned=frame;watchFrame(frame,error=>{if(frame===owned)status.textContent=error+' Use Reload to retry.';},()=>{if(frame===owned)status.textContent='';});
   frame.element.addEventListener('load',()=>{if(frame!==owned)return;cleanupMenu();try{cleanupMenu=attachEmbeddedHacksMenu(frame.element.contentDocument);}catch{cleanupMenu=()=>{};}});
   host.replaceChildren(frame.element);page.querySelector('.hacks-now').textContent=launchers[id].name;session.hidden=false;library.hidden=true;page.classList.add('has-session');floating.reset();frame.go(result.entry.url);session.scrollIntoView({block:'start'});
  }catch(error){if(current===version)status.textContent=error.message||'Could not open this launcher.';}
  finally{if(current===version){busy=false;buttons.forEach(button=>button.disabled=!gate.isAllowed());}}
 }
 page.querySelector('[data-hack-action="reload"]').onclick=async()=>{if(await gate.verify())frame?.reload();};
 page.querySelector('[data-hack-action="fullscreen"]').onclick=async()=>{try{if(doc.fullscreenElement===session)await doc.exitFullscreen();else await session.requestFullscreen();}catch{status.textContent='Fullscreen is unavailable in this browser.';}};
 for(const action of ['back','close'])page.querySelector('[data-hack-action="'+action+'"]').onclick=()=>{stop();status.textContent='';};
 doc.addEventListener('fullscreenchange',()=>{floating.reveal();const full=doc.fullscreenElement===session;page.querySelector('[data-hack-action="fullscreen"]').textContent=full?'⛶ Exit fullscreen':'⛶ Fullscreen';});
 win.addEventListener('neon-page',event=>{if(event.detail==='hacks')gate.verify();});
 win.addEventListener('message',event=>{if(event.source!==win.parent||event.origin!==(location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app')||event.data?.channel!=='neon-members-v1'||event.data.type!=='members')return;const next=event.data.self?.id||null;if(next!==account){account=next;gate.revoke();}if(next)gate.verify();});
 win.addEventListener('focus',()=>{if(account)gate.verify();});doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&account)gate.verify();});
 const timer=setInterval(()=>{if(account&&!doc.hidden)gate.verify();},15000);win.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 return {...gate,stop};
}
