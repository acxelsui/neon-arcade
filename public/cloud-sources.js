// Matched against Achroma's public Stratus and Synapse catalogs on Oct 5, 2026.
export const achromaOrigin='https://bikesense.org';
export const achromaGames=Object.freeze({
 roblox:{kind:'synapse',id:'com.roblox.client'},
 stumble:{kind:'synapse',id:'com.kitkagames.fallbuddies'},
 clash:{kind:'synapse',id:'com.supercell.clashroyale'},
 fortnite:{kind:'synapse',id:'com.epicgames.fortnite'},
 subnautica:{kind:'stratus',id:'kj0025',name:'Subnautica: Below Zero'},
 schedule:{kind:'stratus',id:'bs0024',name:'Schedule I'},
 nba:{kind:'stratus',id:'kj0107',name:'NBA 2K23'},
 tcg:{kind:'stratus',id:'kp0232',name:'TCG Card Shop'},
 raft:{kind:'stratus',id:'kj0209',name:'Raft'},
 onlyup:{kind:'stratus',id:'bs0025',name:'Only Up'},
 ranch:{kind:'stratus',id:'kj0085',name:'Ranch Simulator22'},
 cuphead:{kind:'stratus',id:'jy0146',name:'Cuphead'},
 builder:{kind:'stratus',id:'kj0135',name:'Builder Simulator'},
 eurotruck:{kind:'stratus',id:'dg0020',name:'Euro Truck Simulator 2'},
 gtav:{kind:'stratus',id:'jy0108',name:'Grand Theft Auto V'}
});
export function achromaLauncher(game){
 if(!Object.hasOwn(achromaGames,game))return null;
 const entry=achromaGames[game];
 return entry.kind==='synapse'?achromaOrigin+'/synapse/index.html?game='+encodeURIComponent(entry.id):achromaOrigin+'/neon-cloud-launcher.html?game='+encodeURIComponent(game);
}
// Serve only Neon's small launcher inside the existing proxied provider origin.
// The catalog, session API, actual game iframe, sockets and media use the relay.
export function achromaTransport(transport,localOrigin,fetchLocal=fetch){
 const request=transport.request.bind(transport),assets=new Map([
  ['/neon-cloud-launcher.html',['/cloud-launcher.html','text/html']],
  ['/neon-cloud-launcher.js',['/cloud-launcher.js','application/javascript']],
  ['/neon-cloud-session.js',['/cloud-session.js','application/javascript']]
 ]),methods=new Map();
 return new Proxy(transport,{get(target,key){
  if(key==='request')return async(remote,method,body,headers,signal)=>{
   const asset=remote.origin===achromaOrigin&&method==='GET'&&body==null?assets.get(remote.pathname):null;
   if(!asset)return request(remote,method,body,headers,signal);
   const entry=achromaGames[remote.searchParams.get('game')];
   if(remote.pathname==='/neon-cloud-launcher.html'&&(!entry||entry.kind!=='stratus'))return {status:404,statusText:'Not Found',headers:[['Content-Type','text/plain']],body:new Response('This cloud launcher is unavailable.').body};
   const response=await fetchLocal(new URL(asset[0],localOrigin),{credentials:'same-origin',signal,cache:'no-store'});
   let source=await response.text();
   if(remote.pathname==='/neon-cloud-launcher.html')source=source.replace('NEON_CLOUD_CONFIG',JSON.stringify({key:entry.id,name:entry.name}).replace(/</g,'\\u003c'));
   return {status:response.status,statusText:response.statusText,headers:[['Content-Type',asset[1]],['Cache-Control','no-store']],body:new Response(source).body};
  };
  const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
  if(!methods.has(key))methods.set(key,value.bind(target));return methods.get(key);
 }});
}
