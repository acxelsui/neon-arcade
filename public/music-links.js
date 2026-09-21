export function soundcloudLink(value){
  let url;
  try{url=new URL(value.trim())}catch{throw Error('Paste a full SoundCloud track or playlist link.')}
  if(url.protocol!=='https:'||!['soundcloud.com','www.soundcloud.com','m.soundcloud.com'].includes(url.hostname)||url.username||url.password)throw Error('Use a link starting with https://soundcloud.com/. For a short share link, open it and copy the full address.');
  const parts=url.pathname.split('/').filter(Boolean);
  if(!(parts.length===2||(parts.length===3&&parts[1]==='sets'))||['search','discover','you','charts','settings','upload'].includes(parts[0])||parts.some(p=>!/^[-\w]+$/.test(p)))throw Error('Choose a track or playlist link, rather than an artist or search page.');
  return 'https://soundcloud.com/'+parts.join('/');
}
export function soundcloudPlayer(url){const query=new URLSearchParams({url:soundcloudLink(url),color:'#8ddfbd',auto_play:'false',hide_related:'true',show_comments:'false',show_user:'true',show_reposts:'false',visual:'false'});return 'https://w.soundcloud.com/player/?'+query}
export function musicLink(value){
 const parsed=new URL(value.trim());
 if(parsed.hostname==='open.spotify.com'){
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Use a public Spotify or SoundCloud link.');
  const parts=parsed.pathname.split('/').filter(Boolean);if(parts[0]?.startsWith('intl-'))parts.shift();
  if(parts.length!==2||!['track','album','playlist'].includes(parts[0])||!/^\w{22}$/.test(parts[1]))throw Error('Paste a Spotify track, album, or playlist link.');
  return 'https://open.spotify.com/'+parts.join('/');
 }
 return soundcloudLink(value);
}
export function musicPlayer(value){const url=musicLink(value);return url.startsWith('https://open.spotify.com/')?url.replace('open.spotify.com/','open.spotify.com/embed/')+'?theme=0':soundcloudPlayer(url)}
