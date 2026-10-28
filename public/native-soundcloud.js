import {createSoundCloudWidget} from './soundcloud-widget.js';
import {catalogueSong,collectionURL,publicSoundCloudClient} from './music-library.js';

export function createNativeSoundCloudMusic(getController,host,status,options={}){
 const player=createSoundCloudWidget({host,status,ended:options.ended});
 let songs=[],collections=[],query='',kind='songs',offset=0,more=false,busy=false,version=0,request,clientPromise,keyPromise;const searchCache=new Map();
 const catalogue=()=>({songs,collections,url:'',more,busy,query,kind});
 const notify=()=>options.catalogueChanged?options.catalogueChanged(catalogue()):window.dispatchEvent(new CustomEvent('neon-music-catalogue',{detail:catalogue()}));
 const client=()=>clientPromise??=(async()=>{const c=(await getController()).transport;if(c.ready===false)await c.init();return c;})().catch(error=>{clientPromise=null;throw error;});
 async function textAt(c,url,signal,max=3000000){
  const response=await c.request(new URL(url),'GET',null,[],signal);const headers=new Headers(response.headers);
  if(response.status!==200){await response.body?.cancel?.();throw Error(response.status===429?'SoundCloud is busy. Wait a moment before searching again.':'SoundCloud search is unavailable. Try again shortly.');}
  if(Number(headers.get('content-length'))>max){await response.body?.cancel?.();throw Error('SoundCloud returned too much search data.');}
  const text=await new Response(response.body).text();if(text.length>max)throw Error('SoundCloud search data is too large.');return text;
 }
 async function load(append=false){
  if(append&&(!more||busy))return;
  const attempt=++version;request?.abort();request=new AbortController();const signal=AbortSignal.any([request.signal,AbortSignal.timeout(45000)]);
  const searchQuery=query,searchKind=kind;busy=true;if(!append){songs=[];collections=[];offset=0;}status(append?'Loading more songs...':'Searching SoundCloud...');notify();
  try{
   const cacheKey=JSON.stringify([searchQuery,searchKind,offset]),saved=searchCache.get(cacheKey);let result;
   if(saved&&saved.until>Date.now())result=saved.data;
   else{
    if(options.request||typeof window!=='undefined'){
     const response=await (options.request||fetch)('/api/music?'+new URLSearchParams({q:searchQuery,type:searchKind,offset:String(offset)}),{signal});
     if(response.status!==404){const data=await response.json();if(!response.ok)throw Error(data.error||'Music search could not connect.');result=data;}
    }
    if(!result){const c=await client();
     keyPromise??=(async()=>{const discoverySignal=AbortSignal.timeout(30000),html=await textAt(c,'https://soundcloud.com/search/sounds?q='+encodeURIComponent(searchQuery),discoverySignal,8000000);return publicSoundCloudClient(c,html,url=>textAt(c,url,discoverySignal,8000000));})().catch(error=>{keyPromise=null;throw error;});
     const id=await keyPromise;if(signal.aborted)throw signal.reason;
     const params=new URLSearchParams({q:searchQuery,client_id:id,limit:'30',offset:String(offset),linked_partitioning:'1'});
     result=JSON.parse(await textAt(c,'https://api-v2.soundcloud.com/search/'+(searchKind==='sets'?'playlists':'tracks')+'?'+params,signal));
    }
    if(searchCache.size>=24)searchCache.delete(searchCache.keys().next().value);searchCache.set(cacheKey,{data:result,until:Date.now()+60000});
   }
   if(attempt!==version)return;const rows=Array.isArray(result.collection)?result.collection:[];more=!!result.next_href&&rows.length>0;offset+=rows.length;
   if(searchKind==='sets'){const seen=new Set(collections.map(t=>t.url));for(const row of rows){const url=collectionURL(row.permalink_url);if(url&&!seen.has(url)){seen.add(url);collections.push({url,title:row.title,artist:row.user?.username||'SoundCloud',thumb:row.artwork_url||row.tracks?.[0]?.artwork_url||''});}}}
   else{const seen=new Set(songs.map(t=>t.id));for(const row of rows){const track=catalogueSong(row);if(track&&row.streamable!==false&&!seen.has(track.id)){seen.add(track.id);songs.push(track);}}}
   status(songs.length||collections.length?'':'No available results. Try another search.');
  }catch(error){if(attempt===version&&!request.signal.aborted)status(error.name==='TimeoutError'?'SoundCloud took too long. Try searching again.':error.message);}
  finally{if(attempt===version){busy=false;notify();}}
 }
 return {...player,catalog:catalogue,open(){status('Choose a song or search SoundCloud.');return Promise.resolve();},search(text,type='songs'){query=String(text).trim().slice(0,120);kind=type==='sets'?'sets':'songs';return load();},loadMore(){return load(true);},stop(){++version;request?.abort();busy=false;player.stop();},reload(){return player.state().song?player.reload():query?load():Promise.resolve();}};
}
