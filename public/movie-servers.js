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
 const backup=document.createElement('button');backup.type='button';backup.className='movie-history-backup';backup.textContent='Save Gaiaflix history';backup.title='Download watch data saved by Gaiaflix on this browser';
 const status=document.createElement('span');status.className='movie-backup-status';status.setAttribute('role','status');
 backup.onclick=()=>{try{const data=gaiaWatchBackup(localStorage),count=Object.keys(data.records).length;if(!count){status.textContent='No Gaiaflix watch data found in this browser.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='neon-gaiaflix-watch-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Backup downloaded. Original data is unchanged.';}catch{status.textContent='Browser storage is unavailable.';}};
 nav.append(backup,status);page.insertBefore(nav,page.querySelector('#movies-status'));render();
 return {current:()=>movieServers.find(server=>server.id===selected)};
}
