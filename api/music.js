function soundcloudLink(value){
 const url=new URL(value);
 if(url.origin!=='https://soundcloud.com'||url.username||url.password||!/^\/[-\w]+\/[-\w]+$/.test(url.pathname))throw Error('Invalid SoundCloud track');
 return url.origin+url.pathname;
}

export function createMusicHandler({env=process.env,request=fetch}={}){
 let token='',refresh='',expires=0,pending;
 const cache=new Map(),attempts=new Map();
 async function accessToken(){
  if(token&&Date.now()<expires)return token;
  if(pending)return pending;
  pending=(async()=>{
   const body=new URLSearchParams(refresh?{grant_type:'refresh_token',refresh_token:refresh,client_id:env.SOUNDCLOUD_CLIENT_ID,client_secret:env.SOUNDCLOUD_CLIENT_SECRET}:{grant_type:'client_credentials'});
   const headers={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
   if(!refresh)headers.Authorization='Basic '+Buffer.from(env.SOUNDCLOUD_CLIENT_ID+':'+env.SOUNDCLOUD_CLIENT_SECRET).toString('base64');
   const response=await request('https://secure.soundcloud.com/oauth/token',{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok){if(response.status===400||response.status===401)refresh='';throw Error('SoundCloud authentication failed. Check the server credentials or try later.')}
   const data=await response.json();if(!data.access_token)throw Error('SoundCloud did not provide an access token.');
   token=data.access_token;refresh=data.refresh_token||'';expires=Date.now()+Math.max(0,(Number(data.expires_in)||3600)-60)*1000;return token;
  })().finally(()=>pending=null);return pending;
 }
 return async function music(req,res){
  res.setHeader('Cache-Control','no-store');
  const reply=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))};
  if(req.method!=='GET'){res.setHeader('Allow','GET');return reply(405,{error:'Use GET to search music.'})}
  const params=new URL(req.url,'http://localhost').searchParams;
  const configured=Boolean(env.SOUNDCLOUD_CLIENT_ID&&env.SOUNDCLOUD_CLIENT_SECRET);
  if(params.get('status')==='1')return reply(200,{configured});
  if(!configured)return reply(503,{error:'SoundCloud search is not connected yet. The site owner needs to add SoundCloud API credentials.'});
  const q=(params.get('q')||'').trim(),offset=Number(params.get('offset')||0);
  if(q.length<2||q.length>150||!Number.isInteger(offset)||offset<0||offset>900)return reply(400,{error:'Enter 2–150 characters to search SoundCloud.'});
  const now=Date.now(),ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
  for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
  const bucket=attempts.get(ip)||{count:0,until:now+60000};
  if(bucket.count>=30)return reply(429,{error:'Please wait a minute before searching again.'});
  bucket.count++;attempts.set(ip,bucket);
  const key=q.toLowerCase()+':'+offset,cached=cache.get(key);if(cached&&cached.until>now)return reply(200,cached.data);
  try{
   const auth=await accessToken();
   const query=new URLSearchParams({q,limit:'30',offset:String(offset),linked_partitioning:'true',access:'playable'});
   const response=await request('https://api.soundcloud.com/tracks?'+query,{headers:{Authorization:'OAuth '+auth,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
   if(response.status===401){token='';expires=0;return reply(502,{error:'SoundCloud session expired. Please search again.'})}
   if(response.status===429)return reply(429,{error:'SoundCloud is busy. Please try again later.'});
   if(!response.ok)throw Error('SoundCloud search is unavailable right now. Please try again.');
   const data=await response.json(),rows=Array.isArray(data)?data:data.collection;
   if(!Array.isArray(rows))throw Error('SoundCloud returned an unexpected response.');
   const tracks=rows.flatMap(t=>{try{
    if(t.streamable===false||t.access==='blocked')return [];
    const url=soundcloudLink(t.permalink_url);let cover=t.artwork_url||t.user?.avatar_url||'';
    if(!/^https:\/\/[^/]+\.sndcdn\.com\//.test(cover))cover='';
    return [{id:String(t.urn||t.id),url,name:String(t.title||'Untitled').slice(0,200),artist:String(t.metadata_artist||t.user?.username||'SoundCloud artist').slice(0,200),cover,provider:'SoundCloud',duration:Number(t.duration)||0}];
   }catch{return []}});
   const result={tracks,nextOffset:offset<900&&(data.next_href||Array.isArray(data)&&rows.length===30)?offset+30:null};
   if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{data:result,until:now+60000});return reply(200,result);
  }catch(error){return reply(502,{error:error.name==='TimeoutError'?'SoundCloud took too long. Please try again.':error.message.startsWith('SoundCloud')?error.message:'Could not connect to SoundCloud. Please try again.'})}
 };
}
export default createMusicHandler();
