import {createMusicSearch} from './music-search.js';

export function initPlaylistSearch({host,getController,artwork,getTarget,addSong,doc=document,win=window,search=createMusicSearch(getController)}={}){
 const section=doc.createElement('section');section.className='playlist-search glass';section.setAttribute('aria-label','Find songs for your playlist');
 const header=doc.createElement('div');header.className='playlist-search-heading';const heading=doc.createElement('h2');heading.textContent='Find your next song';const target=doc.createElement('span');header.append(heading,target);
 const form=doc.createElement('form');form.className='playlist-search-form';const input=doc.createElement('input');input.type='search';input.maxLength=120;input.placeholder='Search any song or artist…';input.setAttribute('aria-label','Search songs or artists');const submit=doc.createElement('button');submit.type='submit';submit.textContent='Search';form.append(input,submit);
 const status=doc.createElement('p');status.className='playlist-search-status';status.setAttribute('role','status');status.textContent='Search and add songs here. You don’t need to play them first.';
 const results=doc.createElement('div');results.className='playlist-search-results';section.append(header,form,status,results);host.append(section);
 let rows=[],buttons=[],generation=0,request=null;
 function renderTarget(){const list=getTarget();target.textContent=list?.editable?'Adding to '+list.name:'Select or create one of your playlists';for(let i=0;i<buttons.length;i++){const saved=list?.tracks?.some(track=>track.id===rows[i].id);buttons[i].disabled=!list?.editable||list.busy||saved||list.tracks.length>=100;buttons[i].textContent=saved?'Added ✓':'＋ Add';buttons[i].setAttribute('aria-label',(saved?'Already added ':'Add ')+rows[i].title);}}
 function render(){results.replaceChildren();buttons=[];for(const song of rows){const row=doc.createElement('article');row.className='playlist-search-song';const info=doc.createElement('div');const title=doc.createElement('strong'),artist=doc.createElement('small');title.textContent=song.title;artist.textContent=song.artist;info.append(title,artist);const add=doc.createElement('button');add.type='button';add.onclick=()=>addSong(song);buttons.push(add);row.append(artwork(song),info,add);results.append(row);}renderTarget();}
 async function run(){
  const query=input.value.trim();request?.abort();const current=++generation;rows=[];render();if(query.length<2){status.textContent='Enter at least two characters of a song or artist.';return;}
  request=new AbortController();const signal=request.signal;status.textContent='Searching songs…';submit.disabled=true;win.dispatchEvent(new Event('neon-music-prepare'));
  try{const songs=await search.search(query,{signal});if(current!==generation||signal.aborted)return;rows=songs;render();status.textContent=songs.length?songs.length+' songs found. Add them without starting playback.':'No songs found. Try another title or artist.';}
  catch(error){if(current===generation&&!signal.aborted)status.textContent=error.message||'Music search could not connect. Try again.';}
  finally{if(current===generation){request=null;submit.disabled=false;}}
 }
 form.onsubmit=event=>{event.preventDefault();run();};input.oninput=()=>{generation++;request?.abort();request=null;submit.disabled=false;rows=[];render();status.textContent='Press Search or Enter to find songs.';};input.onfocus=()=>win.dispatchEvent(new Event('neon-music-prepare'));
 function clear(){generation++;request?.abort();request=null;search.clear();rows=[];input.value='';submit.disabled=false;status.textContent='Search and add songs here. You don’t need to play them first.';render();}
 renderTarget();return {element:section,refresh:renderTarget,clear,cancel(){generation++;request?.abort();request=null;submit.disabled=false;}};
}
