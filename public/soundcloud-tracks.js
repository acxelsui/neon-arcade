const reserved=new Set(['discover','search','you','charts','settings','upload','stream','feed','pages','terms-of-use','people','stations']);
function remoteURL(value){let raw=String(value||'');if(raw.includes('/~/sj/'))raw=decodeURIComponent(raw.slice(raw.indexOf('/~/sj/')+7).split('/').slice(2).join('/').split('?')[0]);return raw;}
export function soundcloudTrackURL(value){
 let raw=String(value||'');try{if(raw.includes('/~/sj/'))raw=decodeURIComponent(raw.slice(raw.indexOf('/~/sj/')+7).split('/').slice(2).join('/'));const url=new URL(raw,'https://soundcloud.com');const parts=url.pathname.split('/').filter(Boolean);if(url.protocol!=='https:'||!['soundcloud.com','www.soundcloud.com','m.soundcloud.com'].includes(url.hostname)||url.username||url.password||url.port||parts.length!==2||reserved.has(parts[0])||parts.some(part=>!/^[-\w]+$/.test(part)))return null;return 'https://soundcloud.com/'+parts.join('/');}catch{return null;}
}
export function soundcloudSongURL(song){const match=/^sc:([-\w]+):([-\w]+)$/.exec(song?.id||'');return match?soundcloudTrackURL('/'+match[1]+'/'+match[2]):null;}
export function isGoPlusTrack(value){return value?.policy==='SNIP'||value?.access==='preview'||value?.subscription_required===true||value?.monetization_model==='SUB_HIGH_TIER';}
export function hasGoPlusBadge(root){
 if(!root)return false;
 const badges='.sc-tag-go-plus,.sc-tag-soundcloud-go-plus,[data-neon-go-plus],[class*="GoPlus"]:not(.sc-hidden),[class*="goPlus"]:not(.sc-hidden)';
 if(root.matches?.(badges)||root.querySelector?.(badges))return true;
 return [...root.querySelectorAll?.('.sc-tag,[class*="badge"],[class*="Badge"],[title],[aria-label]')||[]].some(el=>/^(?:(?:soundcloud|neon music)\s+)?go\+$/i.test((el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').trim()));
}
export function soundcloudSongFromCard(card){
 if(!card)return null;
 if(hasGoPlusBadge(card))throw Error('Go+ songs cannot be added to Neon playlists.');
 const link=card.querySelector('.soundTitle__title,.playableTile__mainHeading a,.playbackSoundBadge__titleLink,.listenDetails__trackTitle a,a[itemprop="url"]');
 const canonical=card.matches?.('.listenHero,.fullListenHero')?card.ownerDocument.querySelector('link[rel="canonical"]'):null;
 const url=soundcloudTrackURL(link?.getAttribute('scramjet-attr-href')||link?.getAttribute('href')||canonical?.getAttribute('scramjet-attr-href')||canonical?.getAttribute('href'));if(!url)return null;
 const title=(link.getAttribute('title')||link.textContent||'').trim().slice(0,200);if(!title)return null;
 const id='sc:'+new URL(url).pathname.slice(1).replace('/',':');if(id.length>160)return null;
 const artist=(card.querySelector('.soundTitle__username,.playableTile__usernameHeading,.playbackSoundBadge__lightLink')?.textContent||'').trim().slice(0,200);
 const artwork=card.querySelector('.image__full')||card.querySelector('img')||card.querySelector('.sc-artwork');const image=artwork?.getAttribute('scramjet-attr-src')||artwork?.getAttribute('src')||/url\(["']?(.*?)["']?\)/.exec(artwork?.style?.backgroundImage||'')?.[1]||'';
 let thumb='';try{const cover=new URL(remoteURL(image));if(cover.protocol==='https:'&&!cover.username&&!cover.password)thumb=cover.href;}catch{}
 return {id,title,artist,thumb,duration:0};
}
