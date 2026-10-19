import {youtubeVideo} from './youtube-search.js';
export function tubeAdRequest(value){
 try{const url=new URL(value),host=url.hostname.toLowerCase();return ['doubleclick.net','googlesyndication.com','googleadservices.com'].some(domain=>host===domain||host.endsWith('.'+domain))||(['youtube.com','www.youtube.com'].includes(host)&&/^\/(?:pagead\/|api\/stats\/ads(?:$|\/)|get_midroll_info(?:$|\/))/.test(url.pathname));}catch{return false;}
}
export function tubeDestination(value,base='https://www.youtube.com/'){
 const video=youtubeVideo(value,base);if(video)return {type:'video',video};
 try{const url=new URL(value,base);if(url.protocol!=='https:'||url.username||url.password||!['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname))return null;
 if(/^\/(?:results|playlist|channel\/[^/]+|@[^/]+(?:\/videos)?|user\/[^/]+|c\/[^/]+)$/.test(url.pathname))return {type:'browse',url:url.href};
 }catch{}return null;
}
export function cleanTubeLibrary(value){
 const clean=rows=>Array.isArray(rows)?rows.slice(0,100).flatMap(row=>{const video=youtubeVideo(row?.url);if(!video)return [];return [{id:video.id,url:video.watch,title:String(row.title||'YouTube video').slice(0,180),at:Number.isFinite(row.at)?row.at:0}]}):[];
 return {history:clean(value?.history),playlists:Array.isArray(value?.playlists)?value.playlists.slice(0,20).filter(list=>typeof list?.name==='string').map(list=>({name:list.name.slice(0,50),videos:clean(list.videos)})):[]};
}
