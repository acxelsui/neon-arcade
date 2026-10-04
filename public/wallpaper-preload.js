import {wallpapers} from './wallpaper-options.js';
// Only bundled, non-personal wallpaper files enter this cache.
export function createWallpaperPreparation({items=wallpapers,storage=globalThis.caches,fetcher=globalThis.fetch,estimate=()=>globalThis.navigator?.storage?.estimate?.(),notify=()=>{},delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 items=items.filter(item=>/^\/wallpapers\/4k\/[a-zA-Z0-9._-]+\.mp4$/.test(item.url)&&/^\/artwork\/wallpaper-posters\/[a-zA-Z0-9._-]+\.webp$/.test(item.preview));
 const videos=items.map(item=>item.url),streams=items.map(item=>item.url.replace('/wallpapers/4k/','/wallpapers/stream/')),posters=items.map(item=>item.poster||item.preview).filter(Boolean),known=new Set([...videos,...streams,...posters]);
 let cachePromise,allowed=false,selected=null,running=null,request=null,blocked=false,state='paused';const done=new Set(),failed=new Set();
 function report(){notify({ready:streams.filter(url=>done.has(url)).length,total:videos.length,state});}
 async function cache(){if(!storage)return null;return cachePromise??=storage.open('neon-wallpapers-20261004-v2').catch(()=>null);}
 function valid(response,url){return response?.status===200&&response.headers.get('content-type')?.toLowerCase().startsWith(videos.includes(url)||streams.includes(url)?'video/mp4':'image/');}
 async function source(url){
  if(!known.has(url))return null;
  try{const saved=await (await cache())?.match(url);if(!valid(saved,url))return null;const blob=await saved.blob();if(!blob.size)return null;
   const local=URL.createObjectURL(blob);return {url:local,release:()=>URL.revokeObjectURL(local)};
  }catch{return null;}
 }
 async function run(){
  const saved=await cache();if(!saved){state='unavailable';report();return;}
  if(!done.size){for(const url of known){const response=await saved.match(url);if(valid(response,url))done.add(url);}report();}
  while(allowed&&!blocked){
   // Prepare the smaller collection and only the selected 4K file.
   // Do not saturate the connection downloading a gigabyte of unused 4K video.
   const url=[selected?.replace('/wallpapers/4k/','/wallpapers/stream/'),...posters,...streams,selected].find(url=>known.has(url)&&!done.has(url)&&!failed.has(url));
   if(!url){state=failed.size?'partial':'ready';report();return;}
   request=new AbortController();const current=request;
   try{
    state='preparing';report();const response=await fetcher(url,{credentials:'same-origin',redirect:'error',signal:current.signal,priority:'low'});
    if(!valid(response,url)){current.abort();failed.add(url);continue;}
    const size=Number(response.headers.get('content-length'))||100*1024*1024;let space;try{space=await estimate();}catch{/* Playback and caching can continue without a storage estimate. */}
    if(space?.quota&&space.quota-space.usage<size+64*1024*1024){blocked=true;state='storage';current.abort();report();return;}
    if(!allowed||current.signal.aborted){current.abort();return;}
    await saved.put(url,response);done.add(url);report();
   }catch(error){if(current.signal.aborted)return;if(error.name==='QuotaExceededError'){blocked=true;state='storage';report();return;}failed.add(url);}
   finally{if(request===current)request=null;}
   await delay(400);
  }
 }
 function start(){if(allowed&&!blocked&&!running)running=run().catch(()=>{state='unavailable';report();}).finally(()=>{running=null;if(allowed&&!blocked&&!['ready','partial','unavailable'].includes(state))start();});return running;}
 function pause(){allowed=false;if(!['ready','storage','partial','unavailable'].includes(state))state='paused';request?.abort();report();}
 return {source,select(url){if(selected!==url){request?.abort();selected=known.has(url)?url:null;}},resume(){allowed=true;return start();},retry(){failed.clear();blocked=false;state='paused';return start();},pause,snapshot:()=>({ready:streams.filter(url=>done.has(url)).length,total:videos.length,state})};
}
export const wallpaperPreparation=createWallpaperPreparation({notify:detail=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('neon-wallpaper-preparation',{detail}));}});
