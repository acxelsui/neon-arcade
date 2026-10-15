// Realtime carries change signals only. Member identities and counts still come
// from the authenticated neon_online RPC, never another client's payload.
export function createInstantPresence({client,tabId,refresh,events=window,timers=globalThis,leave=()=>{}}){
 let channel=null,stamp='',generation=0,settle=null,lastRefresh=0,active=false;
 function schedule(){if(!active)return;const now=Date.now();if(now-lastRefresh>=500){lastRefresh=now;refresh();}timers.clearTimeout(settle);settle=timers.setTimeout(()=>{if(active){lastRefresh=Date.now();refresh();}},1200);}
 function stop(){active=false;generation++;timers.clearTimeout(settle);stamp='';if(channel){const old=channel;channel=null;client.removeChannel(old);}}
 function start(){if(channel)return;active=true;const current=++generation;channel=client.channel('neon-online-changes-v1',{config:{presence:{key:tabId}}});const owned=channel;
  owned.on('presence',{event:'sync'},()=>{if(current!==generation)return;const next=Object.keys(owned.presenceState()).sort().join('|');if(next!==stamp){stamp=next;schedule();}}).subscribe(async status=>{if(current!==generation)return;if(status==='SUBSCRIBED'){await owned.track({online:true});if(current===generation)schedule();}});
 }
 const hide=()=>{if(!active)return;leave();channel?.untrack();};const show=()=>{if(active){channel?.track({online:true});schedule();}};
 events.addEventListener('pagehide',hide);events.addEventListener('pageshow',show);events.addEventListener('online',show);
 return {start,stop,destroy(){stop();events.removeEventListener('pagehide',hide);events.removeEventListener('pageshow',show);events.removeEventListener('online',show);}};
}
