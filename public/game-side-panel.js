import {initGameMenu} from './game-menu.js';
import {fitWindow} from './desktop-state.js';
export function initGameSidePanel({showPage}){
 const $=s=>document.querySelector(s),player=$('#player');
 const toggle=document.createElement('button');toggle.id='game-side-toggle';toggle.textContent='◫ Side tab';toggle.setAttribute('aria-expanded','false');$('#game-fullscreen').after(toggle);
 const panel=document.createElement('aside');panel.id='game-side-panel';panel.hidden=true;panel.setAttribute('aria-label','Game side tab');
 const divider=document.createElement('div');divider.className='game-side-divider';divider.setAttribute('aria-hidden','true');panel.append(divider);
 const bar=document.createElement('div');bar.className='game-side-toolbar';const select=document.createElement('select');select.setAttribute('aria-label','Choose side tab');
 for(const [id,name] of [['movies','Movies'],['sports','Sports'],['search','Search'],['community','Arcade Chat'],['friends','Friends'],['playlists','Playlists'],['ai','AI Chat'],['weather','Weather'],['cloud','Cloud Gaming']]){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option)}
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close side tab');const size=document.createElement('input');size.type='range';size.min='20';size.max='65';size.step='1';size.setAttribute('aria-label','Side tab size');size.title='Side tab size';let saved=36;try{saved=Number(localStorage.getItem('neon-side-tab-size'))||36}catch{}
 function resize(value){const percent=Math.max(20,Math.min(65,Number(value)||36));size.value=String(percent);size.setAttribute('aria-valuetext',percent+' percent');player.style.setProperty('--side-size',percent+'%');try{localStorage.setItem('neon-side-tab-size',String(percent))}catch{}}
 const grip=document.createElement('button');grip.type='button';grip.className='game-side-move';grip.textContent='⠿';grip.setAttribute('aria-label','Move side tab');grip.title='Drag to move. Arrow keys move; Shift + arrow keys resize.';
 const float=document.createElement('button');float.type='button';float.className='game-side-float';float.setAttribute('aria-pressed','false');
 const corner=document.createElement('div');corner.className='game-side-window-resize';corner.tabIndex=0;corner.setAttribute('role','button');corner.setAttribute('aria-label','Resize side tab');corner.title='Drag to resize or use arrow keys';panel.append(corner);
 let floating=false,rect=null;try{floating=localStorage.getItem('neon-side-tab-floating')==='true';const savedRect=JSON.parse(localStorage.getItem('neon-side-tab-window'));if(savedRect&&['x','y','w','h'].every(key=>Number.isFinite(savedRect[key])))rect=savedRect;}catch{}
 function fit(){const bounds=player.getBoundingClientRect();if(bounds.width<=0||bounds.height<=0)return;rect=fitWindow(rect||{x:bounds.width*.6,y:70,w:bounds.width*.36,h:bounds.height*.76},bounds.width,bounds.height);for(const [property,key] of [['--side-x','x'],['--side-y','y'],['--side-width','w'],['--side-height','h']])panel.style.setProperty(property,rect[key]+'px');}
 function preserve(){try{localStorage.setItem('neon-side-tab-floating',String(floating));if(rect)localStorage.setItem('neon-side-tab-window',JSON.stringify(rect));}catch{}}
 function floatPanel(value){floating=value;panel.classList.toggle('is-floating',floating);player.classList.toggle('floating-side-tab',floating&&!panel.hidden);float.textContent=floating?'⇥':'⧉';float.setAttribute('aria-label',floating?'Dock side tab':'Float side tab');float.title=floating?'Dock on the side':'Float over the game';float.setAttribute('aria-pressed',String(floating));if(floating)fit();preserve();}
 float.onclick=()=>floatPanel(!floating);
 resize(saved);size.oninput=()=>{resize(size.value);if(floating){rect.w=player.clientWidth*Number(size.value)/100;fit();preserve();}};bar.append(grip,select,size,float,close);floatPanel(floating);
 let dragging=false;divider.onpointerdown=e=>{if(e.button!==0)return;dragging=true;divider.setPointerCapture(e.pointerId);player.classList.add('resizing-side-tab');e.preventDefault()};divider.onpointermove=e=>{if(!dragging)return;const rect=player.getBoundingClientRect(),stacked=matchMedia('(max-width:700px)').matches;resize(stacked?100*(rect.bottom-e.clientY)/rect.height:100*(rect.right-e.clientX)/rect.width)};function stopResize(){dragging=false;player.classList.remove('resizing-side-tab')}divider.onpointerup=stopResize;divider.onpointercancel=stopResize;divider.onlostpointercapture=stopResize;const content=document.createElement('div');content.className='game-side-content';panel.append(bar,content);player.append(panel);
 let page,marker;
 function move(host,node,before=null){if(host.moveBefore)host.moveBefore(node,before);else host.insertBefore(node,before)}
 function putBack(){if(page){move(marker.parentNode,page,marker);marker.remove();page.hidden=true;page=null}}
 function choose(){putBack();showPage(select.value);page=$('#'+select.value);marker=document.createComment('side tab position');page.before(marker);move(content,page);page.hidden=false;}
 function hide(){stopResize();putBack();panel.hidden=true;player.classList.remove('with-side-tab','floating-side-tab');toggle.setAttribute('aria-expanded','false');toggle.focus();}
 function open(){panel.hidden=false;player.classList.add('with-side-tab');toggle.setAttribute('aria-expanded','true');choose();floatPanel(floating);select.focus()}
 toggle.onclick=()=>panel.hidden?open():hide();close.onclick=hide;select.onchange=choose;
 function movable(handle,resizing=false){let start=null;
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;if(handle===bar&&event.target.closest('select,input,button')!==grip&&event.target.closest('select,input,button'))return;
   if(!floating){const bounds=player.getBoundingClientRect(),position=panel.getBoundingClientRect();rect={x:position.left-bounds.left,y:position.top-bounds.top,w:position.width,h:position.height};floatPanel(true);}else fit();
   start={x:event.clientX,y:event.clientY,rect:{...rect}};handle.setPointerCapture(event.pointerId);player.classList.add('resizing-side-tab');event.preventDefault();});
  handle.addEventListener('pointermove',event=>{if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;rect=resizing?{...start.rect,w:start.rect.w+dx,h:start.rect.h+dy}:{...start.rect,x:start.rect.x+dx,y:start.rect.y+dy};fit();});
  const finish=()=>{if(!start)return;start=null;player.classList.remove('resizing-side-tab');preserve();};for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
 }
 movable(bar);movable(corner,true);
 function keyboard(event,resizing=false){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(!floating)floatPanel(true);const delta=['ArrowLeft','ArrowUp'].includes(event.key)?-12:12,horizontal=['ArrowLeft','ArrowRight'].includes(event.key),field=resizing||event.shiftKey?(horizontal?'w':'h'):(horizontal?'x':'y');rect[field]+=delta;fit();preserve();}
 grip.onkeydown=event=>keyboard(event);corner.onkeydown=event=>keyboard(event,true);grip.onclick=()=>grip.focus();
 window.addEventListener('resize',()=>{if(floating)fit();});
 window.addEventListener('neon-game',e=>{if(!e.detail)hide()});
 initGameMenu();
}
