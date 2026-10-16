import {applyMusicDocumentAppearance} from './music-appearance.js';
import {watchFrame} from './proxy-feedback.js';
import {musicClockSeconds} from './music-playlist-queue.js';
import {soundcloudSongFromCard,soundcloudSongURL,hasGoPlusBadge} from './soundcloud-tracks.js';

export const SOUNDCLOUD_MUSIC_URL='https://soundcloud.com/discover';
// Match dedicated ad services, never entire music/CDN domains or arbitrary
// occurrences of "ad" in a song URL. Shared audio streams remain untouched.
const adHosts=['doubleclick.net','googlesyndication.com','googletagservices.com','googleadservices.com','amazon-adsystem.com','adswizz.com','ads.soundcloud.com','audio-ads.sndcdn.com','adnxs.com','criteo.com','criteo.net','rubiconproject.com','pubmatic.com','openx.net','casalemedia.com','smartadserver.com','teads.tv','adsrvr.org','adform.net','aaxads.com'];
export function isMusicAdURL(value){try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return false;const host=url.hostname.toLowerCase().replace(/\.$/,'');if(adHosts.some(ad=>host===ad||host.endsWith('.'+ad)))return true;return ['api.soundcloud.com','api-v2.soundcloud.com'].includes(host)&&/^\/(?:v[12]\/)?(?:ads|advertising|ad-selection|ad-delivery)(?:\/|$)/i.test(url.pathname);}catch{return false}}
export function musicAdFilter(transport){
 const request=transport.request.bind(transport);
 return new Proxy(transport,{get(target,key){if(key==='request')return (url,...args)=>{if(args[3]?.aborted)return Promise.reject(new DOMException('Request canceled','AbortError'));return isMusicAdURL(url)?Promise.resolve({status:204,statusText:'No Content',headers:[],body:null}):request(url,...args);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}

export const neonMusicLabel=value=>String(value).replace(/soundcloud/gi,'Neon Music');
export function isMusicAccountFrame(value){try{let source=String(value);if(source.includes('/~/sj/'))source=decodeURIComponent(source.slice(source.indexOf('/~/sj/')+7).split('/').slice(2).join('/'));const url=new URL(source,SOUNDCLOUD_MUSIC_URL);return url.hostname==='secure.soundcloud.com'||(['soundcloud.com','www.soundcloud.com'].includes(url.hostname)&&/^\/(?:sign-in|signin|sign-up|signup|connect|web-auth)(?:\/|$)/i.test(url.pathname));}catch{return false}}
const providerLogoAsset=/avatars-(?:69H9MhsAT5XDDltu-1X6yHw|uBhncEiJEB6wuWPC-hwlXng)(?:-|[.])/;
export function isMusicBrandLogo({label='',source='',className=''}={}){return providerLogoAsset.test(source)||/^(?:soundcloud|neon music)(?:\s+(?:logo|icon|wordmark))?$/i.test(label.trim())||/(?:soundcloud[-_ ]*(?:logo|wordmark|icon)|(?:logo|wordmark)[-_ ]*soundcloud|\bsc-logo\b)/i.test(className)||/(?:^|\/)(?:soundcloud(?:[-_](?:logo|wordmark|icon))?|(?:logo|wordmark|icon)[-_]soundcloud)\.(?:svg|png|webp)(?:[?#]|$)/i.test(source);}
const neonMusicMark='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="11" fill="#5b9ef033" stroke="#c7e3ff"/><text x="20" y="27" text-anchor="middle" fill="white" font-family="system-ui" font-size="22" font-weight="700">N↗</text></svg>');
// Dismiss the provider's normal account dialog; this does not grant access to
// account-only tracks or modify authentication requests or playback responses.
export function dismissMusicSignup(doc){
 let dismissed=false;
 for(const modal of doc.querySelectorAll('.modal,.modal__modal,.modalWhiteout,.auth-modal,[role="dialog"]')){
  if(modal.classList.contains('neon-music-dismissed-auth'))continue;
  const account=modal.classList.contains('auth-modal')||/create (?:an? )?account|sign[ -]?in|sign[ -]?up|log[ -]?in/i.test(modal.textContent||'')||[...modal.querySelectorAll('iframe')].some(frame=>isMusicAccountFrame(frame.getAttribute('scramjet-attr-src')||frame.getAttribute('src')||'')||/sign in|create.*account/i.test(frame.getAttribute('title')||''));
  if(!account)continue;
  const shell=modal.closest?.('.modalWhiteout')||modal.closest?.('.modal')||modal;
  const close=shell.querySelector('.modal__close,.modal__closeButton,button[aria-label="Close"],button[title="Close"]');
  if(close)close.click();
  // Some playback prompts finish loading their cross-origin account iframe
  // after the modal opens. Hide the shell even if its close handler is late.
  shell.classList.add('neon-music-dismissed-auth');modal.classList.add('neon-music-dismissed-auth');doc.body.classList.remove('g-overflow-hidden');
  dismissed=true;
 }
 return dismissed;
}
// Change presentation only; URLs, form values, account records and playback
// identifiers remain exactly as supplied by the provider.
export function themeSoundCloud(doc,onAccountPrompt=()=>{},onDiscover=()=>{},{addSong=()=>{},openLibrary=()=>{},skip=()=>false,ended=()=>{}}={}){
 if(!doc?.head||!doc.body)return ()=>{};
 const style=doc.createElement('style');style.id='neon-music-catalog-theme';
 style.textContent=`
 html,body,#app,.l-container,.l-content,.l-main,.l-sidebar,.l-footer,.header,.header__inner,.playControls,.playControls__inner,.playControls__wrapper,.playbackSoundBadge,.collection,.listenEngagement,.search,.stream,.mixedSelectionModule{background:transparent!important;background-image:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
 html,body{color-scheme:dark!important;min-width:0!important}body{color:#f3f6ff!important;--surface-color:transparent;--background-color:transparent;--primary-color:#a9d2ff}
 .l-container{width:100%!important;max-width:1240px!important;min-width:0!important;box-sizing:border-box!important}.l-content{min-width:0!important}.l-main{width:calc(100% - 320px)!important;box-sizing:border-box!important}
 .l-product-banners,.mobileApps,#div-gpt-ad-interstitial,[id^="google_ads_iframe_"],.advertisement,.interstitialAd,.adOverlay,.audioAd,.displayAd,.sponsoredSound,[data-testid="advertisement"],[data-ad-slot],ins.adsbygoogle,iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],iframe[src*="amazon-adsystem.com"]{display:none!important;pointer-events:none!important}
 .header{border-bottom:1px solid #ffffff28!important;box-shadow:none!important}.header__inner{border-radius:0!important}
 .header__logoLink{display:flex!important;align-items:center;justify-content:center;gap:10px;background:transparent!important;width:180px!important;color:#fff!important;text-decoration:none!important}
 .header__logoLink:before{content:'N↗';display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#5b9ef033;border:1px solid #c7e3ff70;font:700 19px system-ui}
 .header__logoLink{flex-direction:row!important;overflow:visible!important;font-size:0!important}.header__logoLink:before,.header__logoLink:after{position:static!important;float:none!important;clear:none!important;flex-shrink:0!important;margin:0!important;transform:none!important}.header__logoLink:after{content:'Neon Music';display:block!important;width:auto!important;height:auto!important;font:700 18px system-ui;letter-spacing:-.04em}.header__logoLink>div,.header__logoLink svg,.header__logoLink span{display:none!important}
 .header__logoLink-iconOnly{display:none!important}
 /* The current client preloads auth outside its modal shell, then toggles the
    wrapper's hidden class. Keep that dedicated wrapper hidden before paint. */
 .webAuthContainerWrapper,.webAuthContainer,.auth-modal{display:none!important;visibility:hidden!important;pointer-events:none!important}
 .neon-music-brand-mark{display:inline-grid;place-items:center;width:32px;height:32px;object-fit:contain;flex-shrink:0;color:#fff;font:700 20px system-ui}.neon-music-replaced-logo{background-image:none!important;mask-image:none!important;-webkit-mask-image:none!important}.neon-music-replaced-logo svg{display:none!important}.neon-music-replaced-logo:before{content:'N↗'!important;background:none!important;mask:none!important;color:#fff;font:700 19px system-ui!important}
 :is(.modal,.modal__modal,.modalWhiteout,[role="dialog"]):has(iframe:is([src*="secure.soundcloud.com"],[src*="soundcloud.com%2Fsign-in"],[src*="soundcloud.com/sign-in"],[scramjet-attr-src*="soundcloud.com/sign-in"])){visibility:hidden!important;pointer-events:none!important}
 .neon-music-account-promo,.neon-music-dismissed-auth,.header__loginMenu,.header__loginButton,.header__signupButton,.header .uploadButton{display:none!important}
 .header__search input{background:transparent!important;border:1px solid #ffffff38!important;border-radius:99px!important;color:#fff!important}
 .soundTitle__title,.soundTitle__username,.mixedSelectionModule__title,.sc-link-dark,.sc-text-h1,.sc-text-h2{color:#f1f6ff!important}
 @media(max-width:800px){.l-main{width:100%!important;padding-right:0!important;border:0!important}.l-sidebar,.l-sidebar-right{display:none!important}.header__inner{display:flex!important;align-items:center!important;flex-wrap:wrap!important;height:auto!important;gap:8px!important;padding:8px 14px!important}.header{height:auto!important}.header__left,.header__middle,.header__right{float:none!important;width:auto!important;min-width:0!important}.header__middle{flex:1!important}.header__right{display:none!important}.header__navMenu{display:none!important}.header__search{padding:0!important}.l-container.l-content{padding-top:76px!important}.playControls__wrapper{min-width:0!important}.playbackTimeline{display:none!important}.playbackSoundBadge{width:auto!important;flex:1!important}}
 .playControls{border-top:1px solid #ffffff30!important}.playControls__wrapper{border-radius:16px!important}
 .sc-artwork,.image__full{border-radius:14px!important}.mixedSelectionModule{border-color:#ffffff25!important}
 /* Search and playback share the same clear surface as Discover. Keep cover
    artwork and icon masks intact rather than clearing all images. */
 .sound__waveform,.sound__waveformWrapper,.listenEngagement__waveform,.waveform,.waveform__layer,.waveformComments,.waveformComments__list{display:none!important}
 /* Apply to every rendered song, including results appended while scrolling.
    Keep the title/artist and play button; hide the secondary social UI. */
 .soundTitle__additionalContainer,.soundTitle__uploadTime,.soundTitle__tag,.sound__uploadTime,.sound__tag,.sound .relativeTime,.sound .sc-tag,.sound .commentForm,.sound__commentForm,.sound__footer,.sound__soundActions,.sound__comments,.listenEngagement,.listenHero__tag,.listenHero__info .relativeTime{display:none!important}
 .sound__content{min-height:0!important}.sound__body{padding-bottom:0!important}
 .searchTitle,.searchOptions,.searchOptions__container,.searchOptions__navigation,.searchOptions__navigationItem,.searchOptions__navigationLink,.l-fixed-top,.l-fixed-left,.sound,.sound__body,.sound__content,.sound__footer,.commentForm,.commentForm__inputContainer,.commentForm__inputFieldWrapper,.commentForm__input,.playControls__bg,.playControls__elements,.queue,.queue__panel{background:transparent!important;background-image:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}
 .searchTitle{border-bottom:1px solid #ffffff22!important;padding:12px 0!important}.searchTitle__text{font-size:22px!important;line-height:1.4!important;letter-spacing:-.035em!important;color:#fff!important;margin:0!important}
 .searchOptions__navigationItem{border:1px solid transparent!important;border-radius:12px!important;margin-bottom:7px!important;transition:border-color .18s,transform .18s}
 .searchOptions__navigationItem.active{border-color:#d3e8ff99!important;box-shadow:inset 3px 0 #b4d8ff!important}
 .searchOptions__navigationLink{color:#edf5ff!important;text-shadow:0 1px 5px #0009}.searchOptions__navigationItem:hover{border-color:#ffffff50!important;transform:translateX(2px)}
 .soundList__item{padding-top:18px!important;padding-bottom:22px!important;border-bottom:1px solid #ffffff24!important}.soundTitle__title,.soundTitle__username{text-shadow:0 1px 5px #0008}
 .commentForm__input{border:1px solid #d2e7ff55!important;border-radius:12px!important;color:#fff!important;padding-left:12px!important}.commentForm__input::placeholder{color:#e0eaf5!important}
 .sc-button:not(.sc-button-play),.playControls button,.playbackSoundBadge button{background-color:transparent!important;border:1px solid #d1e4ff42!important;border-radius:10px!important;box-shadow:none!important;color:#fff!important}
 .sc-button:not(.sc-button-play):hover,.playControls button:hover{border-color:#d2e8ff9c!important}.sc-button-selected{border-color:#abd2ff!important;color:#c5e1ff!important}
 .sc-button-play{background-color:transparent!important;border:1px solid #d2e8ff99!important;box-shadow:none!important}.volume__sliderWrapper,.playbackSoundBadge__actions{background:transparent!important;backdrop-filter:none!important}
 @media(max-width:800px){.l-search.l-fixed-fluid{padding-top:0!important}.l-search>.l-fixed-top{position:static!important;width:auto!important}.l-search>.l-fixed-left{position:static!important;width:100%!important;height:auto!important}.l-search>.l-main{margin-left:0!important;padding-left:16px!important;padding-right:16px!important}.searchOptions{position:static!important;width:auto!important;max-height:none!important}.searchOptions__navigation{display:flex!important;gap:8px!important;overflow-x:auto!important;margin:8px 0 14px!important;padding:0 16px!important}.searchOptions__navigationItem{flex:none!important;margin:0!important;padding:7px 12px!important}.searchOptions__navigationLink{white-space:nowrap!important}.searchOptions .l-footer{display:none!important}.searchTitle__text{font-size:19px!important}.sound__coverArt{width:100px!important;height:100px!important}.sound__content{margin-left:116px!important}.sound__waveform{min-width:0!important}}
 button,a{transition:color .18s,background-color .18s,transform .18s}a:focus-visible,button:focus-visible{outline:2px solid #a9d2ff!important;outline-offset:3px}
 *{scrollbar-width:thin;scrollbar-color:#b6c9e066 transparent}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#b6c9e066;border-radius:99px}
 @media(prefers-reduced-motion:reduce){button,a{transition:none}}`;
 doc.head.append(style);
 const sidebar=doc.createElement('aside');sidebar.className='neon-music-sidebar';sidebar.innerHTML='<button class="neon-music-wordmark" data-neon-nav="home">N↗ <span>Neon Music</span></button><button data-neon-nav="home">⌂ Home</button><button data-neon-nav="search">⌕ Search</button><div class="neon-library-label">YOUR LIBRARY <span>＋</span></div><button data-neon-nav="library">♫ Your playlists</button><div class="neon-library-card"><b>Your music. Your space.</b><p>Find a song, hit +, and build your next playlist.</p><button data-neon-nav="library">Create playlist</button></div><small>Made for your soundtrack</small>';doc.body.append(sidebar);
 const polish=doc.createElement('style');polish.textContent=`
 .fullListenHero,.fullHero{background:transparent!important;background-image:none!important}body{padding-left:216px!important;box-sizing:border-box}.neon-music-sidebar{position:fixed;left:12px;top:14px;bottom:68px;width:180px;padding:12px 8px;z-index:1000;display:flex;flex-direction:column;gap:9px;color:#fff;font:14px system-ui;border-right:1px solid #ffffff1c;background:transparent}.neon-music-sidebar>.neon-music-wordmark{display:flex;gap:9px;align-items:center;font-size:19px;margin:7px 0 28px}.neon-music-sidebar button{border:0;border-radius:10px;color:#e5e8ee;background:transparent;text-align:left;padding:12px;font:600 13px system-ui;cursor:pointer}.neon-music-sidebar button:hover{background:#ffffff16;color:#fff}.neon-library-label{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.15em;color:#b5bbc8;margin:28px 12px 8px}.neon-library-card{padding:14px;margin-top:12px;border:1px solid #ffffff18;border-radius:14px;background:#10182024;line-height:1.5;font-size:12px}.neon-library-card p{color:#c9ced8}.neon-library-card button{border:1px solid #ffffff55;border-radius:99px;padding:9px 13px;background:#ffffff0c}.neon-music-sidebar>small{margin-top:auto;padding:12px;color:#adb6c5;font-size:10px}.header{left:216px!important;width:calc(100% - 216px)!important}.header__logo,.header__navMenu{display:none!important}.header__search input{border-radius:99px!important;background:#10182042!important;border:1px solid #ffffff30!important;padding-left:20px!important}.header__inner{max-width:none!important}.l-sidebar,.l-footer{display:none!important}.l-main{width:100%!important;margin-right:0!important}.mixedSelectionModule{border:0!important;padding:12px 0 24px!important}.mixedSelectionModule__title,.searchTitle__text{font:750 26px system-ui!important;letter-spacing:-.04em}.playableTile{border-radius:14px!important;padding:12px!important;background:#10182015!important;transition:background .2s,transform .2s}.playableTile:hover{background:#10182065!important;transform:translateY(-3px)}.playableTile__artwork{border-radius:12px!important;overflow:hidden}.soundList__item{border:0!important}.sound{border-radius:15px;padding:16px!important;background:#10182015!important;margin-bottom:8px}.sound:hover{background:#10182038!important}.neon-add-song{margin-top:10px!important;border:1px solid #ffffff45!important;border-radius:99px!important;padding:7px 13px!important;background:#10182028!important;color:white!important;font:600 11px system-ui!important;cursor:pointer}.neon-add-song:hover{background:#a3f0be!important;color:#081b10!important;border-color:#a3f0be!important}.neon-go-plus-track,.sound:has([class*="GoPlus"]:not(.sc-hidden)),.playableTile:has([class*="GoPlus"]:not(.sc-hidden)){display:none!important}.playControls{border-top:1px solid #ffffff22!important}.playControls__wrapper{padding:7px 15px!important}.playControl{border-radius:50%!important}.playbackTimeline__progressBackground{border-radius:99px!important}@media(max-width:760px){body{padding-left:0!important;padding-top:54px!important}.neon-music-sidebar{position:fixed;top:0;left:0;right:0;bottom:auto;width:auto;height:42px;flex-direction:row;align-items:center;border-right:0;border-bottom:1px solid #ffffff20;margin:0 12px;padding:8px;gap:4px}.neon-music-sidebar>.neon-music-wordmark{font-size:16px;margin:0 10px 0 0}.neon-music-sidebar>.neon-music-wordmark span,.neon-library-label,.neon-library-card,.neon-music-sidebar>small{display:none}.neon-music-sidebar button{padding:9px;font-size:11px}.header{left:0!important;width:100%!important;position:relative!important}.playableTile{padding:6px!important}}@media(prefers-reduced-motion:reduce){.playableTile{transition:none!important;transform:none!important}}`;
 polish.textContent+=`
 .searchOptions__navigation-high_tier{display:none!important}
 .sound__body{display:grid!important;grid-template-columns:112px minmax(0,1fr)!important;gap:16px!important}.sound__artwork{position:relative!important;float:none!important;width:112px!important;height:112px!important;margin:0!important}.sound__coverArt{display:block!important;width:100%!important;height:100%!important}.sound__artwork .image,.sound__artwork .image__full{width:100%!important;height:100%!important;border-radius:12px!important}.sound__content{margin:0!important;width:auto!important;min-width:0!important}.sound__header{padding:0!important;min-width:0!important}.soundTitle__usernameTitleContainer{min-width:0!important}
 @media(min-width:801px){.l-search>.l-main{width:calc(100% - 220px)!important;margin-left:220px!important}.l-search>.l-fixed-left,.searchOptions{width:200px!important}}
 @media(max-width:800px){.l-search>.l-fixed-left,.searchOptions{height:auto!important;min-height:44px!important}.searchOptions__scrollable,.searchOptions__scrollableInner,.searchOptions__container{position:static!important;height:auto!important;max-height:none!important;overflow:visible!important;width:auto!important}.searchOptions__filtersTitle,.searchOptions__filterWrapper,.searchOptions .searchTags,.searchOptions__footer{display:none!important}.searchOptions__navigation{margin:8px 0!important}.sound__body{grid-template-columns:80px minmax(0,1fr)!important;gap:14px!important}.sound__artwork{width:80px!important;height:80px!important}.soundTitle__title{font-size:14px!important}.soundTitle__username{font-size:11px!important}}
 .neon-music-sidebar,.neon-library-card,.neon-library-card button,.neon-music-sidebar button,.neon-music-sidebar button:hover,.header__search input,.playableTile,.playableTile:hover,.sound,.sound:hover,.neon-add-song,.neon-add-song:hover{background:transparent!important;background-image:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}
 .neon-add-song:hover{color:#c5ffdc!important}.neon-music-sidebar,.soundTitle__title,.soundTitle__username,.mixedSelectionModule__title{text-shadow:0 1px 5px #0009}
 .commentsList,.listenDetails__comments,.fullHero__uploadTime{display:none!important}.playControls,.playControls__inner{min-width:0!important;width:100%!important}.fullListenHero{height:auto!important;min-height:260px!important;margin:0!important}.fullListenHero>div{height:auto!important}.backgroundGradient,.fullHero__info,.fullHero__playerArea,.fullHero__waveform{display:none!important}
 .fullHero__foreground{position:relative!important;inset:auto!important;width:100%!important;box-sizing:border-box!important;display:grid!important;grid-template-columns:190px minmax(0,1fr)!important;gap:26px!important;align-items:center!important;padding:28px!important}
 .fullHero__artwork{position:relative!important;inset:auto!important;float:none!important;width:190px!important;height:190px!important;margin:0!important;grid-column:1;grid-row:1}.fullHero__artwork .listenArtworkWrapper,.fullHero__artwork .listenArtworkWrapper__artwork,.fullHero__artwork .sc-artwork{width:100%!important;height:100%!important;border-radius:16px!important;overflow:hidden}
 .fullHero__title{position:static!important;width:auto!important;min-width:0!important;grid-column:2;grid-row:1}.fullHero__title .soundTitle__titleContainer{display:flex!important;gap:16px!important;align-items:center!important}.fullHero .soundTitle__playButton{float:none!important;flex-shrink:0!important}.fullHero .soundTitle__usernameTitleContainer{min-width:0!important;margin:0!important}.fullHero h1.soundTitle__title{width:auto!important;max-width:100%!important;font:750 30px/1.15 system-ui!important;letter-spacing:-.045em!important;white-space:normal!important;overflow-wrap:anywhere!important}.fullHero h1 span,.fullHero .soundTitle__usernameHeroContainer span{background:transparent!important;box-shadow:none!important}.fullHero .soundTitle__additionalContainer{display:none!important}.fullHero .neon-add-song{margin-top:18px!important}
 @media(max-width:760px){.l-container.l-content{padding-top:0!important}.l-main{padding-top:16px!important}.fullHero__foreground{grid-template-columns:100px minmax(0,1fr)!important;gap:16px!important;padding:18px 12px!important}.fullHero__artwork{width:100px!important;height:100px!important}.fullHero__title .soundTitle__titleContainer{flex-direction:column-reverse!important;align-items:flex-start!important;gap:12px!important}.fullHero h1.soundTitle__title{font-size:21px!important}.fullHero .playButton{width:44px!important;height:44px!important}.fullListenHero{min-height:210px!important}.fullHero .soundTitle__username{font-size:12px!important}}
 `;
 doc.head.append(polish);
 function labels(root){
  function text(node){if(node.nodeType===3&&!node.parentElement?.closest('script,style,noscript,textarea,input,[contenteditable]')){const value=neonMusicLabel(node.nodeValue);if(value!==node.nodeValue)node.nodeValue=value;}}
  if(root.nodeType===3){text(root);return;}
  if(root.nodeType!==1)return;
  const walker=doc.createTreeWalker(root,4);let node;while(node=walker.nextNode())text(node);
  for(const el of [root,...root.querySelectorAll('[aria-label],[title],[alt],[placeholder],[aria-description]')])for(const attr of ['aria-label','title','alt','placeholder','aria-description']){const value=el.getAttribute(attr);if(value!==null){const branded=neonMusicLabel(value);if(branded!==value)el.setAttribute(attr,branded);}}
 }
 let lastPlaybackAttempt=0;
 function brand(){
  for(const card of doc.querySelectorAll('.sound,.playableTile,.listenHero,.fullListenHero')){
   if(hasGoPlusBadge(card)){card.classList.add('neon-go-plus-track');continue;}
   if(card.querySelector('.neon-add-song'))continue;
   let song;try{song=soundcloudSongFromCard(card);}catch{continue;}if(!song)continue;
   const add=doc.createElement('button');add.type='button';add.className='neon-add-song';add.textContent='＋ Add to playlist';add.setAttribute('aria-label','Add '+song.title+' to playlist');(card.querySelector('.sound__content')||card.querySelector('.fullHero__title')||card).append(add);
  }
  if(/soundcloud/i.test(doc.title))doc.title=neonMusicLabel(doc.title);
  for(const el of doc.querySelectorAll('img,svg[aria-label],[role="img"][aria-label],.image__full[title],.image__full[aria-label],.sc-artwork[title],[style*="avatars-69H9MhsAT5XDDltu-1X6yHw"],[style*="avatars-uBhncEiJEB6wuWPC-hwlXng"],.sc-logo,.soundcloudLogo,.soundcloud-logo,.sc-button-soundcloud')){
   if(el.closest('.header__logoLink'))continue;
   const cls=typeof el.className==='string'?el.className:el.className?.baseVal||'';
   if(!isMusicBrandLogo({label:el.getAttribute('alt')||el.getAttribute('aria-label')||el.getAttribute('title')||'',source:el.getAttribute('scramjet-attr-src')||el.getAttribute('src')||el.style.backgroundImage||'',className:cls}))continue;
   if(el.tagName.toLowerCase()==='img'){if(el.getAttribute('src')!==neonMusicMark)el.setAttribute('src',neonMusicMark);el.removeAttribute('srcset');if(el.getAttribute('alt')!=='Neon Music')el.setAttribute('alt','Neon Music');if(!el.classList.contains('neon-music-brand-mark'))el.classList.add('neon-music-brand-mark');}
   else if(el.tagName.toLowerCase()==='svg'){const mark=doc.createElement('span');mark.className='neon-music-brand-mark';mark.textContent='N↗';mark.setAttribute('role','img');mark.setAttribute('aria-label','Neon Music');el.replaceWith(mark);}
   else if(!el.classList.contains('neon-music-replaced-logo'))el.classList.add('neon-music-replaced-logo');
  }
  // Official provider profile avatars can be CSS background images with no
  // logo filename. Match their profile identity, not arbitrary album artwork.
  for(const link of doc.querySelectorAll('.userBadge__avatar a,.user__avatar a,.userItem__image a,a.userBadge__avatar,a.userItem__image')){
   const raw=link.getAttribute('scramjet-attr-href')||link.getAttribute('href')||'';
   if(!/^\/soundcloud(?:[-/]|$)/i.test(raw))continue;
   for(const image of link.querySelectorAll('.image__full,.sc-artwork'))if(!image.classList.contains('neon-music-replaced-logo')){image.classList.add('neon-music-replaced-logo');image.setAttribute('aria-label','Neon Music');}
  }
  for(const el of doc.querySelectorAll('header button,header a'))if(/^(sign[ -]?in|log[ -]?in|create (?:an? )?(?:neon music )?account|sign[ -]?up|upload)$/i.test(el.textContent.trim()))el.classList.add('neon-music-account-promo');
  if(dismissMusicSignup(doc)&&Date.now()-lastPlaybackAttempt<6000)onAccountPrompt();
  for(const link of doc.querySelectorAll('.header__logoLink')){
   if(link.getAttribute('aria-label')!=='Neon Music')link.setAttribute('aria-label','Neon Music');
   if(link.getAttribute('title')!=='Neon Music')link.setAttribute('title','Neon Music');
   // The wordmark is replaced by the Neon mark and label in CSS.
   for(const text of [...link.childNodes])if(text.nodeType===3&&text.textContent.trim())text.textContent='';
  }
 }
 const loaded=event=>{if(event.target?.tagName==='IFRAME')brand();};
 const discover=event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(event.target?.closest?.('.playButton,.playControl'))lastPlaybackAttempt=Date.now();
  const target=event.target,nav=target?.closest?.('[data-neon-nav]'),add=target?.closest?.('.neon-add-song,.sc-button-addtoset'),logo=target?.closest?.('.header__logoLink'),next=target?.closest?.('.skipControl__next,.skipControl__previous');
  if(next&&skip(next.matches('.skipControl__next')?'next':'previous')){event.preventDefault();event.stopImmediatePropagation();return;}
  if(!nav&&!add&&!logo)return;event.preventDefault();event.stopImmediatePropagation();
  if(add){try{const song=soundcloudSongFromCard(add.closest('.sound,.playableTile,.listenHero,.fullListenHero')||doc.querySelector('.listenHero,.fullListenHero'));if(song)addSong(song);}catch{onAccountPrompt();}return;}
  if(logo||nav?.dataset.neonNav==='home')onDiscover();else if(nav?.dataset.neonNav==='library')openLibrary();else doc.querySelector('.header__search input')?.focus();
 };
 doc.addEventListener('click',discover,true);
 doc.addEventListener('load',loaded,true);
 doc.addEventListener('ended',ended,true);
 labels(doc.body);brand();const observer=new doc.defaultView.MutationObserver(records=>{for(const record of records){if(record.type==='childList')for(const node of record.addedNodes)labels(node);else labels(record.target);}brand();});observer.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt','placeholder','aria-description','src','srcset']});
 return ()=>{observer.disconnect();doc.removeEventListener('click',discover,true);doc.removeEventListener('load',loaded,true);doc.removeEventListener('ended',ended,true);style.remove();polish.remove();sidebar.remove();};
}

export function createSoundCloudMusic(getController,host,status,options={}){
 let frame,controller,pending,themedDoc,version=0,cleanup=()=>{},pendingPlay=null;
 const document=()=>{try{return frame?.element.contentDocument}catch{return null}};
 function refreshTheme(){const doc=document();if(doc?.body&&doc!==themedDoc){cleanup();cleanup=themeSoundCloud(doc,()=>status('This song or action requires a provider account. Choose another song to keep listening.'),()=>frame?.go(SOUNDCLOUD_MUSIC_URL),options);themedDoc=doc;}}
 function state(){refreshTheme();if(options.appearance)applyMusicDocumentAppearance(document(),options.appearance());const doc=document(),control=doc?.querySelector('.playControls .playControl'),ready=!!control&&!control.classList.contains('disabled')&&!control.disabled;let song=null;try{song=soundcloudSongFromCard(doc?.querySelector('.playbackSoundBadge'));}catch{}if(pendingPlay&&doc?.body){const hero=doc.querySelector('.listenHero,.fullListenHero');if(hero&&hasGoPlusBadge(hero)){pendingPlay=null;status('Go+ songs are excluded from Neon playlists.');options.unavailable?.();}else if(Date.now()>pendingPlay.until){pendingPlay=null;status('Song loaded. Press Play to start listening.');}else{const play=hero?.querySelector('.playButton,.sc-button-play');if(play&&soundcloudSongFromCard(hero)?.id===pendingPlay.id){const label=play.getAttribute('title')||play.getAttribute('aria-label')||'';if(/unavailable/i.test(label)){pendingPlay=null;status('This song is unavailable from the provider. Choose another track.');options.unavailable?.();}else if(!play.classList.contains('sc-button-disabled')&&play.getAttribute('aria-disabled')!=='true'){pendingPlay=null;if(!/pause/i.test(label))play.click();}}}}return {active:!!frame,ready,playing:ready&&/pause/i.test(control.getAttribute('title')||control.getAttribute('aria-label')||''),title:doc?.querySelector('.playbackSoundBadge__titleLink')?.getAttribute('title')||'Choose a song',song,elapsed:musicClockSeconds(doc?.querySelector('.playbackTimeline__timePassed [aria-hidden]')?.textContent),duration:musicClockSeconds(doc?.querySelector('.playbackTimeline__duration [aria-hidden]')?.textContent)};}
 function action(name){const doc=document(),selector={toggle:'.playControls .playControl',previous:'.skipControl__previous',next:'.skipControl__next'}[name],control=selector&&doc?.querySelector(selector);if(!control||control.disabled||control.classList.contains('disabled'))return false;control.click();return true;}
 function pause(){if(state().playing)action('toggle');}
 function open(reset=false){
  if(frame){if(reset)frame.go(SOUNDCLOUD_MUSIC_URL);return Promise.resolve(frame)}if(pending)return pending;
  const current=++version;status('Connecting to Neon Music…');
  const task=(async()=>{try{controller=await getController();if(current!==version)return null;frame=controller.createFrame();frame.element.title='Neon Music';frame.element.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.element.allowFullscreen=true;
   if(frame.fetchHandler.client?.transport)frame.fetchHandler.client.transport=musicAdFilter(frame.fetchHandler.client.transport);
   watchFrame(frame,error=>status(error+' Select Reload to retry.'),()=>status(''));
   frame.element.addEventListener('load',()=>{try{refreshTheme();}catch{status('Music loaded, but its appearance could not be updated.')}});
   host.replaceChildren(frame.element);frame.go(SOUNDCLOUD_MUSIC_URL);return frame;
  }catch(error){status('Music could not connect. '+error.message);return null}})();pending=task;task.finally(()=>{if(pending===task)pending=null});return task;
 }
 function stop(){version++;pendingPlay=null;pending=null;themedDoc=null;cleanup();cleanup=()=>{};if(frame){const index=controller?.frames?.indexOf(frame);if(index>=0)controller.frames.splice(index,1);frame.element.remove();frame=null;}host.replaceChildren();}
 return {open,state,action,pause,stop,async search(query){await open();frame.go('https://soundcloud.com/search/sounds?q='+encodeURIComponent(String(query).slice(0,120)));},async play(song){const url=soundcloudSongURL(song);if(!url)throw Error('This playlist song has an invalid music link.');await open();pendingPlay={id:song.id,until:Date.now()+20000};frame.go(url);},reload:()=>frame?frame.reload():open()};
}
