import {collectionURL,collectionData,parseCollection,publicSoundCloudClient} from '../public/music-library.js';
export function createMusicHandler({request=fetch,clock=Date.now}={}){
 const cache=new Map();let client={},key,keyUntil=0;
 async function text(url,max=8000000){
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json,text/html,*/*'}});
  if(!response.ok){if([401,403].includes(response.status)){key=null;client={};}const error=Error(response.status===429?'SoundCloud is busy. Please try again shortly.':'SoundCloud is unavailable right now.');error.status=response.status===429?429:502;throw error;}
  if(Number(response.headers.get('content-length'))>max)throw Error('SoundCloud response is too large.');
  const reader=response.body.getReader(),parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw Error('SoundCloud response is too large.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return new TextDecoder().decode(Buffer.concat(parts));
 }
 async function clientId(){if(key&&clock()>keyUntil){key=null;client={};}if(!key){keyUntil=clock()+1800000;key=(async()=>publicSoundCloudClient(client,await text('https://soundcloud.com/search/sounds?q=music'),url=>text(url)))().catch(error=>{key=null;throw error;});}return key;}
 return async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':status===200?'public, s-maxage=60, stale-while-revalidate=120':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  if(req.method!=='GET')return reply(405,{error:'Use GET.'});
  try{
   const params=new URL(req.url,'https://neon.invalid').searchParams,collection=params.get('collection');
   let cacheKey,result;
   if(collection){const url=collectionURL(collection);if(!url)return reply(400,{error:'Choose a public SoundCloud playlist.'});cacheKey=url;
    const saved=cache.get(cacheKey);if(saved&&saved.until>clock())return reply(200,saved.data);
    const html=await text(url),data=collectionData(html);
    if(data.track_count>100)return reply(422,{error:'This collection has more than 100 songs. Choose a smaller collection.'});
    const missing=data.tracks.filter(t=>!t.title||!t.permalink_url),resolved=[];
    if(missing.length){const id=await clientId();for(let n=0;n<missing.length;n+=50){const ids=missing.slice(n,n+50).map(t=>String(t.id));if(ids.some(id=>!/^\d{1,20}$/.test(id)))throw Error('Invalid track reference.');const tracks=JSON.parse(await text('https://api-v2.soundcloud.com/tracks?ids='+ids.join(',')+'&client_id='+id));if(!Array.isArray(tracks))throw Error('Playlist tracks are unavailable.');resolved.push(...tracks);}}
    result=parseCollection(html,resolved);
   }else{
    const q=params.get('q')?.trim(),type=params.get('type')||'songs',offset=Number(params.get('offset')||0);
    if(!q||q.length>120||!['songs','sets'].includes(type)||!Number.isInteger(offset)||offset<0||offset>10000)return reply(400,{error:'Enter a valid music search.'});
    cacheKey=JSON.stringify([q,type,offset]);const saved=cache.get(cacheKey);if(saved&&saved.until>clock())return reply(200,saved.data);
    const id=await clientId(),search=new URLSearchParams({q,client_id:id,limit:'30',offset:String(offset),linked_partitioning:'1'});
    result=JSON.parse(await text('https://api-v2.soundcloud.com/search/'+(type==='sets'?'playlists':'tracks')+'?'+search));
    if(!Array.isArray(result.collection))throw Error('SoundCloud search returned no readable data.');
   }
   if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(cacheKey,{data:result,until:clock()+60000});reply(200,result);
  }catch(error){reply(error.status||502,{error:error.message||'Music could not load. Please try again.'});}
 };
}
export default createMusicHandler();
