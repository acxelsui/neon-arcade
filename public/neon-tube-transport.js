// Identify the actual embedding Neon origin as required by YouTube's player.
// Leave media, API, cookie and verification requests on the existing transport.
export function tubePlayerTransport(transport,embeddingOrigin){
 const origin=new URL(embeddingOrigin).origin,wrapped=Object.create(transport);
 const request=transport.request.bind(transport);
 wrapped.request=(remote,method,body,headers,signal)=>{
  if(['www.youtube-nocookie.com','www.youtube.com'].includes(remote.hostname)&&/^\/embed\/[a-zA-Z0-9_-]{11}$/.test(remote.pathname)){
   const updated=new Headers(headers);updated.set('Referer',origin+'/');headers=[...updated];
  }
  return request(remote,method,body,headers,signal);
 };
 return wrapped;
}
