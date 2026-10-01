export function readPlaylistToken(value){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)?value.toLowerCase():null;}
export function playlistShareUrl(token,origin){if(!readPlaylistToken(token))throw Error('Choose a shared playlist.');return new URL('/?playlist='+readPlaylistToken(token),origin).href;}
export function playlistTokenFromLink(value,origin){try{const url=new URL(value);if(url.origin!==new URL(origin).origin||url.pathname!=='/'||url.username||url.password||url.searchParams.getAll('playlist').length!==1)return null;return readPlaylistToken(url.searchParams.get('playlist'));}catch{return null;}}
export function appendPlaylistLinks(element,text,origin){
 const value=String(text||'');let cursor=0;
 for(const match of value.matchAll(/https?:\/\/[^\s<>]+/g)){
  const raw=match[0].replace(/[,.!?)]+$/,'');const token=playlistTokenFromLink(raw,origin);if(!token)continue;
  element.append(document.createTextNode(value.slice(cursor,match.index)));const link=document.createElement('a');link.href=playlistShareUrl(token,origin);link.target='_blank';link.rel='noopener noreferrer';link.className='playlist-chat-link';link.textContent='♫ Open shared playlist ↗';element.append(link);cursor=match.index+raw.length;
 }
 element.append(document.createTextNode(value.slice(cursor)));
}
