// Runs inside NeonTube's rewritten watch document. All addresses are absolute so
// source-relative routing cannot escape its proxy context.
const base='https://bcsdny.net/~v/',id=new URLSearchParams(location.search).get('v');
const video=document.getElementById('player'),audio=document.getElementById('audio'),overlay=document.getElementById('msg'),label=document.getElementById('msgText'),picker=document.getElementById('picker');
let generation=0,paired=false,slow=null,request=null,stopped=false;
function message(text,loading=true){label.textContent=text;overlay.hidden=false;const spin=overlay.querySelector('.spin');if(spin)spin.hidden=!loading;}
function ready(){clearTimeout(slow);slow=null;overlay.hidden=true;}
function failure(text){clearTimeout(slow);message(text,false);retry.hidden=false;}
const retry=document.createElement('button');retry.type='button';retry.textContent='Try again ↻';retry.hidden=true;retry.style.cssText='padding:10px 15px;border:1px solid #6edfff;border-radius:10px;background:#173854;color:white;cursor:pointer;margin-top:12px';overlay.append(retry);
async function json(path,signal){const response=await fetch(base+path,{signal});if(!response.ok)throw Error('The video service returned '+response.status+'.');return response.json();}
function stream(quality){return base+'stream/'+id+'?q='+encodeURIComponent(quality);}
function align(){if(paired&&Number.isFinite(video.currentTime)&&Math.abs(audio.currentTime-video.currentTime)>.25)audio.currentTime=video.currentTime;}
function choose(quality){
 video.pause();audio.pause();paired=String(quality).startsWith('hd');retry.hidden=true;message('Loading video…');clearTimeout(slow);slow=setTimeout(()=>failure('This video is taking too long to load. Try again or choose another quality.'),20000);
 video.src=stream(quality);video.preload='auto';video.load();
 if(paired){audio.src=stream('audio');audio.volume=video.volume;audio.muted=video.muted;audio.load();}else{audio.removeAttribute('src');audio.load();}
 try{localStorage.setItem('neon-tube-quality',quality);}catch{}
}
video.addEventListener('loadeddata',ready);video.addEventListener('canplay',ready);video.addEventListener('playing',()=>{ready();if(paired){align();audio.play().catch(()=>failure('Press Play again to enable the video audio.'));}});
video.addEventListener('play',()=>{if(paired){align();audio.play().catch(()=>{});}});video.addEventListener('pause',()=>audio.pause());video.addEventListener('seeking',align);video.addEventListener('timeupdate',align);video.addEventListener('waiting',()=>{if(paired)audio.pause();});
video.addEventListener('volumechange',()=>{audio.volume=video.volume;audio.muted=video.muted;});video.addEventListener('ratechange',()=>audio.playbackRate=video.playbackRate);
video.addEventListener('error',()=>failure('This video could not play. Try another quality or another video.'));audio.addEventListener('error',()=>failure('The audio could not load. Try a single-file quality.'));
video.addEventListener('loadedmetadata',()=>video.play().catch(()=>{ready();label.textContent='Press Play to start the video.';}));
picker.addEventListener('change',()=>choose(picker.value));retry.onclick=()=>picker.options.length?choose(picker.value):start();
function fillDetails(info){for(const [element,key]of [['title','title'],['author','author'],['desc','description']]){const el=document.getElementById(element);if(el)el.textContent=info[key]||'';}const subs=document.getElementById('subs');if(subs)subs.textContent=[info.viewLabel,info.subscriberLabel].filter(Boolean).join(' · ');const avatar=document.getElementById('avatar');if(avatar&&info.authorThumbnail)avatar.src=base+'img?u='+encodeURIComponent(info.authorThumbnail);document.title=(info.title||'Video')+' · NeonTube';}
const nav=document.createElement('div');nav.style.cssText='display:flex;gap:16px;padding:12px 20px;align-items:center';const home=document.createElement('a');home.href=base;home.textContent='← NeonTube home';const search=document.createElement('form');search.id='find';const input=document.createElement('input');input.type='search';input.placeholder='Search videos';input.setAttribute('aria-label','Search videos');const submit=document.createElement('button');submit.textContent='Search';search.append(input,submit);nav.append(home,search);document.body.prepend(nav);
function related(rows){const host=document.getElementById('side');if(!host)return;host.replaceChildren();for(const row of Array.isArray(rows)?rows:[]){if(!/^[a-zA-Z0-9_-]{11}$/.test(row.id||''))continue;const link=document.createElement('a');link.className='rel';link.href=base+'watch?v='+row.id;const info=document.createElement('div'),title=document.createElement('h3'),author=document.createElement('p');title.className='vc__t';title.textContent=row.title||'Video';author.textContent=row.author||'';if(row.thumbnail){const img=document.createElement('img');img.src=base+'img?u='+encodeURIComponent(row.thumbnail);img.alt='';img.loading='lazy';img.style.cssText='width:140px;aspect-ratio:16/9;object-fit:cover;border-radius:8px';link.append(img);}info.append(title,author);link.append(info);host.append(link);}}
function captions(rows){const select=document.getElementById('cc'),wrap=document.getElementById('ccWrap');if(!select||!wrap)return;const tracks=Array.isArray(rows)?rows:[];wrap.hidden=!tracks.length;const none=document.createElement('option');none.value='';none.textContent='Off';select.replaceChildren(none,...tracks.filter(t=>typeof t.id==='string').map(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=t.label||t.lang||'Captions';return option;}));select.onchange=()=>{for(const track of video.querySelectorAll('track'))track.remove();const selected=tracks.find(t=>t.id===select.value);if(!selected)return;const track=document.createElement('track');track.kind='subtitles';track.label=selected.label||'Captions';track.srclang=selected.lang||'en';track.src=base+'captions/'+id+'?t='+encodeURIComponent(selected.id);track.default=true;video.append(track);};}
async function start(){
 request?.abort();request=new AbortController();const signal=request.signal,current=++generation;retry.hidden=true;message('Loading video…');clearTimeout(slow);slow=setTimeout(()=>{request.abort();failure('The video service took too long to answer. Please retry.');},15000);
 if(!/^[a-zA-Z0-9_-]{11}$/.test(id||'')){failure('Choose a valid video from NeonTube.');return;}
 json('api/video/'+id,signal).then(info=>{if(!stopped&&current===generation)fillDetails(info);}).catch(()=>{});
 json('api/related/'+id+'?page=1',signal).then(data=>{if(!stopped&&current===generation)related(data.videos);}).catch(()=>{});
 json('api/captions/'+id,signal).then(data=>{if(!stopped&&current===generation)captions(data.tracks);}).catch(()=>{});
 try{
  const data=await json('api/qualities/'+id,signal);if(stopped||current!==generation)return;
  const formats=[];for(const item of Array.isArray(data.progressive)?data.progressive:[]){const q=Number(item.quality)||360;if(q>0&&q<=4320&&!formats.some(f=>f.value===String(q)))formats.push({value:String(q),label:q+'p · single file'});}
  if(data.hasAudioTrack)for(const item of Array.isArray(data.videoOnly)?data.videoOnly:[]){const q=Number(item.quality);if(q>0&&q<=4320&&!formats.some(f=>f.value==='hd'+q))formats.push({value:'hd'+q,label:q+'p · HD'});}
  if(!formats.length)throw Error('No playable video format is available.');
  picker.replaceChildren(...formats.map(format=>{const option=document.createElement('option');option.value=format.value;option.textContent=format.label;return option;}));
  let saved='';try{saved=localStorage.getItem('neon-tube-quality');}catch{}picker.value=formats.some(f=>f.value===saved)?saved:formats[0].value;choose(picker.value);
 }catch(error){if(stopped||current!==generation)return;failure(signal.aborted?'The video service took too long to answer. Please retry.':error.message);}
}
window.addEventListener('pagehide',()=>{stopped=true;generation++;request?.abort();clearTimeout(slow);video.pause();audio.pause();});start();
