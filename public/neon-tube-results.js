const validId=/^[a-zA-Z0-9_-]{11}$/;
const text=value=>typeof value==='string'?value:value?.simpleText||value?.runs?.map(run=>run.text||'').join('')||'';
export function tubeUploadAge(value){
 if(/just now/i.test(value))return 0;
 const match=/(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|mo|[smhdwy])(?:\s|$)/i.exec(value||'');
 if(!match)return Infinity;const unit=match[2].toLowerCase();const multiplier=unit==='mo'||unit.startsWith('month')?2592000:unit==='m'||unit.startsWith('minute')?60:unit==='h'||unit.startsWith('hour')?3600:unit==='d'||unit.startsWith('day')?86400:unit==='w'||unit.startsWith('week')?604800:unit==='y'||unit.startsWith('year')?31536000:1;
 return Number(match[1])*multiplier;
}
// Public search metadata only. Never manufacture upload ages or view counts.
export function tubeSearchResults(data){
 const results=[],seen=new Set();let visited=0;
 function walk(value,depth=0){
  if(!value||typeof value!=='object'||depth>40||++visited>20000||results.length>=60)return;
  for(const kind of ['videoRenderer','gridVideoRenderer','videoWithContextRenderer']){
   const item=value[kind];if(!item||!validId.test(item.videoId||'')||seen.has(item.videoId))continue;
   const title=text(item.title);if(!title)continue;seen.add(item.videoId);
   results.push({id:item.videoId,title:title.slice(0,180),channel:text(item.ownerText||item.shortBylineText||item.longBylineText).slice(0,150),published:text(item.publishedTimeText).slice(0,100),views:text(item.shortViewCountText||item.viewCountText).slice(0,100),duration:text(item.lengthText).slice(0,30)});
  }
  for(const [key,item] of Object.entries(value)){if(/adSlot|promoted|displayAd|adPlacement/i.test(key))continue;if(Array.isArray(item))for(const entry of item)walk(entry,depth+1);else if(item&&typeof item==='object')walk(item,depth+1);}
 }
 walk(data);return results;
}

export function tubeResultsFromHTML(html){
 if(typeof html!=='string'||html.length>12000000)return [];
 const marker=/(?:\bytInitialData|window\["ytInitialData"\])\s*=\s*/g;let match;
 while((match=marker.exec(html))){
  const start=marker.lastIndex;if(html[start]!=='{')continue;let depth=0,string=false,escape=false;
  for(let i=start;i<html.length;i++){const char=html[i];if(string){if(escape)escape=false;else if(char==='\\')escape=true;else if(char==='"')string=false;continue}if(char==='"')string=true;else if(char==='{')depth++;else if(char==='}'&&--depth===0){try{const videos=tubeSearchResults(JSON.parse(html.slice(start,i+1)));if(videos.length)return videos}catch{}break;}}
 }
 return [];
}

export async function fetchTubeResults(transport,value,signal){
 let url=new URL(value);
 for(let attempt=0;attempt<4;attempt++){
  if(url.protocol!=='https:'||!['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname)||url.pathname!=='/results')throw Error('YouTube requires verification or redirected outside video search. Try again later.');
  const response=await transport.request(url,'GET',null,[['Accept','text/html'],['Accept-Language','en-US,en;q=0.9']],signal);
  if(response.status>=300&&response.status<400){const location=new Headers(response.headers).get('location');if(!location)throw Error('YouTube search could not load.');await response.body?.cancel?.();url=new URL(location,url);continue;}
  const html=await new Response(response.body).text();
  if(response.status>=400)throw Error('YouTube search is unavailable ('+response.status+'). Try again later.');
  const videos=tubeResultsFromHTML(html);if(videos.length)return videos;
  if(/unusual traffic from your computer network|Sign in to confirm you.re not a bot/i.test(html))throw Error('YouTube is requiring verification. Neon Tube cannot bypass it.');
  throw Error('No videos were returned. Try another search or paste a video link.');
 }
 throw Error('YouTube redirected too many times. Try again later.');
}
