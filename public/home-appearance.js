const key='neon-home-background-v1';
export function readHomeBackground(storage){try{return storage.getItem(key)==='wallpaper'?'wallpaper':'neon';}catch{return 'neon';}}
export function initHomeAppearance({settings,preview}){
 let storage;try{storage=window.localStorage;}catch{}
 let mode=readHomeBackground(storage);
 const section=document.createElement('section');section.className='nw-home-appearance glass';section.setAttribute('aria-labelledby','nw-home-appearance-title');
 section.innerHTML='<span class="eyebrow">YOUR HOME, YOUR WAY</span><h2 id="nw-home-appearance-title">Home background</h2><p>Use the dark Neon background, or let your chosen wallpaper show through Home.</p><label>Background style<select aria-label="Home background"><option value="neon">Neon background</option><option value="wallpaper">Show my wallpaper</option></select></label><div><button type="button">Preview Home</button><span role="status">Saved on this browser</span></div>';
 settings.prepend(section);const select=section.querySelector('select'),status=section.querySelector('[role=status]');
 function apply(){document.body.classList.toggle('nw-home-wallpaper',mode==='wallpaper');select.value=mode;}
 select.onchange=()=>{mode=select.value==='wallpaper'?'wallpaper':'neon';apply();try{storage.setItem(key,mode);status.textContent='Saved on this browser';}catch{status.textContent='Applied for this visit';}};
 section.querySelector('button').onclick=preview;apply();
}
