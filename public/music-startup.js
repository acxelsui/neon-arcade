export const MUSIC_URL='https://6ab87f0e6a91203ed89fa447--neoostesting.netlify.app/neo-os/music-v2/index.html?v=20260919-scholarnook-v1&theme=system-v1&widgets=live-v1&runtime=20260908-audio-performance-v1';
const base=new URL('./',MUSIC_URL);
export const musicStartupAssets=Object.freeze(['neo-lucide.js?v=20260910-clean-play-v1','neo-meting-integration.js?v=20260919-scholarnook-v1','vendor/meting-ui.js?v=20260919-scholarnook-v1','neo-meting-player.js?v=20260919-scholarnook-v1'].map(path=>new URL(path,base).href));
// This deployment address pins one immutable source snapshot. Keep at most its
// four public startup scripts in memory; audio, HTML, sessions and saves never
// enter this cache. The original virtual origin and proxy route stay the same.
export function createMusicStartup({clock=Date.now}={}){
 const saved=new Map(),pending=new Map(),known=new Set(musicStartupAssets);let warming=null;
 const publicHeaders=new Set(['accept','accept-encoding','accept-language','origin','referer','user-agent','cache-control','pragma','host','connection','dnt','priority','sec-gpc']);
 const usable=(url,method,body,headers)=>known.has(url.href)&&method==='GET'&&body==null&&!headers.some(([name,value])=>(!publicHeaders.has(name.toLowerCase())&&!/^sec-(fetch|ch)-/i.test(name))||(/^(cache-control|pragma)$/i.test(name)&&/no-store|no-cache/i.test(value)));
 function response(entry){return {...entry.meta,body:new Blob([entry.bytes]).stream()};}
 return {wrap(client){const request=client.request.bind(client);client.request=async(remote,method,body,headers,signal)=>{
   if(!usable(remote,method,body,headers))return request(remote,method,body,headers,signal);
   if(signal?.aborted)throw new DOMException('Request canceled','AbortError');
   const cached=saved.get(remote.href);if(cached&&clock()-cached.time<300000)return response(cached);
   if(pending.has(remote.href)){const entry=await pending.get(remote.href);if(signal?.aborted)throw new DOMException('Request canceled','AbortError');if(entry)return response(entry);return request(remote,method,body,headers,signal);}
   let finish;const job=new Promise(resolve=>finish=resolve);pending.set(remote.href,job);
   try{
    const result=await request(remote,method,body,headers,signal),h=new Headers(result.headers);
    if(result.status!==200||!h.get('content-type')?.toLowerCase().includes('javascript')||h.has('set-cookie')||h.has('set-cookie2')||/private|no-store|no-cache/i.test(h.get('cache-control')||'')||h.get('vary')?.split(',').some(value=>!['accept-encoding','accept-language','user-agent'].includes(value.trim().toLowerCase()))||Number(h.get('content-length'))>1000000||!result.body)return result;
    const reader=result.body.getReader(),parts=[];let count=0;
    try{while(true){const part=await reader.read();if(part.done)break;count+=part.value.byteLength;if(count>1000000)throw Error('Music startup file is too large.');parts.push(part.value);}}finally{reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
    const entry={bytes,time:clock(),meta:{...result,headers:result.headers.filter(([name])=>!['content-length','content-encoding'].includes(name.toLowerCase()))}};delete entry.meta.body;saved.set(remote.href,entry);finish(entry);return response(entry);
   }finally{finish(null);pending.delete(remote.href);}
  };return client;},
  warm(client){if(!client?.request)return Promise.resolve();return warming??=(async()=>{for(let i=0;i<musicStartupAssets.length;i+=2)await Promise.allSettled(musicStartupAssets.slice(i,i+2).map(async url=>{const result=await client.request(new URL(url),'GET',null,[['Accept','*/*']],undefined);result.body?.cancel?.().catch(()=>{});}));})().finally(()=>{warming=null;});}
 };
}
export const musicStartup=createMusicStartup();
