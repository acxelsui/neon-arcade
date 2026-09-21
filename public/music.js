import {soundcloudLink as musicLink,soundcloudPlayer as musicPlayer} from './music-links.js';
import {watchFrame} from './proxy-feedback.js';
let getProxy,playVersion=0;
export function initMusicProxy(factory){getProxy=factory}
const $=s=>document.querySelector(s);
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
let saved=read('neon-music',[]);if(!Array.isArray(saved))saved=[];
const previousProviderItems=saved.filter(t=>typeof t?.url==='string'&&t.url.startsWith('https://open.spotify.com/'));
saved=saved.filter(t=>{try{return typeof t.name==='string'&&musicLink(t.url)===t.url}catch{return false}}).slice(0,100);
let liked=read('neon-music-liked',[]);if(!Array.isArray(liked))liked=[];
let catalog=[],results=[],nextOffset=null,searchController,searchVersion=0,searchTimer,view='home',playing='',compact=false;
function message(text){$('#music-status').textContent=text}
function persist(){try{localStorage.setItem('neon-music',JSON.stringify([...saved,...previousProviderItems]));localStorage.setItem('neon-music-liked',JSON.stringify(liked))}catch{message('Could not save music in this browser. You can still listen.')}}
function normalize(item){return {...item,provider:item.provider||(item.url.includes('open.spotify.com')?'Spotify':'SoundCloud'),artist:item.artist||'Your library',id:item.id||item.url}}
function library(){return [...catalog,...saved.filter(s=>!catalog.some(c=>c.url===s.url))].map(normalize)}
function card(item){
 const el=document.createElement('article');el.className='music-card';
 const button=document.createElement('button');button.className='music-card-play';button.setAttribute('aria-label','Play '+item.name+' by '+item.artist);
 const artwork=document.createElement('div');artwork.className='music-art';const img=document.createElement('img');img.src=item.cover||'/icon.svg';img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.onerror=null;img.src='/icon.svg'};
 const play=document.createElement('span');play.className='music-play-symbol';play.textContent='▶';artwork.append(img,play);
 const title=document.createElement('strong');title.textContent=item.name;title.title=item.name;const artist=document.createElement('span');artist.className='music-artist';artist.textContent=item.artist;button.append(artwork,title,artist);button.onclick=()=>load(item);
 const footer=document.createElement('div');footer.className='music-card-footer';const source=document.createElement('a');source.href=item.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent=item.provider+' ↗';const heart=document.createElement('button');heart.className='music-heart';heart.textContent=liked.includes(item.url)?'♥':'♡';heart.setAttribute('aria-label','Like '+item.name);heart.setAttribute('aria-pressed',String(liked.includes(item.url)));heart.onclick=()=>{if(!saved.some(t=>t.url===item.url)){saved.unshift(item);saved=saved.slice(0,100)}liked=liked.includes(item.url)?liked.filter(u=>u!==item.url):[...liked,item.url];persist();render()};footer.append(source,heart);el.append(button,footer);
 if(view==='saved'){const remove=document.createElement('button');remove.className='music-remove';remove.textContent='Remove';remove.onclick=()=>{saved=saved.filter(t=>t.url!==item.url);persist();render()};el.append(remove)}
 return el;
}
function render(){
 const hour=new Date().getHours();$('#music-greeting').textContent=view==='home'?(hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'):view==='liked'?'Liked Songs':view==='saved'?'Your additions':'Search';
 $('#music-count').textContent=library().length+' tracks & mixes';$('#music-search-panel').hidden=view!=='search';document.querySelectorAll('[data-music-view]').forEach(b=>b.classList.toggle('selected',b.dataset.musicView===view));
 let items=library();if(view==='liked')items=items.filter(t=>liked.includes(t.url));if(view==='saved')items=items.filter(t=>saved.some(s=>s.url===t.url));
 if(view==='search')items=results;
 $('#music-more').hidden=view!=='search'||nextOffset===null;
 const content=$('#music-discover');content.replaceChildren();$('#music-empty').hidden=items.length>0;
 function section(name,tracks,hint){if(!tracks.length)return;const block=document.createElement('section');block.className='music-section';const heading=document.createElement('div');heading.className='music-section-heading';const h=document.createElement('h2');h.textContent=name;const small=document.createElement('span');small.textContent=hint||tracks.length+' selections';heading.append(h,small);const grid=document.createElement('div');grid.className='music-cards';tracks.forEach(t=>grid.append(card(t)));block.append(heading,grid);content.append(block)}
 if(view==='home'){
  section('Chill & focus',items.filter(t=>catalog.some(c=>c.url===t.url)),'SOUNDCLOUD');section('From your library',items.filter(t=>!catalog.some(c=>c.url===t.url)));
 }else section(view==='search'?'Results':view==='liked'?'Your favorites':'Saved by you',items);
}
async function load(item){
 const version=++playVersion;
 try{const url=musicLink(item.url);message('Connecting to SoundCloud…');
 if(playing!==url){
  if(!getProxy)throw Error('The music proxy is not ready. Please reload Neon Arcade.');
  const controller=await getProxy();if(version!==playVersion)return;
  const frame=controller.createFrame();frame.element.title='SoundCloud music player';frame.element.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';
  watchFrame(frame,error=>{if(version===playVersion)message('SoundCloud could not load. '+error)},()=>{if(version===playVersion)message('Press Play in SoundCloud. Keep this tab open during games.')});
  $('#music-frame').replaceChildren(frame.element);playing=url;frame.go(musicPlayer(url));
 }
 $('#music-dock').dataset.provider='SoundCloud';$('#music-now').textContent=item.name;$('#music-source').textContent='Listen on SoundCloud ↗';$('#music-source').href=url;$('#music-dock').hidden=false;$('#music-dock').classList.remove('compact');compact=false;$('#music-minimize').setAttribute('aria-expanded','true');$('#music-minimize').textContent='−';const frame=$('#music-frame iframe');if(frame)frame.tabIndex=0;
 }catch(error){if(version===playVersion)message(error.message)}
}
async function searchMusic(append=false){
 clearTimeout(searchTimer);searchController?.abort();const version=++searchVersion;
 const query=$('#music-query').value.trim();$('#music-search-retry').hidden=true;
 if(query.length<2){results=[];nextOffset=null;$('#music-search-status').textContent='Type at least 2 characters to search SoundCloud.';render();return}
 const offset=append?nextOffset:0;if(offset===null)return;
 if(!append){results=[];nextOffset=null;render()}
 searchController=new AbortController();$('#music-search-status').textContent='Searching SoundCloud…';$('#music-more').disabled=true;
 try{
  const response=await fetch('/api/music?'+new URLSearchParams({q:query,offset:String(offset)}),{signal:searchController.signal});
  const data=await response.json();if(!response.ok)throw Error(data.error||'SoundCloud search failed.');
  if(version!==searchVersion)return;
  const merged=append?[...results,...data.tracks]:data.tracks;results=[...new Map(merged.map(t=>[t.url,t])).values()];nextOffset=data.nextOffset;
  $('#music-search-status').textContent=results.length+' results from SoundCloud';render();
 }catch(error){if(version===searchVersion&&error.name!=='AbortError'){$('#music-search-status').textContent=error.message;$('#music-search-retry').hidden=false}}
 finally{if(version===searchVersion)$('#music-more').disabled=false}
}
$('#music-more').onclick=()=>searchMusic(true);$('#music-search-retry').onclick=()=>searchMusic();
$('#music-load-form').onsubmit=e=>{e.preventDefault();try{const url=musicLink($('#music-link').value);const known=catalog.find(t=>t.url===url);const name=$('#music-name').value.trim()||known?.name||new URL(url).pathname.split('/').at(-1).replaceAll('-',' ');const item=known||normalize({url,name});if(!saved.some(t=>t.url===url)){saved.unshift(item);saved=saved.slice(0,100);persist()}$('#music-add-panel').hidden=true;render();load(item)}catch(error){message(error.message)}};
$('#music-query').oninput=()=>{searchController?.abort();searchVersion++;clearTimeout(searchTimer);results=[];nextOffset=null;render();searchTimer=setTimeout(()=>searchMusic(),450)};
$('#music-add-toggle').onclick=()=>{$('#music-add-panel').hidden=!$('#music-add-panel').hidden;if(!$('#music-add-panel').hidden)$('#music-link').focus()};$('#music-add-cancel').onclick=()=>$('#music-add-panel').hidden=true;
document.querySelectorAll('[data-music-view]').forEach(b=>b.onclick=()=>{view=b.dataset.musicView;render();if(view==='search')$('#music-query').focus();$('.music-content').scrollTop=0});
$('#music-minimize').onclick=()=>{compact=!compact;$('#music-dock').classList.toggle('compact',compact);$('#music-minimize').setAttribute('aria-expanded',String(!compact));$('#music-minimize').textContent=compact?'＋':'−';const frame=$('#music-frame iframe');if(frame)frame.tabIndex=compact?-1:0};
$('#music-reload').onclick=()=>{if(playing){const url=playing;playing='';load({url,name:$('#music-now').textContent})}};
$('#music-stop').onclick=()=>{playVersion++;$('#music-frame').replaceChildren();playing='';$('#music-dock').hidden=true;if(!$('#player').hidden)$('#close-game').focus();else document.querySelector('nav [data-page="music"]').focus()};
render();
fetch('/music-catalog.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{catalog=data.filter(t=>t.provider==='SoundCloud');render()}).catch(()=>message('The music library could not load. Reload the page, or add your own music link.'));

fetch('/api/music?status=1').then(r=>r.json()).then(data=>{if(!data.configured)message('SoundCloud API search is waiting for the site owner’s credentials. You can still choose a mix or add a SoundCloud link.')}).catch(()=>message('SoundCloud search is unavailable. Try again later.'));
