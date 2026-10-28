import {playlistSong} from './playlist-player.js';
import {soundcloudTrackURL,isGoPlusTrack} from './soundcloud-tracks.js';
export function collectionURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||!['soundcloud.com','www.soundcloud.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/[-\w]+\/sets\/[-\w]+\/?$/.test(u.pathname))return null;return 'https://soundcloud.com'+u.pathname.replace(/\/$/,'');}catch{return null;}}
export function catalogueSong(row){
 const url=soundcloudTrackURL(row?.permalink_url||row?.url||row?.id);if(!url||isGoPlusTrack(row))return null;
 try{return playlistSong({id:'sc:'+new URL(url).pathname.slice(1).replace('/',':'),title:row.title||row.name,artist:row.user?.username||row.artist||'',thumb:row.artwork_url||row.cover||row.thumb||'',duration:row.permalink_url?(row.full_duration||row.duration||0)/1000:row.duration||0});}catch{return null;}
}
export function collectionData(html){
 if(typeof html!=='string'||html.length>8000000)throw Error('This SoundCloud playlist is too large to read.');
 const match=/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/.exec(html);let data;
 try{data=JSON.parse(match?.[1]||'[]').find(row=>row.hydratable==='playlist')?.data;}catch{}
 if(!data||!Array.isArray(data.tracks))throw Error('This public playlist could not be read. Private or removed playlists cannot be imported.');
 return data;
}
export function parseCollection(html,resolved=[]){
 const data=collectionData(html),byId=new Map(resolved.map(track=>[String(track.id),track]));
 const entries=data.tracks.map(track=>track.title&&track.permalink_url?track:byId.get(String(track.id))||track);
 if(entries.length!==data.track_count||entries.some(row=>!row.title||!row.permalink_url))throw Error('SoundCloud has not provided every song in this playlist. Nothing was imported; try a smaller public playlist.');
 const tracks=[],seen=new Set();let skipped=0,duplicates=0;
 for(const row of entries){const song=catalogueSong(row);if(!song||row.streamable===false||row.public===false){skipped++;continue;}if(seen.has(song.id)){duplicates++;continue;}seen.add(song.id);tracks.push(song);}
 return {title:String(data.title||'SoundCloud playlist').slice(0,200),tracks,total:data.tracks.length,skipped,duplicates};
}
export function mergeImportedTracks(existing,incoming,limit=100){
 const tracks=existing.map(playlistSong),seen=new Set(tracks.map(song=>song.id));let duplicates=0;
 for(const value of incoming){const song=playlistSong(value);if(seen.has(song.id)){duplicates++;continue;}seen.add(song.id);tracks.push(song);}
 if(tracks.length>limit)throw Error(`This would make ${tracks.length} songs. Neon playlists currently hold ${limit}; nothing was added. Choose an empty playlist or a smaller SoundCloud collection.`);
 return {tracks,added:tracks.length-existing.length,duplicates};
}
const publicClients=new WeakMap();
export function publicSoundCloudClient(client,html,textAt){
 if(!publicClients.has(client))publicClients.set(client,(async()=>{const scripts=[...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"<>]+\.js)"/g)].map(m=>m[1]).slice(-5);for(const script of scripts){const source=await textAt(script);const match=/client_id\s*:\s*["']([a-zA-Z0-9]{32})/.exec(source);if(match)return match[1];}throw Error('SoundCloud song details are unavailable right now.');})().catch(error=>{publicClients.delete(client);throw error;}));
 return publicClients.get(client);
}
export async function loadSoundCloudCollection(value,getController){
 const url=collectionURL(value);if(!url)throw Error('Choose a public SoundCloud playlist link.');
 if(typeof window!=='undefined'){const response=await fetch('/api/music?'+new URLSearchParams({collection:url}),{signal:AbortSignal.timeout(45000)});if(response.status!==404){const data=await response.json();if(!response.ok)throw Error(data.error||'This playlist could not load.');return data;}}
 const client=(await getController()).transport;if(client.ready===false)await client.init();
 const result=await client.request(new URL(url),'GET',null,[],AbortSignal.timeout(45000));
 if(result.status!==200){await result.body?.cancel?.();throw Error('This SoundCloud playlist is unavailable.');}
 if(Number(new Headers(result.headers).get('content-length'))>8000000){await result.body?.cancel?.();throw Error('This playlist is too large to read.');}
 const html=await new Response(result.body).text(),data=collectionData(html),missing=data.tracks.filter(track=>!track.title||!track.permalink_url);
 if(data.track_count>100)throw Error(`This collection has ${data.track_count} songs. Neon playlists currently hold 100; nothing was added. Choose a smaller public collection.`);
 if(!missing.length)return parseCollection(html);
 // These are the public web client's metadata requests. No user token or
 // private playlist access is requested, and provider errors are not bypassed.
 async function textAt(url,max=3000000){const r=await client.request(new URL(url),'GET',null,[],AbortSignal.timeout(45000));if(r.status!==200||Number(new Headers(r.headers).get('content-length'))>max){await r.body?.cancel?.();throw Error('SoundCloud could not provide all song details. Nothing was imported.');}const text=await new Response(r.body).text();if(text.length>max)throw Error('SoundCloud metadata is too large.');return text;}
 const clientId=await publicSoundCloudClient(client,html,textAt),resolved=[];
 for(let index=0;index<missing.length;index+=50){const ids=missing.slice(index,index+50).map(row=>row.id);if(ids.some(id=>!/^\d{1,20}$/.test(String(id))))throw Error('Invalid playlist song reference.');const response=JSON.parse(await textAt('https://api-v2.soundcloud.com/tracks?ids='+ids.join(',')+'&client_id='+encodeURIComponent(clientId)));if(!Array.isArray(response))throw Error('SoundCloud song details are unavailable.');resolved.push(...response);}
 return parseCollection(html,resolved);
}
