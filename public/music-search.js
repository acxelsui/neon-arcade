import {playlistSong,musicArtworkOrigin} from './playlist-player.js';

export function musicSearchResults(payload){
 const rows=Array.isArray(payload)?payload:Array.isArray(payload?.results)?payload.results:null;
 if(!rows)throw Error('The music service returned an unreadable search.');
 const ids=new Set(),songs=[];
 for(const row of rows.slice(0,100)){
  try{const song=playlistSong({...row,id:typeof row?.id==='string'?row.id:''});if(ids.has(song.id))continue;ids.add(song.id);songs.push(song);}catch{}
  if(songs.length===30)break;
 }
 return songs;
}
export function createMusicSearch(getController,{clock=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const cache=new Map();let client;
 async function transport(){return client??=(async()=>{const controller=await getController();if(controller.transport.ready===false)await controller.transport.init();return controller.transport;})().catch(error=>{client=null;throw error;});}
 return {async search(value,{signal}={}){
  const query=String(value||'').trim().replace(/\s+/g,' ');if(query.length<2||query.length>120)throw Error('Enter 2–120 characters of a song or artist.');
  if(signal?.aborted)throw new DOMException('Search canceled','AbortError');
  const key=query.toLowerCase(),saved=cache.get(key);if(saved&&clock()-saved.time<300000)return saved.songs.map(song=>({...song}));
  const abort=new AbortController(),cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});let expired=false;
  const timer=setTimer(()=>{expired=true;abort.abort();},15000);
  try{
   const t=await transport();if(abort.signal.aborted)throw new DOMException('Search canceled','AbortError');
   const response=await t.request(new URL('/_o/m/search?q='+encodeURIComponent(query),musicArtworkOrigin),'GET',null,[['Accept','application/json']],abort.signal);
   const headers=new Headers(response.headers);
   if(response.status!==200||!headers.get('content-type')?.toLowerCase().includes('json')||Number(headers.get('content-length'))>1000000){await response.body?.cancel?.();throw Error('Music search could not connect. Please try again.');}
   const reader=response.body.getReader(),parts=[];let size=0;
   try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>1000000)throw Error('Music search returned too much data.');parts.push(item.value);}}finally{await reader.cancel().catch(()=>{});}
   if(abort.signal.aborted)throw new DOMException('Search canceled','AbortError');
   const songs=musicSearchResults(JSON.parse(await new Blob(parts).text()));cache.set(key,{time:clock(),songs});while(cache.size>20)cache.delete(cache.keys().next().value);
   return songs.map(song=>({...song}));
  }catch(error){if(expired)throw Error('Music search took too long. Try again.');throw error;}
  finally{clearTimer(timer);signal?.removeEventListener('abort',cancel);}
 },clear(){cache.clear();}};
}
