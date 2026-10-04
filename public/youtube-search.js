const videoId=/^[a-zA-Z0-9_-]{11}$/;
export function youtubeVideo(value,base='https://www.youtube.com/',depth=0){
 try{
  if(depth>2)return null;const url=new URL(value,base);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  if(['www.google.com','google.com'].includes(url.hostname)&&url.pathname==='/url')return youtubeVideo(url.searchParams.get('q')||url.searchParams.get('url')||'', 'https://www.youtube.com/',depth+1);
  const host=url.hostname.toLowerCase();let id;
  if(host==='youtu.be')id=url.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)){id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(?:shorts|live|embed)\/([^/]+)$/.exec(url.pathname)?.[1];}
  else if(['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=/^\/embed\/([^/]+)$/.exec(url.pathname)?.[1];
  if(!videoId.test(id||''))return null;
  const time=url.searchParams.get('start')||url.searchParams.get('t')||'';
  const match=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
  const start=/^\d+$/.test(time)?Number(time):match?Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0):0;
  const player=new URL('https://www.youtube-nocookie.com/embed/'+id);player.searchParams.set('playsinline','1');player.searchParams.set('rel','0');if(start>0&&start<=604800)player.searchParams.set('start',String(start));
  return {id,isPlayer:['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host),watch:'https://www.youtube.com/watch?v='+id,player:player.href};
 }catch{return null;}
}
// Keep the same controller, proxy session, and browser controls. This uses the
// official embedded player and does not solve challenges or change account cookies.
export function createYouTubeSearch({host,navigate,doc=document}){
 const bar=doc.createElement('div');bar.id='youtube-search-options';bar.hidden=true;
 const note=doc.createElement('p');const standard='Public videos may play signed out. YouTube can still require verification or restrict embedding.';note.textContent=standard;
 const play=doc.createElement('button');play.type='button';play.textContent='YouTube player';
 const page=doc.createElement('button');page.type='button';page.textContent='Video page';
 bar.append(note,play,page);host.before(bar);let selected=null,cleanup=()=>{};
 function opened(url){note.textContent=standard;selected=youtubeVideo(url);bar.hidden=!selected;play.disabled=!!selected?.isPlayer;page.disabled=!!selected&&!play.disabled;}
 play.onclick=()=>{if(selected)navigate(selected.player)};page.onclick=()=>{if(selected)navigate(selected.watch)};
 function connect(frame,controller){
  frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.referrerPolicy='strict-origin-when-cross-origin';
  function decode(value){try{const prefix=new URL(frame.prefix,location.href).href,address=new URL(value,location.href).href;return address.startsWith(prefix)?controller.config.codec.decode(address.slice(prefix.length)):value;}catch{return value;}}
  frame.element.addEventListener('load',()=>{
   cleanup();cleanup=()=>{};try{const inner=frame.element.contentDocument;if(!inner?.body)return;const current=decode(inner.defaultView.location.href);let verification=false;try{const url=new URL(current);verification=['www.google.com','accounts.google.com','www.youtube.com','consent.youtube.com'].includes(url.hostname)&&/^\/(?:sorry|signin|ServiceLogin|consent)(?:\/|$)/.test(url.pathname);}catch{}if(selected&&verification)note.textContent='YouTube is requiring verification. Its embedded player may require it too.';else opened(current);
    const click=event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.defaultPrevented)return;const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.hasAttribute('download'))return;
     const target=decode(anchor.href),video=youtubeVideo(target,current);if(!video)return;event.preventDefault();event.stopImmediatePropagation();navigate(video.player);
    };inner.addEventListener('click',click,true);cleanup=()=>inner.removeEventListener('click',click,true);
   }catch{/* A cross-origin page retains its own navigation. */}
  });
 }
 return {opened,connect,hide(){cleanup();cleanup=()=>{};bar.hidden=true;selected=null;}};
}
