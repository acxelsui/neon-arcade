import {tubeAdRequest,tubeDestination} from './neon-tube-model.js';
import {tubeSearchResults} from './neon-tube-results.js';
export function protectTubeFrame(frame,{tap,runtime,onNavigate,onBlocked,onVerification,onResults=()=>{}}){
 frame.element.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');
 frame.element.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.element.allowFullscreen=true;
 tap(frame.hooks.fetch.request,({parsed},props)=>{if(tubeAdRequest(parsed.url.href)){onBlocked();props.earlyResponse=runtime.BareResponse.fromNativeResponse(new Response(null,{status:204}));}});
 tap(frame.hooks.init.post,({client,window:win,isTopLevel})=>{
  for(const method of ['History.prototype.pushState','History.prototype.replaceState'])client.Proxy(method,{apply(context){if(context.args[2]==null)context.args[2]=client.url.href;context.call();}});
  client.Proxy('window.open',{apply(context){context.return(null);onBlocked();}});
  const decode=value=>{try{return client.unrewriteUrl(value)}catch{return value}};
  const click=event=>{const link=event.target?.closest?.('a[href],area[href]');if(!link)return;if(event.type==='auxclick'&&event.button!==1)return;
   const href=link.getAttribute('scramjet-attr-href')||link.href;
   if(link.getAttribute('href')?.startsWith('#'))return;
   event.preventDefault();event.stopImmediatePropagation();
   const destination=isTopLevel&&tubeDestination(decode(href),client.url.href);
   if(destination)onNavigate(destination,(link.getAttribute('title')||link.querySelector('img')?.alt||link.textContent||'YouTube video').trim());else onBlocked();
  };
  win.document.addEventListener('click',click,true);win.document.addEventListener('auxclick',click,true);
  const decorate=()=>{if(!win.document.head||win.document.getElementById('neon-tube-style'))return;
   const style=win.document.createElement('style');style.id='neon-tube-style';style.textContent=`html,body,ytd-app,ytd-page-manager{background:#090b17!important;color:#eeeaff!important;color-scheme:dark}ytd-masthead,#masthead-container,ytd-mini-guide-renderer,tp-yt-app-drawer,ytd-guide-renderer,ytd-ad-slot-renderer,ytd-promoted-sparkles-web-renderer,ytd-promoted-video-renderer,ytd-display-ad-renderer,ytd-in-feed-ad-layout-renderer,ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],#player-ads,#masthead-ad,a[href*="accounts.google.com"],ytd-button-renderer:has(a[href*="ServiceLogin"]){display:none!important}ytd-page-manager{margin-top:0!important;margin-left:0!important}ytd-app{--ytd-masthead-height:0px;--yt-spec-base-background:#090b17;--yt-spec-text-primary:#eeeaff}*{scrollbar-width:thin;scrollbar-color:#8e7ab34d transparent}ytd-search{padding-top:12px!important}`;
   win.document.head.append(style);
   const url=client.url;
   if(/\/sorry(?:\/|$)|\/signin(?:\/|$)|\/ServiceLogin|\/consent(?:\/|$)/.test(url.pathname))onVerification();
   if(isTopLevel&&url.pathname==='/results'){
    let previous='',pending;
    const collect=()=>{pending=null;const body=win.document.body;if(!body)return;
     if(/confirm you.re not a bot|unusual traffic|sign in to confirm/i.test(body.innerText||'')){onVerification();return;}
     let videos=tubeSearchResults(win.ytInitialData);
     if(!videos.length){videos=[...body.querySelectorAll('ytd-video-renderer')].slice(0,60).flatMap(card=>{const link=card.querySelector('a#video-title'),destination=link&&tubeDestination(decode(link.href),client.url.href);if(destination?.type!=='video')return [];const spans=[...card.querySelectorAll('#metadata-line span')];return [{id:destination.video.id,title:(link.getAttribute('title')||link.textContent||'YouTube video').trim().slice(0,180),channel:card.querySelector('ytd-channel-name')?.textContent.trim()||'',published:spans[1]?.textContent.trim()||'',views:spans[0]?.textContent.trim()||'',duration:card.querySelector('ytd-thumbnail-overlay-time-status-renderer')?.textContent.trim()||''}]});}
     const signature=JSON.stringify(videos);if(videos.length&&signature!==previous){previous=signature;onResults(videos);}
    };
    collect();const observer=new win.MutationObserver(()=>{if(!pending)pending=win.setTimeout(collect,250)});if(win.document.body)observer.observe(win.document.body,{childList:true,subtree:true});win.addEventListener('pagehide',()=>{observer.disconnect();if(pending)win.clearTimeout(pending)},{once:true});
   }
  };
  decorate();win.document.addEventListener('DOMContentLoaded',decorate,{once:true});
 });
}
