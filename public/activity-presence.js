export const pagePresence={home:'On Home',games:'Browsing Games',search:'Using Search',sports:'Watching Sports',movies:'Watching Movies',cloud:'In Neon Cloud Gaming',weather:'Checking Weather',ai:'Using AI Chat',music:'Listening to Music',settings:'In Settings',community:'In Neon Arcade Chat',profile:'Viewing a Profile',friends:'In Friends',playlists:'Browsing Playlists'};
export function pageActivity(page){const id=Object.hasOwn(pagePresence,page)?page:'home';return {id:'page:'+id,name:pagePresence[id]};}
export function formatPresence(player,elapsed=false){
 if(!player.online)return 'Offline';
 if(player.game_id?.startsWith('page:'))return pagePresence[player.game_id.slice(5)]||'Exploring Neon Arcade';
 if(!player.game_name)return 'Exploring Neon Arcade';
 if(!elapsed)return 'Playing '+player.game_name;
 const start=Date.parse(player.game_started_at),minutes=Number.isFinite(start)?Math.max(0,Math.floor((Date.now()-start)/60000)):0;
 return player.game_name+' · '+(minutes<1?'just started':minutes+' min');
}
export function initActivityPresence({send,initialPage='home',events=window}){
 let page=initialPage,game=null;
 const report=()=>send('activity',{game:game||pageActivity(page)});
 events.addEventListener('neon-page',event=>{page=event.detail;report();});
 events.addEventListener('neon-game',event=>{game=event.detail;report();});
 report();
}
