import {soundcloudLink,soundcloudPlayer} from './music-links.js';
const $=s=>document.querySelector(s);
let saved=[];
try{const value=JSON.parse(localStorage.getItem('neon-music')||'[]');if(Array.isArray(value))saved=value.slice(0,40).filter(item=>{try{return typeof item.name==='string'&&soundcloudLink(item.url)===item.url}catch{return false}})}catch{}
let playing='',compact=false;
function message(text){$('#music-status').textContent=text}
function persist(){try{localStorage.setItem('neon-music',JSON.stringify(saved))}catch{message('Could not save music in this browser. You can still listen.')}}
function render(){
  const list=$('#music-library');list.replaceChildren();$('#music-empty').hidden=saved.length>0;
  for(const item of saved){const row=document.createElement('div');row.className='music-row glass';const play=document.createElement('button');play.className='music-row-play';play.setAttribute('aria-label','Load '+item.name);const symbol=document.createElement('span');symbol.className='music-row-symbol';symbol.textContent='♫';const name=document.createElement('span');name.textContent=item.name;play.append(symbol,name);play.onclick=()=>load(item.url,item.name);const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Remove '+item.name+' from saved music');remove.onclick=()=>{saved=saved.filter(s=>s.url!==item.url);persist();render()};row.append(play,remove);list.append(row)}
}
function load(value,title){
  try{
    const url=soundcloudLink(value);const name=title||decodeURIComponent(new URL(url).pathname.split('/').at(-1)).replaceAll('-',' ');
    if(playing!==url){const frame=document.createElement('iframe');frame.title='SoundCloud music player';frame.allow='autoplay';frame.setAttribute('credentialless','');frame.src=soundcloudPlayer(url);$('#music-frame').replaceChildren(frame);playing=url}
    $('#music-now').textContent=name;$('#music-source').href=url;$('#music-dock').hidden=false;$('#music-dock').classList.remove('compact');compact=false;const currentFrame=$('#music-frame iframe');if(currentFrame)currentFrame.tabIndex=0;$('#music-minimize').setAttribute('aria-expanded','true');$('#music-minimize').textContent='−';
    message('Press Play in the SoundCloud player. Your music stays loaded while you play games.');
  }catch(error){message(error.message)}
}
$('#music-load-form').onsubmit=e=>{e.preventDefault();try{const url=soundcloudLink($('#music-link').value);const name=$('#music-name').value.trim()||new URL(url).pathname.split('/').at(-1).replaceAll('-',' ');if(!saved.some(item=>item.url===url)){saved.unshift({url,name:name.slice(0,100)});saved=saved.slice(0,40);persist();render()}load(url,name)}catch(error){message(error.message)}};
$('#music-search-form').onsubmit=e=>{e.preventDefault();const query=$('#music-query').value.trim();if(query)window.open('https://soundcloud.com/search/sounds?q='+encodeURIComponent(query),'_blank','noopener,noreferrer')};
$('#music-minimize').onclick=()=>{compact=!compact;$('#music-dock').classList.toggle('compact',compact);$('#music-minimize').setAttribute('aria-expanded',String(!compact));$('#music-minimize').textContent=compact?'＋':'−';const frame=$('#music-frame iframe');if(frame)frame.tabIndex=compact?-1:0};
$('#music-reload').onclick=()=>{if(playing){const url=playing;playing='';load(url,$('#music-now').textContent)}};
$('#music-stop').onclick=()=>{$('#music-frame').replaceChildren();playing='';$('#music-dock').hidden=true;if(!$('#player').hidden)$('#close-game').focus();else document.querySelector('nav [data-page="music"]').focus()};
render();
