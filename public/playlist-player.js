export function playlistSong(value){
 if(!value||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(value.id)||typeof value.title!=='string'||!value.title.trim()||value.title.length>200)throw Error('Choose a song in Neon Arcade Music first.');
 const artist=String(value.artist||'').slice(0,200),duration=Math.max(0,Math.min(999999,Math.floor(Number(value.duration)||0)));let thumb=String(value.thumb||'');
 if(thumb){try{const url=new URL(thumb);if(url.protocol!=='https:'||url.username||url.password||thumb.length>2000)thumb='';}catch{thumb='';}}
 return {id:value.id,title:value.title.trim(),artist,duration,thumb};
}
export function createPlaylistQueue({changed=()=>{},failed=()=>{}}={}){
 let doc=null,tracks=[],index=-1,media=null,repeat='off',name='';
 const source=()=>doc?.defaultView?.__NEO_METING_PLAYER__;
 function clear(){media?.removeEventListener('ended',ended);doc?.removeEventListener('click',clicked,true);source()?.setRepeatMode?.(repeat);doc=null;media=null;tracks=[];index=-1;name='';changed(null);}
 function current(){return index<0?null:{name,index,total:tracks.length,id:tracks[index].id};}
 function bind(){const next=source()?.media?.()||doc?.querySelector('audio');if(media===next)return;media?.removeEventListener('ended',ended);media=next;media?.addEventListener('ended',ended);}
 function play(next){index=next;source()?.setRepeatMode?.('off');doc.defaultView.playTrack(tracks[index]);bind();changed(current());}
 function ended(){if(index>=0&&index<tracks.length-1){try{play(index+1);}catch(error){failed(error);clear();}}}
 function clicked(event){const control=event.target.closest?.('#spotifyPrevBtn,#npmPrevBtn,#spotifyNextBtn,#npmNextBtn');if(!control)return;event.preventDefault();event.stopImmediatePropagation();action(control.id.includes('Prev')?'previous':'next');}
 function action(type){if(index<0||!['previous','next'].includes(type))return false;try{play((index+(type==='next'?1:-1)+tracks.length)%tracks.length);}catch(error){failed(error);clear();}return true;}
 function sync(){if(index<0)return;bind();const now=source()?.track?.();if(now&&String(now.id)!==tracks[index].id)clear();}
 function start(document,songs,title='',startAt=0){
  if(!Array.isArray(songs)||!songs.length||songs.length>100)throw Error('Add songs to the playlist first.');
  const normalized=songs.map(playlistSong);if(typeof document?.defaultView?.playTrack!=='function'||!document.defaultView.__NEO_METING_PLAYER__)throw Error('The music player is still connecting. Open Music, then try again.');
  if(!Number.isInteger(startAt)||startAt<0||startAt>=normalized.length)throw Error('Choose a valid song.');
  clear();doc=document;tracks=normalized;name=title;repeat=source()?.repeatMode?.()||'off';doc.addEventListener('click',clicked,true);
  try{play(startAt);}catch(error){clear();throw error;}
 }
 return {start,action,sync,clear,current};
}
