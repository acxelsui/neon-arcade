import {themeBrowserScrollbars} from './embedded-appearance.js';
import {revealTab} from './ui-motion.js';
// Each tab owns its frame. Switching tabs never navigates or recreates it.
export function createBrowserTabs({page,getController,watchFrame,createYouTubeSearch,normalizeUrl,toast,doc=document}){
 const start=page.querySelector('#search-start'),frames=page.querySelector('#web-frames'),error=page.querySelector('#web-error'),address=page.querySelector('#address'),status=page.querySelector('#search-status');
 const rail=doc.createElement('aside');rail.className='browser-orbits';rail.setAttribute('aria-label','Browser tabs');
 const list=doc.createElement('div');list.className='browser-orbit-list';list.setAttribute('role','tablist');list.setAttribute('aria-label','Open websites');list.setAttribute('aria-orientation','vertical');
 const add=doc.createElement('button');add.type='button';add.className='browser-orbit-add';add.textContent='+';add.title='New browser tab';add.setAttribute('aria-label','New browser tab');
 const close=doc.createElement('button');close.type='button';close.className='browser-orbit-close';close.textContent='×';close.title='Close current browser tab';close.setAttribute('aria-label','Close current browser tab');rail.append(list,add,close);page.prepend(rail);
 const tabs=[];let active=null,serial=0;
 function label(tab){try{return tab.url?new URL(tab.url).hostname.replace(/^www\./,''):'New tab';}catch{return 'Website';}}
 function paint(){
  for(const tab of tabs){const selected=active===tab;tab.button.setAttribute('aria-selected',String(selected));tab.button.tabIndex=selected?0:-1;tab.pane.hidden=!selected||tab.home;tab.button.title=label(tab);tab.button.setAttribute('aria-label','Tab '+(tabs.indexOf(tab)+1)+' - '+label(tab));tab.button.textContent=String(tabs.indexOf(tab)+1);}
  start.hidden=!active.home;frames.hidden=active.home;address.value=active.home?'':active.url;status.textContent=active.status||'';error.hidden=!active.error;page.querySelector('#web-error-text').textContent=active.error||'';close.disabled=tabs.length===1;
 }
 function select(tab,focus=false){if(!tabs.includes(tab))return;const previous=active,direction=tabs.indexOf(tab)>=tabs.indexOf(previous)?1:-1;active=tab;paint();if(previous!==tab)revealTab(tab.home?start:tab.pane,direction,tab.home);if(focus)tab.button.focus();}
 function newTab(){const id='browser-pane-'+(++serial),tab={url:'',home:true,revision:0,status:'',error:'',frame:null,controller:null};tab.pane=doc.createElement('section');tab.pane.className='browser-tab-pane';tab.pane.id=id;tab.pane.setAttribute('role','tabpanel');tab.button=doc.createElement('button');tab.button.type='button';tab.button.className='browser-orbit';tab.button.id=id+'-tab';tab.button.setAttribute('role','tab');tab.button.setAttribute('aria-controls',id);tab.pane.setAttribute('aria-labelledby',tab.button.id);tab.button.onclick=()=>select(tab);
  const host=doc.createElement('div');host.className='browser-tab-frame';tab.pane.append(host);frames.append(tab.pane);tab.youtube=createYouTubeSearch({host,navigate:url=>browse(url,tab),doc});list.append(tab.button);tabs.push(tab);select(tab);return tab;
 }
 async function browse(text,tab=active){let url;try{url=normalizeUrl(text);}catch(e){tab.error=e.message;paint();return;}if(!url)return;const revision=++tab.revision;tab.status='Connecting…';tab.error='';if(active===tab)paint();
  try{const controller=await getController();if(tab.revision!==revision||!tabs.includes(tab))return;if(!tab.frame){tab.controller=controller;tab.frame=controller.createFrame();themeBrowserScrollbars(tab.frame);tab.frame.element.title='Browser · '+label({...tab,url});tab.frame.element.allowFullscreen=true;watchFrame(tab.frame,message=>{if(!tabs.includes(tab))return;tab.error=message;tab.status='';if(active===tab)paint();});tab.youtube.connect(tab.frame,controller);tab.pane.querySelector('.browser-tab-frame').append(tab.frame.element);}
   tab.url=url;tab.home=false;tab.frame.go(url);tab.youtube.opened(url);tab.status='';if(active===tab)paint();
  }catch(e){if(tab.revision!==revision)return;tab.status='';tab.error='Search couldn’t connect. '+e.message;if(active===tab)paint();}
 }
 function home(){active.revision++;active.home=true;active.error='';active.status='';active.youtube.hide();paint();page.querySelector('#query').focus();}
 add.onclick=()=>{newTab();page.querySelector('#query').focus();};close.onclick=()=>{if(tabs.length===1)return;const tab=active,index=tabs.indexOf(tab);tab.revision++;tab.youtube.hide();tab.frame?.element.remove();const frameIndex=tab.controller?.frames?.indexOf(tab.frame);if(frameIndex>=0)tab.controller.frames.splice(frameIndex,1);tab.pane.remove();tab.button.remove();tabs.splice(index,1);select(tabs[Math.min(index,tabs.length-1)],true);};
 list.addEventListener('keydown',event=>{const index=tabs.findIndex(t=>t.button===event.target);if(index<0)return;const next=event.key==='ArrowDown'?(index+1)%tabs.length:event.key==='ArrowUp'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;if(next!==null){event.preventDefault();select(tabs[next],true);}});
 page.querySelector('#web-home').onclick=home;page.querySelector('#new-search').onclick=add.onclick;page.querySelector('#web-back').onclick=()=>active.frame?.back();page.querySelector('#web-forward').onclick=()=>active.frame?.forward();page.querySelector('#web-reload').onclick=()=>active.frame?.reload();page.querySelector('#web-full').onclick=()=>page.requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'));
 page.querySelector('#web-retry').onclick=()=>{active.error='';paint();active.frame?.reload();};page.querySelector('#web-dismiss').onclick=()=>{active.error='';paint();};newTab();return {browse,home,reload:()=>active.frame?.reload()};
}
