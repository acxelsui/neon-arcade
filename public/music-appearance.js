export const MUSIC_APPEARANCE_KEY='neon-music-appearance-v1';
export const musicAppearanceDefaults=Object.freeze({mode:'blur',blur:16,opacity:30,tint:'#101827',text:'#f3f6ff'});
export function normalizeMusicAppearance(value={}){
 const color=(key)=>/^#[0-9a-f]{6}$/i.test(value?.[key])?value[key]:musicAppearanceDefaults[key];
 const number=(key,max)=>Number.isFinite(value?.[key])?Math.max(0,Math.min(max,value[key])):musicAppearanceDefaults[key];
 return {mode:['clear','blur','solid'].includes(value?.mode)?value.mode:'blur',blur:number('blur',30),opacity:number('opacity',100),tint:color('tint'),text:color('text')};
}
export function readMusicAppearance(storage){try{return normalizeMusicAppearance(JSON.parse(storage.getItem(MUSIC_APPEARANCE_KEY)||'{}'));}catch{return normalizeMusicAppearance();}}
export function applyMusicDocumentAppearance(doc,value){
 if(!doc?.head)return;
 const settings=normalizeMusicAppearance(value),signature=JSON.stringify(settings);
 let style=doc.getElementById('neon-music-personal-colors');
 if(style?.dataset.signature===signature)return;
 if(!style){style=doc.createElement('style');style.id='neon-music-personal-colors';doc.head.append(style);}
 style.dataset.signature=signature;
 style.textContent=`html body,html body :is(h1,h2,h3,h4,p,a,span,small,label,button,input,div,li){color:${settings.text}!important}html body input::placeholder{color:${settings.text}!important;opacity:.65}html body .neon-music-sidebar{color:${settings.text}!important}`;
}
export function initMusicAppearance(dock){
 let storage;try{storage=window.localStorage;}catch{}
 let value=readMusicAppearance(storage);
 if(!dock?.querySelector||!document.createElement)return ()=>value;
 const dialog=document.createElement('dialog');dialog.className='music-appearance-panel';dialog.setAttribute('aria-labelledby','music-appearance-title');
 dialog.innerHTML=`<header><div><small>MAKE IT YOURS</small><h2 id="music-appearance-title">Music appearance</h2></div><button type="button" data-close aria-label="Close appearance">×</button></header><label>Background<select name="mode"><option value="blur">Frosted blur</option><option value="clear">Clear wallpaper</option><option value="solid">Solid color</option></select></label><label>Blur strength <output data-output="blur"></output><input name="blur" aria-label="Blur strength" type="range" min="0" max="30" step="1"></label><label>Background tint <input name="tint" type="color"></label><label>Tint strength <output data-output="opacity"></output><input name="opacity" aria-label="Tint strength" type="range" min="0" max="100" step="1"></label><label>Text color <input name="text" type="color"></label><footer><span data-save>Saved on this device</span><button type="button" data-reset>Reset</button><button type="button" data-close>Done</button></footer>`;
 document.body.append(dialog);
 const button=document.createElement('button');button.type='button';button.textContent='Appearance';button.id='music-appearance';button.setAttribute('aria-haspopup','dialog');dock.querySelector('.music-dock-footer')?.insertBefore(button,dock.querySelector('#music-stop'));
 function apply(){
  const rgb=value.tint.match(/\w\w/g).map(hex=>parseInt(hex,16)).join(' ');
  dock.style.setProperty('--music-personal-background',`rgb(${rgb} / ${value.mode==='clear'?0:value.mode==='solid'?1:value.opacity/100})`);
  dock.style.setProperty('--music-personal-blur',`${value.mode==='blur'?value.blur:0}px`);
  dock.style.setProperty('--music-personal-text',value.text);
  for(const [key,item] of Object.entries(value))dialog.querySelector(`[name="${key}"]`).value=String(item);
  dialog.querySelector('[data-output="blur"]').textContent=`${value.blur}px`;
  dialog.querySelector('[data-output="opacity"]').textContent=`${value.opacity}%`;
  dialog.querySelector('[name="blur"]').disabled=value.mode!=='blur';
  dialog.querySelector('[name="opacity"]').disabled=value.mode!=='blur';
 }
 function save(){try{storage.setItem(MUSIC_APPEARANCE_KEY,JSON.stringify(value));dialog.querySelector('[data-save]').textContent='Saved on this device';}catch{dialog.querySelector('[data-save]').textContent='Applied for this visit';}apply();}
 dialog.addEventListener('input',event=>{const key=event.target.name;if(!Object.hasOwn(musicAppearanceDefaults,key))return;value=normalizeMusicAppearance({...value,[key]:['blur','opacity'].includes(key)?Number(event.target.value):event.target.value});save();});
 dialog.querySelectorAll('[data-close]').forEach(close=>close.onclick=()=>dialog.close());
 dialog.querySelector('[data-reset]').onclick=()=>{value=normalizeMusicAppearance();save();};
 button.onclick=()=>{if(!dialog.open)dialog.showModal();};apply();
 return ()=>value;
}
