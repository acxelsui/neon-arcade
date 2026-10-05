// Cache only explicitly public code/image/font assets. Accounts, cookies, saves,
// API replies and rewritten documents remain on the existing transport.
(() => {
 const CACHE='neon-public-proxy-assets-v1',STAMP='x-neon-asset-expires',SIZE='x-neon-asset-bytes';
 const varyAllowed=new Set(['accept','accept-encoding','accept-language','origin','user-agent']);
 const publicHeaders=new Set(['accept','accept-encoding','accept-language','origin','referer','user-agent','cache-control','pragma','connection','host','dnt','priority','sec-gpc','upgrade-insecure-requests']);
 function candidate(remote,method,body,headers){
  if(method!=='GET'||body!=null||remote.protocol!=='https:'||remote.username||remote.password)return false;
  if(!/\.(?:m?js|css|wasm|woff2?|ttf|otf|data|pck|unityweb|png|jpe?g|webp|avif|gif|svg)$/i.test(remote.pathname)||/\/(?:api|accounts?|auth|login|saves?|profile)(?:\/|$)/i.test(remote.pathname))return false;
  if([...remote.searchParams.keys()].some(key=>/(?:token|sign|auth|cookie|credential|key|user|account|session)/i.test(key)))return false;
  const h=new Headers(headers);
  if(['cookie','authorization','proxy-authorization','range','x-api-key'].some(name=>h.has(name)))return false;
  // Unknown headers can carry a site's custom login/session credentials.
  if([...h.keys()].some(name=>!publicHeaders.has(name)&&!/^sec-(?:fetch|ch)-/.test(name)))return false;
  return !/no-store/i.test(h.get('cache-control')||'');
 }
 function ttl(response){
  if(response.status!==200)return 0;
  const h=new Headers(response.headers),policy=h.get('cache-control')||'';
  if(!/(?:^|,)\s*public\s*(?:,|$)/i.test(policy)||/(?:no-store|no-cache|private)/i.test(policy)||h.has('set-cookie')||h.has('set-cookie2'))return 0;
  const vary=(h.get('vary')||'').split(',').map(name=>name.trim().toLowerCase()).filter(Boolean);
  if(vary.some(name=>!varyAllowed.has(name)))return 0;
  if(!/^(?:text\/css|(?:text|application)\/(?:javascript|x-javascript)|application\/(?:wasm|octet-stream|font-woff)|font\/|image\/)/i.test(h.get('content-type')||''))return 0;
  const age=Number(h.get('age')||0),max=Number(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(policy)?.[1]);
  return Number.isFinite(age)&&age>=0&&max>age?Math.min(max-age,86400)*1000:0;
 }
 function key(remote,headers){return new Request(remote.href,{headers:headers.filter(([name])=>varyAllowed.has(name.toLowerCase())),credentials:'omit'});}
 globalThis.neonCreatePublicAssetCache=function({storage=globalThis.caches,now=Date.now,maxFile=8*1024*1024,maxTotal=64*1024*1024,maxEntries=128}={}){
  let opened,queue=Promise.resolve();const jobs=new Set();
  const cache=()=>opened??=storage?.open(CACHE).catch(()=>null)||Promise.resolve(null);
  function write(operation){const work=queue.then(operation).catch(()=>{});queue=work;return work;}
  function track(job){jobs.add(job);job.finally(()=>jobs.delete(job));}
  async function read(request){
   try{const saved=await cache(),response=await saved?.match(request);
    if(!response)return null;
    if(!(Number(response.headers.get(STAMP))>now())){await write(()=>saved.delete(request));return null;}
    const headers=new Headers(response.headers);headers.delete(STAMP);headers.delete(SIZE);
    return {body:response.body,headers:[...headers],status:200,statusText:response.statusText};
   }catch{return null;}
  }
  async function save(request,stream,response,expires){
   const reader=stream.getReader(),chunks=[];let bytes=0;
   try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxFile){reader.cancel().catch(()=>{});return;}chunks.push(part.value);}
    if(!bytes||expires<=now())return;
    const saved=await cache();if(!saved)return;
    const headers=new Headers(response.headers);headers.set(STAMP,String(expires));headers.set(SIZE,String(bytes));headers.set('content-length',String(bytes));
    await write(async()=>{
     let total=0;const rows=[];
     for(const oldKey of await saved.keys()){const entry=await saved.match(oldKey);const size=Number(entry?.headers.get(SIZE));if(!(size>0)||!(Number(entry.headers.get(STAMP))>now())){await saved.delete(oldKey);continue;}total+=size;rows.push({key:oldKey,size});}
     // Existing insertion order keeps eviction predictable. Only this cache is touched.
     while(rows.length&&(total+bytes>maxTotal||rows.length>=maxEntries)){const old=rows.shift();await saved.delete(old.key);total-=old.size;}
     if(bytes<=maxTotal)await saved.put(request,new Response(new Blob(chunks),{status:200,statusText:response.statusText,headers}));
    });
   }catch{reader.cancel().catch(()=>{});}
  }
  return {
   wrap(transport){
    const request=transport.request.bind(transport);
    transport.request=async(remote,method,body,headers,signal)=>{
     if(signal?.aborted)throw new DOMException('Request canceled','AbortError');
     if(!storage||!candidate(remote,method,body,headers))return request(remote,method,body,headers,signal);
     const requestHeaders=new Headers(headers),reload=/(?:no-cache|max-age\s*=\s*0)/i.test(requestHeaders.get('cache-control')||'')||/no-cache/i.test(requestHeaders.get('pragma')||'');
     const requestKey=key(remote,headers),saved=reload?null:await read(requestKey);if(signal?.aborted)throw new DOMException('Request canceled','AbortError');if(saved)return saved;
     const response=await request(remote,method,body,headers,signal),lifetime=ttl(response),length=Number(new Headers(response.headers).get('content-length'));
     if(lifetime&&length>0&&length<=maxFile&&jobs.size<4&&response.body?.tee){const [live,copy]=response.body.tee();track(save(requestKey,copy,response,now()+lifetime).catch(()=>{}));return {...response,body:live};}
     return response;
    };
    return transport;
   },
   async flush(){while(jobs.size)await Promise.all([...jobs]);await queue;}
  };
 };
 globalThis.neonPublicAssetTransport=transport=>globalThis.neonCreatePublicAssetCache().wrap(transport);
})();
