export const suppliedKahootPath='/vendor/kahootx-supplied-20261020.js';
export const suppliedKahootHash='248b91f7e2df388ccbb5e888be941370074fa2ca6c7433e49f191e489f227723';
export async function loadSuppliedKahoot({fetchImpl=fetch,cryptoImpl=crypto}={}){
 const response=await fetchImpl(suppliedKahootPath,{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)throw Error('Could not load the supplied KahootX script ('+response.status+').');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength>3*1024*1024)throw Error('The supplied script exceeds its size limit.');
 const hash=[...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==suppliedKahootHash)throw Error('The supplied KahootX file has changed. Restore the original file before running it.');
 return new TextDecoder().decode(bytes);
}
// Run only inside the existing proxied Kahoot player, never in the Neon page.
export function attachSuppliedKahoot(frame,{source,tap,onStatus=()=>{},clock=window}){
 const installed=new WeakSet(),timers=new Set();let stopped=false;
 const menuPresent=doc=>{
  if(!doc)return false;const roots=[doc];for(let i=0;i<roots.length&&i<100;i++){
   if(roots[i].querySelector('#hm-root'))return true;
   for(const el of roots[i].querySelectorAll('*'))if(el.shadowRoot)roots.push(el.shadowRoot);
  }return false;
 };
 tap(frame.hooks.init.post,({window:player,client,isTopLevel})=>{
  if(stopped||!isTopLevel||!['kahoot.it','play.kahoot.it'].includes(client.url.hostname)||installed.has(player.document))return;
  installed.add(player.document);onStatus('Starting the supplied KahootX menu...');
  try{
   const result=player.eval(source);
   Promise.resolve(result).catch(()=>{if(!stopped)onStatus('The supplied KahootX script reported an error. Reload the player to retry.');});
   let elapsed=0;const timer=clock.setInterval(()=>{
    if(stopped){clock.clearInterval(timer);timers.delete(timer);return;}
    if(menuPresent(player.document)){clock.clearInterval(timer);timers.delete(timer);onStatus('KahootX menu loaded. Feature availability depends on its service and authorization.');}
    else if((elapsed+=500)>=20000){clock.clearInterval(timer);timers.delete(timer);onStatus('Kahoot loaded, but the supplied menu did not appear. Its integrity or authorization checks may have stopped it.');}
   },500);timers.add(timer);
  }catch{onStatus('The supplied KahootX script could not start inside this player.');}
 });
 return ()=>{stopped=true;for(const timer of timers)clock.clearInterval(timer);timers.clear();};
}
