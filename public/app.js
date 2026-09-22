import {initUpdates} from './updates.js';
import {initWeather} from './weather.js';
import {initTube} from './tube.js';
import {initShell} from './shell.js';
import {initMusic} from './music.js';
import './chat.js';
import { watchFrame } from './proxy-feedback.js';
import { filterLibrary, bookmarkUrl } from './library-tools.js';
import { initAppearance } from './appearance.js';
const $=s=>document.querySelector(s);
const store={get(k,f){try{return JSON.parse(localStorage.getItem('neon-'+k))??f}catch{return f}},set(k,v){try{localStorage.setItem('neon-'+k,JSON.stringify(v))}catch{}}};
let catalog,selectedGame,previousFocus,controllerPromise,webFrame;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,4000)}
function showPage(name){if(!['home','games','search','sports','movies','neontube','weather','ai','music','settings'].includes(name))name='home';document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==name);document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===name);b.setAttribute('aria-current',b.dataset.page===name?'page':'false')});if(location.hash!=='#'+name)history.replaceState(null,'','#'+name);window.scrollTo(0,0);if(name==='sports')openSports();if(name==='movies')openMovies();window.dispatchEvent(new CustomEvent('neon-page',{detail:name}))}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));window.addEventListener('hashchange',()=>showPage(location.hash.slice(1)));
function updateClock(){const now=new Date();$('#clock').textContent=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:!store.get('24hour',false)}).replace(/\s?[AP]M/i,'');$('#date').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});$('#clock').dateTime=now.toISOString();$('#clock-period').textContent=store.get('24hour',false)?'':(now.getHours()<12?'AM':'PM');$('#home-greeting').textContent=now.getHours()<12?'Good morning':now.getHours()<18?'Good afternoon':'Good evening'}
$('#clock-format').checked=store.get('24hour',false);$('#clock-format').onchange=e=>{store.set('24hour',e.target.checked);updateClock()};updateClock();setInterval(updateClock,1000);
function wallpaper(url){$('#wallpaper').style.backgroundImage=`url(${JSON.stringify(url)})`;store.set('wallpaper',url);window.dispatchEvent(new Event('wallpaper-change'));document.querySelectorAll('.wallpaper-choice').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.url===url)))}
function favorites(){const value=store.get('favorites',[]);return Array.isArray(value)?value:[]}
function librarySelection(){return filterLibrary(catalog.games,{query:$('#game-filter').value,category:$('#game-category').value,favorites:favorites(),onlyFavorites:$('#favorites-filter').getAttribute('aria-pressed')==='true'})}
function renderGames(){if(!catalog)return;const games=librarySelection();const saved=new Set(favorites());$('#game-count').textContent=`${games.length.toLocaleString()} ${games.length===1?'game':'games'}. Favorites first.`;$('#empty').hidden=games.length>0;$('#random-game').disabled=!games.some(g=>!g.unavailable);const fragment=document.createDocumentFragment();for(const game of games){const card=document.createElement('div');card.className='game-card';const button=document.createElement('button');button.className='game-open';button.title=game.name;const img=document.createElement('img');img.src=game.cover;img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>{img.onerror=null;img.src='/icon.svg'};const title=document.createElement('span');title.className='game-name';title.textContent=game.name;button.append(img,title);button.onclick=()=>openGame(game,button);const star=document.createElement('button');star.className='favorite-star';star.dataset.gameId=game.id;star.textContent=saved.has(game.id)?'★':'☆';star.setAttribute('aria-label','Favorite '+game.name);star.setAttribute('aria-pressed',String(saved.has(game.id)));star.onclick=()=>{const ids=new Set(favorites());ids.has(game.id)?ids.delete(game.id):ids.add(game.id);store.set('favorites',[...ids]);renderGames();const replacement=[...document.querySelectorAll('.favorite-star')].find(b=>b.dataset.gameId===game.id);(replacement||$('#favorites-filter')).focus()};card.append(button,star);fragment.append(card)}$('#game-grid').replaceChildren(fragment)}
$('#game-category').onchange=renderGames;
$('#favorites-filter').onclick=()=>{const b=$('#favorites-filter');const active=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(active));b.textContent=active?'★ Favorites':'☆ Favorites';renderGames()};
$('#random-game').onclick=()=>{const games=librarySelection().filter(g=>!g.unavailable);if(games.length)openGame(games[Math.floor(Math.random()*games.length)],$('#random-game'))};
$('#game-filter').oninput=renderGames;
function makeGameFrame(game,doc=document){const frame=doc.createElement('iframe');frame.src=new URL("/game-runner.html?id="+encodeURIComponent(game.id),location.origin).href;frame.title=game.name;frame.allow='autoplay; fullscreen; gamepad';frame.allowFullscreen=true;frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-modals');return frame}
function openGame(game,button){if(game.unavailable){toast('This supplied game file contains a removal notice instead of a playable game.');return}selectedGame=game;rememberGame(game);previousFocus=button;$('#playing-name').textContent=game.name;$('#game-frame-wrap').replaceChildren(makeGameFrame(game));$('#player').hidden=false;$('header').inert=true;$('main').inert=true;document.body.style.overflow='hidden';$('#close-game').focus()}
function closeGame(){$('#game-frame-wrap').replaceChildren();$('#player').hidden=true;$('header').inert=false;$('main').inert=false;document.body.style.overflow='';showPage('games');previousFocus?.focus()}
$('#close-game').onclick=closeGame;
$('#retry-game').onclick=()=>{if(selectedGame)$('#game-frame-wrap').replaceChildren(makeGameFrame(selectedGame))};
$('#blank-button').onclick=()=>{if(!selectedGame)return;const tab=window.open('about:blank','_blank');if(!tab){toast('Allow pop-ups to open your game in a new tab.');return}const doc=tab.document;doc.title=selectedGame.name+' · Neon Arcade';doc.body.style.cssText='margin:0;background:#0b1018;height:100vh;overflow:hidden';const frame=makeGameFrame(selectedGame,doc);frame.style.cssText='width:100%;height:100%;border:0';doc.body.append(frame);tab.opener=null;closeGame()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#player').hidden)closeGame();if(e.key==='/'&&$('#games').hidden===false&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#game-filter').focus()}if(e.key==='Tab'&&!$('#player').hidden){const first=$('#retry-game'),last=$('#music-dock').hidden?$('#close-game'):$('#music-stop');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function normalizeUrl(text){text=text.trim();if(!text)return null;if(/^[a-z][a-z\d+.-]*:/i.test(text)&&!/^https?:/i.test(text))throw new Error('Please enter an http or https address.');if(/^https?:\/\//i.test(text))return new URL(text).href;if(!text.includes(' ')&&/^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/.test(text))return new URL('https://'+text).href;return 'https://www.google.com/search?q='+encodeURIComponent(text)}
async function getController(){if(!controllerPromise)controllerPromise=(async()=>{if(!window.isSecureContext||!navigator.serviceWorker)throw new Error('Open Neon Arcade using localhost or HTTPS to use search.');if(typeof initBootstrap!=='function')throw new Error('The search server is unavailable. Restart Neon Arcade.');const controller=await initBootstrap();await controller.wait();return controller})().catch(e=>{controllerPromise=null;throw e});return controllerPromise}
let navigationId=0;
async function browse(text){const requestId=++navigationId;try{const url=normalizeUrl(text);if(!url)return;$('#search-status').textContent='Connecting…';$('#web-error').hidden=true;const controller=await getController();if(requestId!==navigationId)return;if(!webFrame){webFrame=controller.createFrame();watchFrame(webFrame,showSearchError);webFrame.element.title='Neon Arcade web browser';webFrame.element.allowFullscreen=true;$('#web-frames').append(webFrame.element)}webFrame.go(url);$('#address').value=url;$('#search-start').hidden=true;$('#web-frames').hidden=false;$('#search-status').textContent=''}catch(e){$('#search-status').textContent='';showSearchError('Search couldn’t connect. '+e.message)}}
$('#search-form').onsubmit=e=>{e.preventDefault();browse($('#query').value)};$('#address-form').onsubmit=e=>{e.preventDefault();browse($('#address').value)};document.querySelectorAll('[data-url]').forEach(b=>b.onclick=()=>browse(b.dataset.url));
function searchHome(){navigationId++;$('#search-start').hidden=false;$('#web-frames').hidden=true;$('#web-error').hidden=true;$('#address').value='';$('#search-status').textContent='';$('#query').focus()}
$('#web-home').onclick=searchHome;$('#new-search').onclick=searchHome;$('#web-back').onclick=()=>webFrame?.back();$('#web-forward').onclick=()=>webFrame?.forward();$('#web-reload').onclick=()=>webFrame?.reload();$('#web-full').onclick=()=>{const target=$('#web-frames').hidden?$('#search'):$('#web-frames');target.requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'))};
const loadingStarted=performance.now();
function loadingStage(message,step){$('#loading-message').textContent=message;$('#loading-step').textContent=String(step).padStart(2,'0')+' / 03';$('#loading-fill').style.width=(step/3*100)+'%'}
async function start(){let ready=false;try{const response=await fetch('/catalog.json');if(!response.ok)throw new Error('Game catalog unavailable');catalog=await response.json();renderRecent();$('#home-game-total').textContent=catalog.games.filter(g=>!g.unavailable).length.toLocaleString()+' games to get lost in';loadingStage('Setting the scene…',2);renderGames();for(const w of catalog.wallpapers){const b=document.createElement('button');b.className='wallpaper-choice glass';b.dataset.url=w.url;b.setAttribute('aria-pressed','false');const img=document.createElement('img');img.src=w.url;img.alt='';img.loading='lazy';const label=document.createElement('span');label.textContent=w.name;b.append(img,label);b.onclick=()=>wallpaper(w.url);$('#wallpaper-grid').append(b)}const defaultWallpaper=catalog.wallpapers.find(w=>w.url.includes('relaxing-fireplace'))||catalog.wallpapers[0];const saved=store.get('wallpaper',defaultWallpaper.url);if(saved==='custom')$('#wallpaper').style.backgroundImage=`url(${JSON.stringify(defaultWallpaper.url)})`;else wallpaper(catalog.wallpapers.some(w=>w.url===saved)?saved:defaultWallpaper.url);await initAppearance({store,wallpaper,fallback:defaultWallpaper.url});showPage(location.hash.slice(1)||'home');ready=true;loadingStage('Your arcade is ready.',3)}catch(e){$('#loading-message').textContent='Could not load the arcade. Please try again.';$('#loading-retry').hidden=false;$('#loading-retry').onclick=()=>location.reload();console.error(e)}finally{if(ready)setTimeout(()=>{$('#loading').classList.add('done');setTimeout(()=>$('#loading').hidden=true,650)},Math.max(250,1400-(performance.now()-loadingStarted)))}}start();

const SPORTS_URL='https://thetvapp.plus/v7';
let sportsFrame, sportsLoading=false;
async function openSports(reset=false){
  if(sportsLoading)return;
  if(sportsFrame&&!reset)return;
  sportsLoading=true;
  const status=$('#sports-status');
  status.textContent='Connecting to sports…';
  try{
    const controller=await getController();
    if(!sportsFrame){
      sportsFrame=controller.createFrame();
      sportsFrame.element.title='Sports — TheTVApp';
      watchFrame(sportsFrame,message=>{status.textContent=message+' Use Reload above to retry.'});
      sportsFrame.element.allow='autoplay; fullscreen; picture-in-picture';
      sportsFrame.element.allowFullscreen=true;
      sportsFrame.element.addEventListener('load',()=>{if(status.textContent==='Connecting to sports…')status.textContent='' });
      $('#sports-frames').append(sportsFrame.element);
    }
    sportsFrame.go(SPORTS_URL);
  }catch(error){status.textContent='Sports could not connect. '+error.message+' Use Reload to try again.'}
  finally{sportsLoading=false}
}
$('#sports-home').onclick=()=>openSports(true);
$('#sports-reload').onclick=()=>sportsFrame?sportsFrame.reload():openSports();
$('#sports-full').onclick=()=>$('#sports-frames').requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'));

const MOVIES_URL='https://gaiaflix.live/';
let moviesFrame, moviesLoading=false;
async function openMovies(reset=false){
  if(moviesLoading)return;
  if(moviesFrame&&!reset)return;
  moviesLoading=true;
  const status=$('#movies-status');
  status.textContent='Connecting to movies…';
  try{
    const controller=await getController();
    if(!moviesFrame){
      moviesFrame=controller.createFrame();
      moviesFrame.element.title='Movies — Gaiaflix';
      watchFrame(moviesFrame,message=>{status.textContent=message+' Use Reload above to retry.'},()=>{status.textContent=''});
      moviesFrame.element.allow='autoplay; fullscreen; picture-in-picture';
      moviesFrame.element.allowFullscreen=true;
      moviesFrame.element.addEventListener('load',()=>{if(status.textContent==='Connecting to movies…')status.textContent='' });
      $('#movies-frames').append(moviesFrame.element);
    }
    moviesFrame.go(MOVIES_URL);
  }catch(error){status.textContent='Movies could not connect. '+error.message+' Use Reload to try again.'}
  finally{moviesLoading=false}
}
$('#movies-home').onclick=()=>openMovies(true);
$('#movies-reload').onclick=()=>{if(moviesFrame){$('#movies-status').textContent='Connecting to movies…';moviesFrame.reload()}else openMovies()};
$('#movies-full').onclick=()=>$('#movies-frames').requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'));

function recentIds(){const ids=store.get('recent-games',[]);return Array.isArray(ids)?ids.filter(id=>typeof id==='string'):[]}
function rememberGame(game){store.set('recent-games',[game.id,...recentIds().filter(id=>id!==game.id)].slice(0,6));renderRecent()}
function renderRecent(){
  const games=recentIds().map(id=>catalog.games.find(g=>g.id===id&&!g.unavailable)).filter(Boolean).slice(0,6);
  $('#recent-empty').hidden=games.length>0;
  $('#recent-games').replaceChildren(...games.map(game=>{
    const button=document.createElement('button');button.className='recent-game glass';button.title='Play '+game.name;
    const img=document.createElement('img');img.src=game.cover;img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='/icon.svg'};
    const label=document.createElement('span');label.textContent=game.name;
    button.append(img,label);button.onclick=()=>openGame(game,button);return button;
  }));
}

function showSearchError(message){$('#search-status').textContent='';$('#web-error-text').textContent=message;$('#web-error').hidden=false}
$('#web-retry').onclick=()=>browse($('#address').value||$('#query').value);
$('#web-dismiss').onclick=()=>$('#web-error').hidden=true;
function bookmarks(){const value=store.get('bookmarks',[]);return Array.isArray(value)?value.filter(b=>b&&typeof b.name==='string'&&typeof b.url==='string'):[]}
function renderBookmarks(){const items=bookmarks();$('#bookmarks-empty').hidden=items.length>0;$('#bookmarks').replaceChildren(...items.map(item=>{const card=document.createElement('div');card.className='bookmark-card glass';const open=document.createElement('button');open.className='bookmark-open';open.textContent=item.name;open.title=item.url;open.onclick=()=>browse(item.url);const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Remove bookmark '+item.name);remove.onclick=()=>{store.set('bookmarks',bookmarks().filter(b=>b.url!==item.url));renderBookmarks();$('#add-bookmark').focus()};card.append(open,remove);return card}))}
$('#add-bookmark').onclick=()=>{$('#bookmark-form').hidden=false;$('#bookmark-name').focus()};
$('#bookmark-cancel').onclick=()=>{$('#bookmark-form').hidden=true;$('#bookmark-error').textContent='';$('#add-bookmark').focus()};
$('#bookmark-form').onsubmit=e=>{e.preventDefault();try{const url=bookmarkUrl($('#bookmark-url').value);const name=$('#bookmark-name').value.trim();if(!name)throw new Error('Give your bookmark a name.');const items=bookmarks().filter(b=>b.url!==url);if(items.length>=24)throw new Error('You can save up to 24 bookmarks. Remove one first.');store.set('bookmarks',[...items,{name,url}]);renderBookmarks();e.target.reset();$('#bookmark-form').hidden=true;$('#bookmark-error').textContent='';$('#add-bookmark').focus()}catch(error){$('#bookmark-error').textContent=error.message}};
renderBookmarks();

initShell({navigate:showPage,search:text=>{showPage("search");browse(text)},reload:()=>{const page=location.hash.slice(1);if(page==="search"&&webFrame)webFrame.reload();else if(page==="sports"&&sportsFrame)sportsFrame.reload();else if(page==="movies"&&moviesFrame)moviesFrame.reload();else if(page==="neontube")document.querySelector("#tube-reload").click();else if(page==="music")document.querySelector("#music-reload").click();else location.reload()}});

initMusic(getController);

initTube(getController);

initWeather();

initUpdates();
