export const musicArtworkOrigin='https://cirrusbk6l.planet35.com';
export function songArtwork(value){
 for(const item of [value?.thumb,value?.thumbnail,value?.cover]){
  if(typeof item!=='string'||!item.trim()||item.length>2000)continue;
  try{const raw=item.trim();if(raw.startsWith('/')&&!raw.startsWith('/_o/m/cover/'))continue;const url=new URL(raw,musicArtworkOrigin);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
 }
 return '';
}
export function playlistSong(value){
 if(!value||typeof value.id!=='string'||!/^[a-zA-Z0-9:_-]{1,160}$/.test(value.id)||typeof value.title!=='string'||!value.title.trim()||value.title.length>200)throw Error('Choose a song in Neon Arcade Music first.');
 const artist=String(value.artist||'').slice(0,200),duration=Math.max(0,Math.min(999999,Math.floor(Number(value.duration)||0))),thumb=songArtwork(value);
 return {id:value.id,title:value.title.trim(),artist,duration,thumb};
}
export function createPlaylistQueue({changed=()=>{},failed=()=>{},random=Math.random}={}){
 let doc=null,tracks=[],index=-1,media=null,repeat='off',name='',shuffled=false;
 const source=()=>doc?.defaultView?.__NEO_METING_PLAYER__;
 function clear(){media?.removeEventListener('ended',ended);doc?.removeEventListener('click',clicked,true);source()?.setRepeatMode?.(repeat);doc=null;media=null;tracks=[];index=-1;name='';shuffled=false;changed(null);}
 function current(){return index<0?null:{name,index,total:tracks.length,id:tracks[index].id,shuffled};}
 function bind(){const next=source()?.media?.()||doc?.querySelector('audio');if(media===next)return;media?.removeEventListener('ended',ended);media=next;media?.addEventListener('ended',ended);}
 function play(next){index=next;source()?.setRepeatMode?.('off');doc.defaultView.playTrack(tracks[index]);bind();changed(current());}
 function ended(){if(index>=0&&index<tracks.length-1){try{play(index+1);}catch(error){failed(error);clear();}}}
 function clicked(event){const control=event.target.closest?.('#spotifyPrevBtn,#npmPrevBtn,#spotifyNextBtn,#npmNextBtn');if(!control)return;event.preventDefault();event.stopImmediatePropagation();action(control.id.includes('Prev')?'previous':'next');}
 function action(type){if(index<0||!['previous','next'].includes(type))return false;try{play((index+(type==='next'?1:-1)+tracks.length)%tracks.length);}catch(error){failed(error);clear();}return true;}
 function sync(){if(index<0)return;bind();const now=source()?.track?.();if(now&&String(now.id)!==tracks[index].id)clear();}
 function start(document,songs,title='',startAt=0,shuffle=false){
  if(!Array.isArray(songs)||!songs.length||songs.length>100)throw Error('Add songs to the playlist first.');
  const normalized=songs.map(playlistSong);if(typeof document?.defaultView?.playTrack!=='function'||!document.defaultView.__NEO_METING_PLAYER__)throw Error('The music player is still connecting. Open Music, then try again.');
  if(!Number.isInteger(startAt)||startAt<0||startAt>=normalized.length)throw Error('Choose a valid song.');
  clear();doc=document;tracks=normalized;name=title;shuffled=shuffle===true&&tracks.length>1;
  if(shuffled){for(let i=tracks.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[tracks[i],tracks[j]]=[tracks[j],tracks[i]];}if(tracks.every((song,i)=>song.id===songs[i].id))[tracks[0],tracks[1]]=[tracks[1],tracks[0]];startAt=0;}
  repeat=source()?.repeatMode?.()||'off';doc.addEventListener('click',clicked,true);
  try{play(startAt);}catch(error){clear();throw error;}
 }
 return {start,action,sync,clear,current};
}
