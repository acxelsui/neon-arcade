import {soundcloudLink as musicLink,soundcloudPlayer as musicPlayer} from './music-links.js';
const $=s=>document.querySelector(s);
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
let saved=read('neon-music',[]);if(!Array.isArray(saved))saved=[];
const previousProviderItems=saved.filter(t=>typeof t?.url==='string'&&t.url.startsWith('https://open.spotify.com/'));
saved=saved.filter(t=>{try{return typeof t.name==='string'&&musicLink(t.url)===t.url}catch{return false}}).slice(0,100);
let liked=read('neon-music-liked',[]);if(!Array.isArray(liked))liked=[];
let catalog=[],view='home',playing='',compact=false;
function message(text){$('#music-status').textContent=text}
function persist(){try{localStorage.setItem('neon-music',JSON.stringify([...saved,...previousProviderItems]));localStorage.setItem('neon-music-liked',JSON.stringify(liked))}catch{message('Could not save music in this browser. You can still listen.')}}
function normalize(item){return {...item,provider:'SoundCloud',artist:item.artist||'Your library',id:item.id||item.url}}
function library(){return [...catalog,...saved.filter(s=>!catalog.some(c=>c.url===s.url))].map(normalize)}
function card(item){
 const el=document.createElement('article');el.className='music-card';
 const button=document.createElement('button');button.className='music-card-play';button.setAttribute('aria-label','Play '+item.name+' by '+item.artist);
 const artwork=document.createElement('div');artwork.className='music-art';const img=document.createElement('img');img.src=item.cover||'/icon.svg';img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.onerror=null;img.src='/icon.svg'};
 const play=document.createElement('span');play.className='music-play-symbol';play.textContent='▶';artwork.append(img,play);
 const title=document.createElement('strong');title.textContent=item.name;title.title=item.name;const artist=document.createElement('span');artist.className='music-artist';artist.textContent=item.artist;button.append(artwork,title,artist);button.onclick=()=>load(item);
 const footer=document.createElement('div');footer.className='music-card-footer';const source=document.createElement('a');source.href=item.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent=item.provider+' ↗';const heart=document.createElement('button');heart.className='music-heart';heart.textContent=liked.includes(item.url)?'♥':'♡';heart.setAttribute('aria-label','Like '+item.name);heart.setAttribute('aria-pressed',String(liked.includes(item.url)));heart.onclick=()=>{liked=liked.includes(item.url)?liked.filter(u=>u!==item.url):[...liked,item.url];persist();render()};footer.append(source,heart);el.append(button,footer);
 if(view==='saved'){const remove=document.createElement('button');remove.className='music-remove';remove.textContent='Remove';remove.onclick=()=>{saved=saved.filter(t=>t.url!==item.url);persist();render()};el.append(remove)}
 return el;
}
function render(){
 const hour=new Date().getHours();$('#music-greeting').textContent=view==='home'?(hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'):view==='liked'?'Liked Songs':view==='saved'?'Your additions':'Search';
 $('#music-count').textContent=library().length+' mixes & playlists';$('#music-search-panel').hidden=view!=='search';document.querySelectorAll('[data-music-view]').forEach(b=>b.classList.toggle('selected',b.dataset.musicView===view));
 let items=library();if(view==='liked')items=items.filter(t=>liked.includes(t.url));if(view==='saved')items=items.filter(t=>saved.some(s=>s.url===t.url));
 if(view==='search'){const query=$('#music-query').value.toLowerCase().trim();items=items.filter(t=>(t.name+' '+t.artist+' '+(t.group||'')).toLowerCase().includes(query));$('#music-search-soundcloud').href='https://soundcloud.com/search/sounds?q='+encodeURIComponent(query)}
 const content=$('#music-discover');content.replaceChildren();$('#music-empty').hidden=items.length>0;
 function section(name,tracks,hint){if(!tracks.length)return;const block=document.createElement('section');block.className='music-section';const heading=document.createElement('div');heading.className='music-section-heading';const h=document.createElement('h2');h.textContent=name;const small=document.createElement('span');small.textContent=hint||tracks.length+' selections';heading.append(h,small);const grid=document.createElement('div');grid.className='music-cards';tracks.forEach(t=>grid.append(card(t)));block.append(heading,grid);content.append(block)}
 if(view==='home'){
  section('Playlists for your next session',items.filter(t=>t.group==='Playlists'),'CHOOSE A PLAYLIST, THEN A SONG');section('Chill & focus',items.filter(t=>catalog.some(c=>c.url===t.url)&&t.group!=='Playlists'));section('From your library',items.filter(t=>!catalog.some(c=>c.url===t.url)));
 }else section(view==='search'?'Results':view==='liked'?'Your favorites':'Saved by you',items);
}
function load(item){
 try{const url=musicLink(item.url);const source='SoundCloud';
 if(playing!==url){const frame=document.createElement('iframe');frame.title=source+' music player';frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.setAttribute('credentialless','');frame.src=musicPlayer(url);$('#music-frame').replaceChildren(frame);playing=url}
 $('#music-dock').dataset.provider=source;$('#music-dock').classList.toggle('playlist',url.includes('/sets/'));$('#music-now').textContent=item.name;$('#music-source').textContent='Listen on '+source+' ↗';$('#music-source').href=url;$('#music-dock').hidden=false;$('#music-dock').classList.remove('compact');compact=false;$('#music-minimize').setAttribute('aria-expanded','true');$('#music-minimize').textContent='−';const frame=$('#music-frame iframe');if(frame)frame.tabIndex=0;message('Press Play in SoundCloud'+(url.includes('/sets/')?', or choose a song from the playlist.':'.')+' Keep this tab open while you play games.');
 }catch(error){message(error.message)}
}
$('#music-load-form').onsubmit=e=>{e.preventDefault();try{const url=musicLink($('#music-link').value);const known=catalog.find(t=>t.url===url);const name=$('#music-name').value.trim()||known?.name||new URL(url).pathname.split('/').at(-1).replaceAll('-',' ');const item=known||normalize({url,name});if(!saved.some(t=>t.url===url)){saved.unshift(item);saved=saved.slice(0,100);persist()}$('#music-add-panel').hidden=true;render();load(item)}catch(error){message(error.message)}};
$('#music-query').oninput=render;
$('#music-add-toggle').onclick=()=>{$('#music-add-panel').hidden=!$('#music-add-panel').hidden;if(!$('#music-add-panel').hidden)$('#music-link').focus()};$('#music-add-cancel').onclick=()=>$('#music-add-panel').hidden=true;
document.querySelectorAll('[data-music-view]').forEach(b=>b.onclick=()=>{view=b.dataset.musicView;render();if(view==='search')$('#music-query').focus();$('.music-content').scrollTop=0});
$('#music-minimize').onclick=()=>{compact=!compact;$('#music-dock').classList.toggle('compact',compact);$('#music-minimize').setAttribute('aria-expanded',String(!compact));$('#music-minimize').textContent=compact?'＋':'−';const frame=$('#music-frame iframe');if(frame)frame.tabIndex=compact?-1:0};
$('#music-reload').onclick=()=>{if(playing){const url=playing;playing='';load({url,name:$('#music-now').textContent})}};
$('#music-stop').onclick=()=>{$('#music-frame').replaceChildren();playing='';$('#music-dock').hidden=true;if(!$('#player').hidden)$('#close-game').focus();else document.querySelector('nav [data-page="music"]').focus()};
render();
fetch('/music-catalog.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{catalog=data;render()}).catch(()=>message('The music library could not load. Reload the page, or add your own music link.'));
