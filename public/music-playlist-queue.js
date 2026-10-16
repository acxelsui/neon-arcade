import {playlistSong} from './playlist-player.js';
export function musicClockSeconds(value){const parts=String(value||'').trim().split(':');if(parts.length<2||parts.length>3||parts.some(part=>!/^\d{1,3}$/.test(part)))return 0;return parts.reduce((total,part)=>total*60+Number(part),0);}
export function createMusicPlaylistQueue({play,changed=()=>{},failed=()=>{},random=Math.random}){
 let tracks=[],index=-1,name='',shuffled=false,version=0;
 const current=()=>index<0?null:{name,index,total:tracks.length,id:tracks[index].id,shuffled};
 function clear(){version++;tracks=[];index=-1;changed(null);}
 async function select(next){if(next<0||next>=tracks.length)return;index=next;const attempt=++version;changed(current());try{await play(tracks[index]);}catch(error){if(attempt===version){failed(error);clear();}}}
 return {current,clear,start(songs,title='',startAt=0,shuffle=false){if(!Array.isArray(songs)||!songs.length||songs.length>100)throw Error('Add songs to the playlist first.');const normalized=songs.map(playlistSong);if(!Number.isInteger(startAt)||startAt<0||startAt>=normalized.length)throw Error('Choose a valid song.');clear();tracks=normalized;name=title;shuffled=shuffle&&tracks.length>1;if(shuffled){for(let i=tracks.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[tracks[i],tracks[j]]=[tracks[j],tracks[i]];}startAt=0;}return select(startAt);},action(type){if(index<0||!['next','previous'].includes(type))return false;select((index+(type==='next'?1:-1)+tracks.length)%tracks.length);return true;},ended(){if(index>=0&&index<tracks.length-1)select(index+1);else clear();}};
}
