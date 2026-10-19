export const movieServers=[{id:'one',label:'Server 1',url:'https://gaiaflix.live/'},{id:'two',label:'Server 2',url:'https://cno.to/'}];
// Preserve only provider watch/library data, never authentication credentials.
export function gaiaWatchBackup(storage){
 const records={};
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);
  if(!key?.startsWith('gaiaflix.live@'))continue;
  const name=key.slice('gaiaflix.live@'.length);
  if(!/history|progress|watch|resume|continue|favorite|mylist/i.test(name)||/token|auth|session|password|credential/i.test(name))continue;
  const value=storage.getItem(key);if(value!==null)records[key]=value;
 }
 return {version:1,provider:'gaiaflix.live',createdAt:new Date().toISOString(),records};
}
export function createMovieServers(page,onChange){
 let selected='two';try{const saved=localStorage.getItem('neon-movie-server');if(movieServers.some(server=>server.id===saved))selected=saved;}catch{}
 const nav=document.createElement('nav');nav.className='movie-servers';nav.setAttribute('aria-label','Movie servers');
 const label=document.createElement('strong');label.textContent='Neon Movies';nav.append(label);
 const buttons=new Map();
 function render(){for(const [id,button] of buttons)button.setAttribute('aria-pressed',String(id===selected));}
 for(const server of movieServers){const button=document.createElement('button');button.type='button';button.textContent=server.label;button.onclick=()=>{if(selected===server.id)return;selected=server.id;try{localStorage.setItem('neon-movie-server',selected)}catch{}render();onChange();};buttons.set(server.id,button);nav.append(button);}
 page.insertBefore(nav,page.querySelector('#movies-status'));render();
 return {current:()=>movieServers.find(server=>server.id===selected)};
}
