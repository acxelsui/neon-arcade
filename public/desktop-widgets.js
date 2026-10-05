import {widgetIds,widgetDefaults,widgetPreferences,fitWidget} from './widget-state.js';
import {getOnlineSnapshot,getOnlineMembers} from './online-state.js';
import {createMemberRow} from './members.js';

const names={music:'Now playing',weather:'Weather',online:'Online players',recent:'Recent games'};
const symbols={music:'music',weather:'weather',online:'friends',recent:'games'};
function node(tag,copy='',cls=''){const el=document.createElement(tag);el.textContent=copy;el.className=cls;return el;}
function action(label,callback,copy=label){const el=node('button',copy);el.type='button';el.setAttribute('aria-label',label);el.title=label;el.onclick=callback;return el;}

export function initDesktopWidgets({desktop,navigate,manage}){
 let initial;try{initial=JSON.parse(localStorage.getItem('neon-desktop-widgets-v1'));}catch{}
 let preferences=widgetPreferences(initial),musicState={ready:false,playing:false},gameOpen=false,covered=true;
 const root=node('div','','desktop-widgets');root.id='desktop-widgets';root.setAttribute('aria-label','Desktop widgets');desktop.append(root);
 const cards=new Map(),editors=[];
 function persist(){try{localStorage.setItem('neon-desktop-widgets-v1',JSON.stringify(preferences));}catch{}}
 function bounds(){return {width:desktop.clientWidth,height:Math.max(180,desktop.clientHeight-100)};}
 function place(id){const card=cards.get(id),position=fitWidget(preferences.positions[id],bounds(),{width:card.offsetWidth||252,height:card.offsetHeight||180});card.style.left=position.x+'px';card.style.top=position.y+'px';return position;}
 function enabled(id){return preferences.enabled.includes(id);}
 function weatherVisibility(){window.dispatchEvent(new CustomEvent('neon-weather-widget',{detail:enabled('weather')&&!document.hidden&&!gameOpen&&!covered}));}
 function show(id,on){preferences.enabled=widgetIds.filter(item=>item===id?on:enabled(item));persist();renderVisibility();}
 function renderVisibility(){root.hidden=gameOpen||covered;for(const [id,card] of cards){card.hidden=!enabled(id);place(id);}for(const editor of editors)for(const input of editor.querySelectorAll('input'))input.checked=enabled(input.dataset.widget);weatherVisibility();}
 function reset(){preferences.positions=Object.fromEntries(widgetIds.map(id=>[id,{...widgetDefaults[id]}]));persist();renderVisibility();}
 function move(id,position){preferences.positions[id]=fitWidget(position,bounds(),{width:cards.get(id).offsetWidth||252,height:cards.get(id).offsetHeight||180});place(id);}
 function drag(id,handle){
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.target.closest('button')||desktop.clientWidth<700)return;
   event.preventDefault();const start=place(id),x=event.clientX,y=event.clientY;handle.setPointerCapture(event.pointerId);cards.get(id).classList.add('is-moving');
   const update=e=>move(id,{x:start.x+e.clientX-x,y:start.y+e.clientY-y});
   const finish=()=>{handle.removeEventListener('pointermove',update);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);handle.removeEventListener('lostpointercapture',finish);cards.get(id).classList.remove('is-moving');persist();};
   handle.addEventListener('pointermove',update);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
  });
  handle.addEventListener('keydown',event=>{if(event.target!==handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const start=place(id),delta=event.shiftKey?32:12;move(id,{x:start.x+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0),y:start.y+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)});persist();});
 }
 for(const id of widgetIds){
  const card=node('section','','desktop-widget widget-'+id);card.dataset.widget=id;card.setAttribute('aria-label',names[id]+' widget');
  const header=node('div','','widget-handle');header.tabIndex=0;header.setAttribute('aria-label','Move '+names[id]+' widget. Drag or use arrow keys.');
  const icon=node('img');icon.src='/artwork/cartoon/transparent/'+symbols[id]+'.svg';icon.alt='';icon.draggable=false;icon.className='mac-cartoon-icon';
  header.append(icon,node('h2',names[id]),action('Manage desktop widgets',manage,'⋯'),action('Remove '+names[id]+' widget',()=>show(id,false),'×'));
  const content=node('div','','widget-body');card.append(header,content);root.append(card);cards.set(id,card);drag(id,header);
 }
 const music=cards.get('music').querySelector('.widget-body'),track=node('strong','Your soundtrack','widget-track'),musicDetail=node('p','Choose a song to start listening.','widget-muted');
 const musicControls=node('div','','widget-music-controls');
 const previous=action('Previous song',()=>window.dispatchEvent(new CustomEvent('neon-music-action',{detail:'previous'})),'‹');
 const toggle=action('Play music',()=>window.dispatchEvent(new CustomEvent('neon-music-action',{detail:'toggle'})),'▷');
 const next=action('Next song',()=>window.dispatchEvent(new CustomEvent('neon-music-action',{detail:'next'})),'›');
 toggle.className='widget-play';musicControls.append(previous,toggle,next,action('Open Music',()=>navigate('music'),'Open Music ↗'));music.append(track,musicDetail,musicControls);
 function renderMusic(state=musicState){musicState=state||{};track.textContent=musicState.ready?musicState.title:'Your soundtrack';musicDetail.textContent=musicState.ready?(musicState.playing?'Playing now':'Paused'):musicState.active?'Choose a song in Music.':'Choose a song to start listening.';previous.disabled=!musicState.canPrevious;toggle.disabled=!musicState.canToggle;next.disabled=!musicState.canNext;toggle.textContent=musicState.playing?'Ⅱ':'▷';toggle.setAttribute('aria-label',musicState.playing?'Pause music':'Play music');toggle.title=toggle.getAttribute('aria-label');}
 window.addEventListener('neon-music-state',event=>renderMusic(event.detail));renderMusic();

 const online=cards.get('online').querySelector('.widget-body'),onlineSummary=node('p','','widget-online-summary'),players=node('div','','widget-players');
 online.append(onlineSummary,players,action('Open Friends',()=>navigate('friends'),'Find your friends ↗'));
 function renderOnline(){const snapshot=getOnlineSnapshot(),members=getOnlineMembers().slice(0,3),focused=players.contains(document.activeElement)?document.activeElement.closest('.member-row')?.dataset.memberId:null;onlineSummary.classList.toggle('is-connected',snapshot.available);onlineSummary.replaceChildren(node('i','','widget-online-dot'),node('strong',snapshot.available?snapshot.label+' online':'Reconnecting…'));players.replaceChildren();
  if(!snapshot.available)players.append(node('p','The player list will appear when your account reconnects.','widget-muted'));else if(!members.length)players.append(node('p','The arcade is quiet right now.','widget-muted'));else for(const member of members)players.append(createMemberRow(member));
  if(focused)[...players.children].find(row=>row.dataset.memberId===focused)?.focus({preventScroll:true});
 }
 window.addEventListener('neon-online-state',renderOnline);renderOnline();

 const recent=cards.get('recent').querySelector('.widget-body'),recentList=node('div','','widget-recent-list');recent.append(recentList,action('Explore games',()=>navigate('games'),'Explore games ↗'));
 function renderRecent(){recentList.replaceChildren();const source=[...document.querySelectorAll('#recent-games > button')].slice(0,3);
  if(!source.length){recentList.append(node('p','Your recently played games will appear here.','widget-muted'));return;}
  for(const original of source){const name=original.querySelector('span')?.textContent||original.textContent,control=action('Play '+name,()=>original.click(),'');control.className='widget-game';const cover=original.querySelector('img');if(cover){const image=node('img');image.src=cover.src;image.alt='';image.loading='lazy';image.decoding='async';image.onerror=()=>{image.onerror=null;image.src='/icon.svg';};control.append(image);}control.append(node('span',name),node('span','↗'));recentList.append(control);}
 }
 const originalRecent=document.querySelector('#recent-games');if(originalRecent)new MutationObserver(renderRecent).observe(originalRecent,{childList:true});renderRecent();

 const weather=cards.get('weather').querySelector('.widget-body'),weatherPlace=node('p','Your forecast','widget-weather-place'),weatherMain=node('div','','widget-weather-main'),temperature=node('strong','—'),weatherIcon=node('span','☁'),conditions=node('p','Checking the skies…','widget-muted');weatherMain.append(temperature,weatherIcon);weather.append(weatherPlace,weatherMain,conditions,action('Open Weather',()=>navigate('weather'),'View forecast ↗'));
 function renderWeather(){const content=document.querySelector('#weather-content'),status=document.querySelector('#weather-status')?.textContent||'',location=document.querySelector('#weather-location')?.textContent||'';weatherPlace.textContent=location||'Your forecast';
  if(content&&!content.hidden){temperature.textContent=document.querySelector('#weather-temperature')?.textContent||'—';weatherIcon.textContent=document.querySelector('#weather-symbol')?.textContent||'☁';conditions.textContent=document.querySelector('#weather-condition')?.textContent||'';}
  else conditions.textContent=status||'Open Weather to choose your city.';
 }
 const weatherRoot=document.querySelector('#weather');if(weatherRoot)new MutationObserver(renderWeather).observe(weatherRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});renderWeather();

 function mountSettings(parent,{compact=false}={}){
  const editor=node('section','','widget-settings'+(compact?' is-compact':''));editor.append(node('h2','Desktop widgets'),node('p','Drag a widget by its heading. Your choices and positions stay saved on this browser.','widget-muted'));
  for(const id of widgetIds){const label=node('label'),input=node('input');input.type='checkbox';input.dataset.widget=id;input.checked=enabled(id);input.setAttribute('aria-label','Show '+names[id]+' widget');input.onchange=()=>show(id,input.checked);label.append(node('span',names[id]),input);editor.append(label);}
  editor.append(action('Reset widget positions',reset));parent.append(editor);editors.push(editor);return editor;
 }
 window.addEventListener('resize',()=>{for(const id of widgetIds)place(id);});
 window.addEventListener('neon-game',event=>{gameOpen=!!event.detail;root.hidden=gameOpen||covered;weatherVisibility();});
 document.addEventListener('visibilitychange',weatherVisibility);
 renderVisibility();
 return {mountSettings,setCovered(value){if(covered===value)return;covered=value;root.hidden=gameOpen||covered;weatherVisibility();}};
}
