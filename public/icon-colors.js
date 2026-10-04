const defaults='#fafafa';
const palettes=[['White',defaults],['Black','#202124'],['Blue','#7dbbff'],['Mint','#8af0c8'],['Purple','#b5a1ff'],['Pink','#ffadd9'],['Gold','#ffd17e'],['Coral','#ff947d']];
const key='neon-desktop-icon-color';
const transparentKey='neon-desktop-icon-transparent';
const ns='http://www.w3.org/2000/svg';
export function normalizeIconColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():defaults;}

export function initIconColors({doc=document,storage=localStorage}={}){
 let color=defaults;try{color=normalizeIconColor(JSON.parse(storage.getItem(key)));}catch{}
 let transparent=false;try{transparent=JSON.parse(storage.getItem(transparentKey))===true;}catch{}
 const controls=[];
 const svg=doc.createElementNS(ns,'svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.classList.add('mac-icon-color-filter');
 const defs=doc.createElementNS(ns,'defs'),filter=doc.createElementNS(ns,'filter');filter.id='neon-icon-color-filter';filter.setAttribute('color-interpolation-filters','sRGB');
 const transfer=doc.createElementNS(ns,'feComponentTransfer');
 const channels=['R','G','B'].map(channel=>{const el=doc.createElementNS(ns,'feFunc'+channel);el.setAttribute('type','linear');transfer.append(el);return el;});
 filter.append(transfer);defs.append(filter);svg.append(defs);doc.body.append(svg);
 function apply(value,persist=false){
  color=normalizeIconColor(value);
  const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)/255);
  // Dark symbols use a light tile so every chosen color remains visible.
  const base=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722<.38?1:0;
  channels.forEach((el,i)=>{el.setAttribute('slope',String(rgb[i]-base));el.setAttribute('intercept',String(base));});
  const tint=color===defaults?'':'url("#neon-icon-color-filter")';
  doc.documentElement.style.setProperty('--mac-icon-color-filter',transparent?(tint+' drop-shadow(0 1px 2px '+(base?'#ffffff99':'#000000cc')+')').trim():tint||'none');
  doc.body.classList.toggle('mac-icons-transparent',transparent);
  for(const image of doc.querySelectorAll('.mac-cartoon-icon')){
   const name=image.getAttribute('src')?.match(/^\/artwork\/cartoon\/(?:transparent\/)?([a-z-]+)\.svg$/)?.[1];
   if(name){const source='/artwork/cartoon/'+(transparent?'transparent/':'')+name+'.svg';if(image.getAttribute('src')!==source)image.setAttribute('src',source);}
  }
  controls.forEach(({input,swatches,status,toggle})=>{input.value=color;swatches.forEach(([button,value])=>button.setAttribute('aria-pressed',String(value===color)));toggle.setAttribute('aria-checked',String(transparent));toggle.textContent=transparent?'On':'Off';status.textContent=(palettes.find(([,value])=>value===color)?.[0]||color.toUpperCase())+' icons'+(transparent?' · transparent backgrounds':'');});
  if(persist)try{storage.setItem(key,JSON.stringify(color));}catch{controls.forEach(({status})=>status.textContent='Color applied. This browser could not save it.');}
 }
 function mount(container,{compact=false}={}){
  const section=doc.createElement('section');section.className='mac-icon-colors'+(compact?' is-compact':' glass');section.setAttribute('aria-label','Icon colors');
  const heading=doc.createElement('h2');heading.textContent='Icon colors';section.append(heading);
  if(!compact){const copy=doc.createElement('p');copy.textContent='Make the desktop yours. Colors and transparency update instantly and stay saved on this browser. With tiles enabled, dark colors use light backgrounds.';section.append(copy);
   const preview=doc.createElement('div');preview.className='mac-icon-color-preview';preview.setAttribute('aria-hidden','true');
   for(const name of ['games','music','playlists','chat','movies']){const img=doc.createElement('img');img.className='mac-cartoon-icon';img.src='/artwork/cartoon/'+name+'.svg';img.alt='';preview.append(img);}section.append(preview);
  }
  const palette=doc.createElement('div');palette.className='mac-icon-color-palette';palette.setAttribute('role','group');palette.setAttribute('aria-label','Preset icon colors');
  const swatches=palettes.map(([name,value])=>{const button=doc.createElement('button');button.type='button';button.className='mac-color-swatch';button.setAttribute('aria-label',name+' icons');button.title=name;button.style.setProperty('--swatch',value);button.onclick=()=>apply(value,true);palette.append(button);return [button,value];});section.append(palette);
  const custom=doc.createElement('label');custom.className='mac-icon-color-custom';custom.append(doc.createTextNode('Custom color'));
  const input=doc.createElement('input');input.type='color';input.setAttribute('aria-label','Custom icon color');input.oninput=()=>apply(input.value,true);custom.append(input);section.append(custom);
  const transparency=doc.createElement('div');transparency.className='mac-icon-transparent';
  const label=doc.createElement('span');label.textContent='Transparent backgrounds';
  const toggle=doc.createElement('button');toggle.type='button';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Transparent icon backgrounds');
  toggle.onclick=()=>{transparent=!transparent;apply(color);try{storage.setItem(transparentKey,JSON.stringify(transparent));}catch{status.textContent='Transparency applied. This browser could not save it.';}};
  transparency.append(label,toggle);section.append(transparency);
  const status=doc.createElement('p');status.className='mac-icon-color-status';status.setAttribute('role','status');section.append(status);
  controls.push({input,swatches,status,toggle});container.append(section);apply(color);return section;
 }
 apply(color);
 return {mount};
}
