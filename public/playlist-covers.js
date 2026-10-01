import {songArtwork,musicArtworkOrigin} from './playlist-player.js';
// Covers and metadata use the music relay, including artwork missing from old playlists.
export function createPlaylistCovers(getController,{makeURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url)}={}){
 const cache=new Map(),urls=new Set();let closed=false,transportPromise=null;
 function transport(){return transportPromise??=(async()=>{const controller=await getController(),client=controller.transport;if(client.ready===false)await client.init();return client;})().catch(error=>{transportPromise=null;throw error;});}
 async function request(value){
  const client=await transport();let remote=new URL(value);
  for(let i=0;i<5&&!closed;i++){
   if(remote.protocol!=='https:'||remote.username||remote.password)throw Error('Invalid artwork address');
   const response=await client.request(remote,'GET',null,[],undefined),headers=new Headers(response.headers);
   if([301,302,303,307,308].includes(response.status)){await response.body?.cancel?.();const target=headers.get('location');if(!target)throw Error('Artwork redirect unavailable');remote=new URL(target,remote);continue;}
   return {...response,headers};
  }
  throw Error('Artwork unavailable');
 }
 async function image(value){
  if(!value||closed)return null;const response=await request(value);
  if(response.status!==200||!response.headers.get('content-type')?.toLowerCase().startsWith('image/')||Number(response.headers.get('content-length'))>10000000){await response.body?.cancel?.();return null;}
  const blob=await new Response(response.body,{headers:response.headers}).blob();return blob.size&&blob.size<=10000000?blob:null;
 }
 async function lookup(song){
  if(!song||typeof song.id!=='string'||!/^[a-zA-Z0-9:_-]{1,160}$/.test(song.id)||typeof song.title!=='string'||!song.title.trim())return '';
  const query=[song.title.slice(0,200),String(song.artist||'').slice(0,200)].filter(Boolean).join(' '),response=await request(musicArtworkOrigin+'/_o/m/search?q='+encodeURIComponent(query));
  if(response.status!==200||Number(response.headers.get('content-length'))>1000000){await response.body?.cancel?.();return '';}
  const text=await new Response(response.body).text();if(text.length>1000000)return '';const data=JSON.parse(text),rows=Array.isArray(data)?data:Array.isArray(data.results)?data.results:[];
  return songArtwork(rows.find(row=>String(row.id)===song.id));
 }
 function load(value){
  const song=typeof value==='string'?{thumb:value}:value,original=songArtwork(song);if(!original&&!song?.id)return Promise.resolve('');
  const key=String(song?.id||'')+'|'+original,previous=cache.get(key);if(previous&&(previous.url||Date.now()-previous.created<30000))return previous.promise;
  const entry={url:'',promise:null,created:Date.now()};cache.set(key,entry);
  while(cache.size>128){const oldest=cache.keys().next().value,old=cache.get(oldest);if(old.url){revokeURL(old.url);urls.delete(old.url);}cache.delete(oldest);}
  entry.promise=(async()=>{try{
   let blob=null;if(original)try{blob=await image(original);}catch{}
   if(!blob&&!closed){const recovered=await lookup(song);if(recovered&&recovered!==original)blob=await image(recovered);}
   if(!blob||closed||cache.get(key)!==entry)return '';const url=makeURL(blob);entry.url=url;urls.add(url);return url;
  }catch{return '';}})();return entry.promise;
 }
 function clear(){closed=true;for(const url of urls)revokeURL(url);urls.clear();cache.clear();}
 return {load,clear};
}
