import {initGameMenu} from './game-menu.js';
export function initGameSidePanel({showPage}){
 const $=s=>document.querySelector(s),player=$('#player');
 const toggle=document.createElement('button');toggle.id='game-side-toggle';toggle.textContent='◫ Side tab';toggle.setAttribute('aria-expanded','false');$('#game-fullscreen').after(toggle);
 const panel=document.createElement('aside');panel.id='game-side-panel';panel.hidden=true;panel.setAttribute('aria-label','Game side tab');
 const divider=document.createElement('div');divider.className='game-side-divider';divider.setAttribute('aria-hidden','true');panel.append(divider);
 const bar=document.createElement('div');bar.className='game-side-toolbar';const select=document.createElement('select');select.setAttribute('aria-label','Choose side tab');
 for(const [id,name] of [['movies','Movies'],['neontube','NeonTube'],['sports','Sports'],['search','Search'],['community','Arcade Chat'],['ai','AI Chat'],['weather','Weather'],['cloud','Cloud Gaming']]){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option)}
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close side tab');const size=document.createElement('input');size.type='range';size.min='20';size.max='65';size.step='1';size.setAttribute('aria-label','Side tab size');size.title='Side tab size';let saved=36;try{saved=Number(localStorage.getItem('neon-side-tab-size'))||36}catch{}
 function resize(value){const percent=Math.max(20,Math.min(65,Number(value)||36));size.value=String(percent);size.setAttribute('aria-valuetext',percent+' percent');player.style.setProperty('--side-size',percent+'%');try{localStorage.setItem('neon-side-tab-size',String(percent))}catch{}}
 resize(saved);size.oninput=()=>resize(size.value);bar.append(select,size,close);
 let dragging=false;divider.onpointerdown=e=>{if(e.button!==0)return;dragging=true;divider.setPointerCapture(e.pointerId);player.classList.add('resizing-side-tab');e.preventDefault()};divider.onpointermove=e=>{if(!dragging)return;const rect=player.getBoundingClientRect(),stacked=matchMedia('(max-width:700px)').matches;resize(stacked?100*(rect.bottom-e.clientY)/rect.height:100*(rect.right-e.clientX)/rect.width)};function stopResize(){dragging=false;player.classList.remove('resizing-side-tab')}divider.onpointerup=stopResize;divider.onpointercancel=stopResize;divider.onlostpointercapture=stopResize;const content=document.createElement('div');content.className='game-side-content';panel.append(bar,content);player.append(panel);
 let page,marker;
 function move(host,node,before=null){if(host.moveBefore)host.moveBefore(node,before);else host.insertBefore(node,before)}
 function putBack(){if(page){move(marker.parentNode,page,marker);marker.remove();page.hidden=true;page=null}}
 function choose(){putBack();showPage(select.value);page=$('#'+select.value);marker=document.createComment('side tab position');page.before(marker);move(content,page);page.hidden=false;}
 function hide(){stopResize();putBack();panel.hidden=true;player.classList.remove('with-side-tab');toggle.setAttribute('aria-expanded','false');toggle.focus();}
 function open(){panel.hidden=false;player.classList.add('with-side-tab');toggle.setAttribute('aria-expanded','true');choose();select.focus()}
 toggle.onclick=()=>panel.hidden?open():hide();close.onclick=hide;select.onchange=choose;
 window.addEventListener('neon-game',e=>{if(!e.detail)hide()});
 initGameMenu();
}
