const origin='https://astra-education.top';
// These IDs and labels are the provider's public Roblox server choices.
export const robloxServers=Object.freeze({
 '1':Object.freeze({label:'Server 1',gameId:'ng_roblox',provider:'quaternary'}),
 '2':Object.freeze({label:'Server 2',gameId:'roblox',provider:'tertiary'})
});
// Keep the selected game ID intact when the launcher's router reads the
// rewritten iframe address. All catalog, launch, stream, and socket requests
// continue through the original proxy client.
export function pinCloudGame(source,id){
 if(!/^as\d{4}$/.test(id||''))return source;
 return source.replace(/\{\s*proxy\s*:\s*([\w$]+)\s*,\s*embedId\s*:\s*([\w$]+)\s*\}\s*=\s*([\w$]+)\(\)/,(_,proxy,game,params)=>'{proxy:'+proxy+',embedId:'+game+'}={...'+params+'(),embedId:'+JSON.stringify(id)+'}');
}
function rewrittenResponse(response,body){
 return {...response,body:new Response(body).body,headers:[...response.headers.filter(([name])=>!['content-length','content-encoding','etag','cache-control'].includes(name.toLowerCase())),['Cache-Control','no-store']]};
}
export function cloudTransport(transport,getGameId,getServer=()=>null){
 const request=transport.request.bind(transport),methods=new Map();
 const adapted=async(remote,method,body,headers,signal)=>{
  const id=getGameId(),choice=getServer(),server=id==='as1366'&&Object.hasOwn(robloxServers,choice)?robloxServers[choice]:null;
  const launcher=method==='GET'&&remote.origin===origin&&/^\/assets\/reading-list-[\w-]+\.js$/.test(remote.pathname)&&/^as\d{4}$/.test(id||'');
  const catalog=!!server&&method==='GET'&&remote.origin===origin&&remote.pathname==='/api/cg/embed/games';
  if(server&&method==='POST'&&remote.origin===origin&&remote.pathname==='/api/cg/launch'&&body!==null){
   // Preserve the normal launch fields, including connection setup and tokens.
   // Only replace this game's default embed launch with its selected public ID.
   body=new Uint8Array(await new Response(body).arrayBuffer());
   try{const data=JSON.parse(new TextDecoder().decode(body));if(data?.embedId==='as1366'){
    delete data.embedId;data.gameId=server.gameId;body=new TextEncoder().encode(JSON.stringify(data));headers=headers.filter(([name])=>name.toLowerCase()!=='content-length');
   }}catch{}
  }
  const response=await request(remote,method,body,launcher||catalog?headers.filter(([name])=>!['if-none-match','if-modified-since'].includes(name.toLowerCase())):headers,signal);
  if(response.status!==200||(!launcher&&!catalog))return response;
  if(launcher)return rewrittenResponse(response,pinCloudGame(await new Response(response.body).text(),id));
  const bytes=new Uint8Array(await new Response(response.body).arrayBuffer());
  try{const data=JSON.parse(new TextDecoder().decode(bytes));const game=data.games?.find(game=>game.embedId==='as1366');if(game){game.provider=server.provider;return rewrittenResponse(response,JSON.stringify(data));}}catch{}
  return {...response,body:new Response(bytes).body};
 };
 return new Proxy(transport,{get(target,key){if(key==='request')return adapted;const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(!methods.has(key))methods.set(key,value.bind(target));return methods.get(key);}});
}
