const origin='https://astra-education.top';
// Keep the selected game ID intact when the launcher's router reads the
// rewritten iframe address. All catalog, launch, stream, and socket requests
// continue through the original proxy client.
export function pinCloudGame(source,id){
 if(!/^as\d{4}$/.test(id||''))return source;
 return source.replace(/\{\s*proxy\s*:\s*([\w$]+)\s*,\s*embedId\s*:\s*([\w$]+)\s*\}\s*=\s*([\w$]+)\(\)/,(_,proxy,game,params)=>'{proxy:'+proxy+',embedId:'+game+'}={...'+params+'(),embedId:'+JSON.stringify(id)+'}');
}
export function cloudTransport(transport,getGameId){
 const request=transport.request.bind(transport),methods=new Map();
 const adapted=async(remote,method,body,headers,signal)=>{
  const id=getGameId(),launcher=method==='GET'&&remote.origin===origin&&/^\/assets\/reading-list-[\w-]+\.js$/.test(remote.pathname)&&/^as\d{4}$/.test(id||'');
  const response=await request(remote,method,body,launcher?headers.filter(([name])=>!['if-none-match','if-modified-since'].includes(name.toLowerCase())):headers,signal);
  if(!launcher||response.status!==200)return response;
  const source=await new Response(response.body).text(),script=pinCloudGame(source,id);
  return {...response,body:new Response(script).body,headers:[...response.headers.filter(([name])=>!['content-length','content-encoding','etag','cache-control'].includes(name.toLowerCase())),['Cache-Control','no-store']]};
 };
 return new Proxy(transport,{get(target,key){if(key==='request')return adapted;const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(!methods.has(key))methods.set(key,value.bind(target));return methods.get(key);}});
}
