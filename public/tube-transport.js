const playerScript='https://bcsdny.net/~v/assets/watch.js';
// Replace only the source watch-player script. Catalogue, metadata, and video bytes
// still use the existing authenticated Wisp transport and Scramjet rewriter.
export function tubeTransport(transport,script){
 const request=transport.request.bind(transport),wrapped=Object.create(transport);
 wrapped.request=async(remote,method,body,headers,signal)=>{
  if(remote.origin==='https://bcsdny.net'&&remote.pathname===new URL(playerScript).pathname&&method==='GET'){
   if(signal?.aborted)throw new DOMException('Request canceled','AbortError');
   return {body:new Response(script).body,headers:[['Content-Type','application/javascript; charset=utf-8'],['Cache-Control','no-store']],status:200,statusText:'OK'};
  }
  return request(remote,method,body,headers,signal);
 };
 return wrapped;
}
