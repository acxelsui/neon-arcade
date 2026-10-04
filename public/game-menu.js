export function initGameMenu(){
 const player=document.querySelector('#player'),bar=player.querySelector('.player-bar');
 const mac=!!document.querySelector('link[href="/mac-desktop.css"]');
 const desktop=!mac&&!!document.querySelector('link[href="/windows-desktop.css"]');
 const menu=document.createElement('div');menu.id='game-menu';
 const toggle=document.createElement('button');toggle.id='game-menu-toggle';toggle.type='button';toggle.setAttribute('aria-label','Neon Arcade game menu');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','game-menu-panel');
 const logo=document.createElement('img');logo.src=desktop?'/artwork/fluent/games.svg':'/game-toolbar-logo.svg';logo.alt='';toggle.append(logo);toggle.title='Neon game controls';if(desktop){toggle.setAttribute('aria-label','Focus game');toggle.title='Focus game';menu.classList.add('windows-game-menu')}
 const panel=document.createElement('div');panel.id='game-menu-panel';panel.hidden=true;panel.setAttribute('aria-label','Game controls');
 const left=document.createElement('div');left.className='game-menu-left';for(const selector of ['#retry-game','#blank-button','#game-fullscreen','#game-side-toggle'])left.append(document.querySelector(selector));
 const exit=document.querySelector('#close-game');exit.textContent='×';exit.classList.add('game-menu-exit');
 const name=bar.querySelector('#playing-name');name.hidden=!desktop;panel.append(name,left,exit);bar.remove();menu.append(toggle,panel);player.append(menu);
 const icons={
  'retry-game':['M19 7a8 8 0 0 0-13-2L3 8','M3 3v5h5','M5 17a8 8 0 0 0 13 2l3-3','M21 21v-5h-5'],
  'blank-button':['M14 3h7v7','M21 3 11 13','M10 5H4v15h15v-6'],
  'game-fullscreen':['M8 3H3v5','M16 3h5v5','M3 16v5h5','M21 16v5h-5'],
  'game-side-toggle':['M3 4h18v16H3z','M14 4v16'],
  'close-game':['M6 6l12 12','M18 6 6 18']
 };
 for(const [id,paths] of Object.entries(icons)){
  const button=document.querySelector('#'+id);button.title=button.getAttribute('aria-label')||'Side tab';
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
  for(const d of paths){const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',d);icon.append(path)}button.replaceChildren(icon);
 }
 const music=document.createElement('div');music.className='game-menu-music';music.hidden=true;music.setAttribute('role','group');music.setAttribute('aria-label','Music controls');
 const track=document.createElement('span');track.className='game-menu-track';music.append(track);
 const musicIcons={like:['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8'],previous:['M5 4v16','M19 4 7 12l12 8z'],toggle:['M8 4v16','M16 4v16'],next:['M19 4v16','M5 4l12 8-12 8z']},musicButtons={};
 function musicIcon(button,paths){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');for(const d of paths){const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',d);icon.append(path)}button.replaceChildren(icon)}
 for(const [action,paths] of Object.entries(musicIcons)){const button=document.createElement('button');button.type='button';button.id='game-music-'+action;button.disabled=true;musicIcon(button,paths);button.onclick=()=>window.dispatchEvent(new CustomEvent('neon-music-action',{detail:action}));musicButtons[action]=button;music.append(button)}
 panel.append(music);
 window.addEventListener('neon-music-state',event=>{
  const state=event.detail;music.hidden=!state.active;track.textContent=state.title;track.title=state.title;
  for(const [action,button] of Object.entries(musicButtons)){const label=action==='toggle'?(state.playing?'Pause music':'Play music'):action==='like'?(state.liked?'Unlike song':'Like song'):action==='previous'?'Previous song':'Next song';button.title=label;button.setAttribute('aria-label',label);button.disabled=!state['can'+action[0].toUpperCase()+action.slice(1)]}
  musicButtons.like.setAttribute('aria-pressed',String(state.liked));musicIcon(musicButtons.toggle,state.playing?musicIcons.toggle:['M8 4l12 8-12 8z']);
 });
 let pinned=false;
 function show(value){value=desktop||value;panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));menu.classList.toggle('open',value)}
 function dismiss(){pinned=false;show(false)}
 menu.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(true)});
 menu.addEventListener('pointerleave',()=>{if(!pinned&&!panel.contains(document.activeElement))show(false)});
 toggle.onclick=()=>{if(desktop){document.querySelector('#game-frame-wrap iframe')?.focus();return}pinned=!pinned;show(pinned)};
 toggle.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();show(true);panel.querySelector('button').focus()}};
 menu.addEventListener('focusin',e=>{if(e.target!==toggle)show(true)});
 menu.addEventListener('focusout',e=>{if(!menu.contains(e.relatedTarget)&&!pinned)show(false)});
 menu.addEventListener('keydown',e=>{if(!desktop&&e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();dismiss();toggle.focus()}});
 panel.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.game-menu-music')&&!e.target.closest('.game-menu-hacks')){const restore=panel.contains(document.activeElement);dismiss();if(restore&&!player.hidden)toggle.focus()}});
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))dismiss()});window.addEventListener('neon-game',dismiss);
 show(desktop);
}
