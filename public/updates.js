// Keep newest first. Dates describe when the change was added, not when a visitor opened Home.
export const updates = [
 {date:'2026-09-24',title:'Nine new animated backgrounds',text:'Choose new space, BMW, Luffy, Spider-Man, polygon, moon, and synth-wave wallpapers in Settings. Background choices save automatically.'},
 {date:'2026-09-24',title:'Fullscreen games and Retro Bowl proxy',text:'Added a Fullscreen toggle beside Retry in every game player. Retro Bowl now loads its data before starting so it can use the proxy.'},
 {date:'2026-09-23',title:'Retro Bowl refreshed',text:'Replaced Retro Bowl with the newly supplied game version, available from its existing tile in Games.'},
 {date:'2026-09-23',title:'A clearer game screen',text:'Removed the floating account button. Your profile picture and sign-out controls are still available in Settings under Your Neon account.'},
 {date:'2026-09-23',title:'Proxy compatibility after sign-in',text:'Aligned the account and arcade frame policies so the proxy can display games, Search, NeonTube, Music, Movies, and Sports inside the signed-in site.'},
 {date:'2026-09-23',title:'Login at the arcade entrance',text:'The original arcade address now routes signed-out visitors to Neon accounts. Game files and new proxy connections require a server-checked arcade session.'},
 {date:'2026-09-23',title:'Preparing Neon accounts',text:'Added support for an isolated account entrance, profile pictures, and an online-player panel. These become available through the account site once its deployment and signup settings are finished.'},
 {date:'2026-09-22',title:'NeonTube search repaired',text:'Searches and category buttons now stay inside the video proxy instead of opening a broken Neon Arcade page.'},
 {date:'2026-09-22',title:'Click Roblox and go',text:'Removed the extra cloud gaming description and launch buttons. Click the Roblox tile to open the player directly.'},
 {date:'2026-09-22',title:'A console feel for cloud gaming',text:'Neon Cloud Gaming now has a highlighted Roblox tile and a clean console-style layout. Roblox remains the only cloud game.'},
 {date:'2026-09-22',title:'Neon Cloud Gaming',text:'A Roblox-only launcher now opens now.gg through Neon, with fullscreen, reload, and close controls. Includes an alternate Roblox link if the official page redirects away. Stream availability depends on the external provider.'},
 {date:'2026-09-22',title:'A little neon glow',text:'The Neon Arcade title, time, and date on Home now glow light blue.'},
 {date:'2026-09-22',title:'Your update corner',text:'Home now has a dated update feed. Check here for new features and improvements.'},
 {date:'2026-09-22',title:'Music, without the clutter',text:'The floating music box is gone outside Music. Play, pause, or stop your soundtrack from the compact top bar while you browse.'},
 {date:'2026-09-22',title:'Meet Neon Weather',text:'Search locations worldwide for current conditions, hourly forecasts, and your week ahead. Switch between Celsius and Fahrenheit.'},
 {date:'2026-09-22',title:'NeonTube is here',text:'Watch videos, explore Shorts, and search in the new NeonTube tab. Proxy connections now recover after being idle.'},
 {date:'2026-09-22',title:'Neon Music playback fix',text:'Music opens the player directly, fixing the garbled page. Songs can keep playing when you switch to Games.'},
 {date:'2026-09-21',title:'A fresh look for Neon',text:'A glass sidebar, browser-style tabs, home search, quick launches, and a compact game grid make everything easier to reach.'},
 {date:'2026-09-21',title:'Music and movie nights',text:'Added Music with background listening and a Movies tab. Music evolved from discovery cards to the current Neon Music player.'},
 {date:'2026-09-21',title:'Chat with screenshots',text:'AI Chat gained saved conversations and screenshot attachments. The access code was removed; replies still require the site’s AI provider to be configured.'},
 {date:'2026-09-21',title:'A new game to explore',text:'How to Fish joined the game library and opens through the same proxy as the other games.'},
 {date:'2026-09-20',title:'Make it your own',text:'Added game favorites, categories, random picks, search bookmarks, personal background uploads, and eight new wallpapers.'},
 {date:'2026-09-20',title:'A warmer welcome',text:'Refreshed the loading screen and Home with quick launches and recently played games.'},
 {date:'2026-09-20',title:'Sports and proxy improvements',text:'Added Sports, routed the game library through dedicated proxy players, and repaired deployed Search connections.'},
 {date:'2026-09-19',title:'Ready for Vercel',text:'Added the production build and relay endpoint for hosting Neon Arcade on Vercel.'},
 {date:'2026-09-18',title:'Welcome to Neon Arcade',text:'The first version brought together the game library, wallpapers, home clock, and proxy search.'},
];
export function initUpdates(){
 for(const [index,entry] of updates.entries()){
  const article=document.createElement('article');article.className='update-entry';
  const time=document.createElement('time');time.dateTime=entry.date;time.textContent=new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(entry.date+'T12:00:00Z'));
  const title=document.createElement('h3');title.textContent=entry.title;
  const body=document.createElement('p');body.textContent=entry.text;
  article.append(time,title,body);document.querySelector(index<4?'#updates-latest':'#updates-older').append(article);
 }
}
