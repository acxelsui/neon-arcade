const origin='https://x-client.x-network.lol';
const playerRoute=/^\/[a-f0-9]{24}\/play\/([a-f0-9]{24})$/i;
const goodSession=value=>typeof value==='string'&&value.length>0&&!['undefined','null'].includes(value)&&/^[a-zA-Z0-9._~-]{1,500}$/.test(value);
// Scramjet's CSS import rewriter expects whitespace after the at-keyword.
// Preserve quoted values and comments; normalize only actual compact imports.
export function normalizeBlooketCss(css){return css.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@import(?=["'])/gi,token=>token.toLowerCase()==='@import'?'@import ':token);}
// Session data stays inside this frame and is never logged or cached.
export function blooketTransport(transport){
 const request=transport.request.bind(transport),methods=new Map();let player=null,session=null,page=null;
 function remember(remote,response){if(remote.origin!==origin)return;const fromQuery=remote.searchParams.get('session');if(goodSession(fromQuery))session=fromQuery;for(const [key,value] of response.headers)if(key.toLowerCase()==='set-cookie'&&value.startsWith('_xclient_session=')){const candidate=value.slice('_xclient_session='.length).split(';')[0];if(goodSession(candidate))session=candidate;}}
 async function adapted(remote,method,body,headers,signal){
  if(remote.origin!==origin)return request(remote,method,body,headers,signal);
  if(/\/play\/undefined$/.test(remote.pathname)&&page&&remote.pathname.split('/')[1]===new URL(page).pathname.split('/')[1]){remote=new URL(page);}
  if(method==='POST'&&/^\/matchmake\/joinById\//.test(remote.pathname)&&player){headers=headers.map(pair=>[...pair]).filter(([key])=>key.toLowerCase()!=='x-xclient-session-id');headers.push(['X-Xclient-Session-Id',session||player]);const authorization=headers.find(([key])=>key.toLowerCase()==='authorization');if(authorization&&/^(?:Bearer )?(?:undefined|null)$/i.test(authorization[1]))authorization[1]='Bearer '+player;}
  const response=await request(remote,method,body,headers,signal);remember(remote,response);
  if(method==='GET'&&remote.pathname.startsWith('/_b/ac.blooket.com/')&&remote.pathname.endsWith('.css')&&response.status===200&&new Headers(response.headers).get('content-type')?.startsWith('text/css')&&response.body){const css=normalizeBlooketCss(await new Response(response.body).text());return {...response,body:new Blob([css],{type:'text/css'}).stream()};}
  if(method!=='POST'||remote.pathname!=='/play'||!new Headers(response.headers).get('content-type')?.startsWith('text/x-component')||!response.body)return response;
  const bytes=new Uint8Array(await new Response(response.body).arrayBuffer());
  if(bytes.length<=10000)for(const line of new TextDecoder().decode(bytes).split('\n')){const match=/^\d+:(\{.*\})$/.exec(line);if(!match)continue;try{const result=JSON.parse(match[1]);if(result.status!=='SUCCESS'||typeof result.message!=='string')continue;const url=new URL(result.message,origin),route=playerRoute.exec(url.pathname);if(url.origin===origin&&route){player=route[1];page=url.href;const candidate=url.searchParams.get('session');if(goodSession(candidate))session=candidate;}}catch{}}
  return {...response,body:new Blob([bytes]).stream()};
 }
 function socketURL(url,base){const remote=new URL(url,base);
  if(['ws:','wss:'].includes(remote.protocol)&&remote.hostname.endsWith('.blooket.com')&&!['cdn.blooket.com','media.blooket.com'].includes(remote.hostname)&&!remote.username&&!remote.password&&!remote.port){const host=remote.hostname;remote.protocol='wss:';remote.hostname='x-client.x-network.lol';remote.pathname='/_ws/'+host+remote.pathname;}
  if(remote.protocol==='wss:'&&remote.hostname==='x-client.x-network.lol'&&/^\/_ws\/(?:[a-z0-9-]+\.)+blooket\.com\//i.test(remote.pathname)&&!remote.port&&!remote.username&&!remote.password){if(!remote.searchParams.has('xclientSessionId')&&(session||player))remote.searchParams.set('xclientSessionId',session||player);if(player&&['undefined','null'].includes(remote.searchParams.get('_authToken')))remote.searchParams.set('_authToken',player);}
  return remote.href;
 }
 return new Proxy(transport,{get(target,key){if(key==='request')return adapted;if(key==='socketURL')return socketURL;if(key==='repairPage')return url=>url.origin===origin&&page&&/\/play\/undefined$/.test(url.pathname)&&url.pathname.split('/')[1]===new URL(page).pathname.split('/')[1]?page:null;if(key==='dispose')return ()=>{player=session=page=null;};const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(!methods.has(key))methods.set(key,value.bind(target));return methods.get(key);}});
}
export function attachBlooketSocket(frame,adapter,tap){
 const installed=new WeakSet();tap(frame.hooks.init.post,({client,window:win,isTopLevel})=>{
  if(!isTopLevel||client.url.origin!==origin)return;const repaired=adapter.repairPage(client.url);if(repaired){frame.go(repaired);return;}
  const Original=win.WebSocket;if(installed.has(Original))return;
  function BlooketSocket(url,protocols){if(!new.target)throw new TypeError('WebSocket requires new');const target=adapter.socketURL(String(url),client.url.href);return protocols===undefined?new Original(target):new Original(target,protocols);}
  Object.setPrototypeOf(BlooketSocket,Original);BlooketSocket.prototype=Original.prototype;installed.add(BlooketSocket);win.WebSocket=BlooketSocket;
 });
}

