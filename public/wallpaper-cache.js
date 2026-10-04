// Classic service-worker helper. Reuse the existing full-quality cache as a
// stream, including video byte ranges, without copying whole movies into blobs.
globalThis.neonWallpaperCache=async function(request,storage=globalThis.caches){
 const url=new URL(request.url);
 if(request.method!=='GET'||!/^\/wallpapers\/(?:4k|4k-start|stream)\/[a-zA-Z0-9._-]+\.mp4$/.test(url.pathname)||url.search)return null;
 try{
  const cache=await storage.open('neon-wallpapers-20261004-v2');
  const response=await cache.match(url.pathname);
  if(response?.status!==200||!response.headers.get('content-type')?.toLowerCase().startsWith('video/mp4'))return null;
  const range=request.headers.get('range');if(!range)return response;
  const size=Number(response.headers.get('content-length')),match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!Number.isSafeInteger(size)||size<=0||!match||(!match[1]&&!match[2]))return null;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  const reader=response.body.getReader();let offset=0;
  const body=new ReadableStream({async pull(controller){
   try{while(true){const chunk=await reader.read();if(chunk.done){controller.close();return;}
    const next=offset+chunk.value.length;
    if(next>start){controller.enqueue(chunk.value.subarray(Math.max(0,start-offset),Math.min(chunk.value.length,end+1-offset)));offset=next;if(next>end){controller.close();await reader.cancel();}return;}offset=next;
   }}catch(error){controller.error(error);await reader.cancel().catch(()=>{});}
  },cancel(reason){return reader.cancel(reason);}});
  const headers=new Headers(response.headers);headers.set('Content-Length',String(end-start+1));headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Accept-Ranges','bytes');headers.delete('Content-Encoding');
  return new Response(body,{status:206,headers});
 }catch{return null;}
};
