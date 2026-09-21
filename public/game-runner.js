import { watchFrame } from './proxy-feedback.js';
import { gameTransport, GAME_ORIGIN } from './game-transport.js';
const status = document.querySelector('#status');
let failed=false;
function showFailure(message){failed=true;status.hidden=false;status.replaceChildren();const text=document.createElement('p');text.textContent=message;const retry=document.createElement('button');retry.textContent='Try again ↻';retry.onclick=()=>location.reload();status.append(text,retry)}
const slow=setTimeout(()=>showFailure('This game is taking longer than expected. You can retry or return to Games.'),45000);
try {
  const response = await fetch('/catalog.json');
  if (!response.ok) throw new Error('Could not load the game catalog.');
  const catalog = await response.json();
  const game = catalog.games.find(game => game.id === new URLSearchParams(location.search).get('id'));
  if (!game || game.unavailable) throw new Error('This game is unavailable.');
  document.title = game.name + ' · Neon Arcade';
  const controller = await initBootstrap(transport => gameTransport(transport, location.origin));
  const frame = controller.createFrame();
  watchFrame(frame,message=>{clearTimeout(slow);showFailure(message)},()=>{clearTimeout(slow);failed=false;status.hidden=true});
  frame.element.title = game.name;
  frame.element.allow = 'autoplay; fullscreen; gamepad';
  frame.element.allowFullscreen = true;
  frame.element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-modals');
  frame.element.addEventListener('load', () => { if(!failed && frame.element.src) {clearTimeout(slow);status.hidden = true;} });
  document.body.append(frame.element);
  frame.go(new URL(game.url, GAME_ORIGIN).href);
} catch (error) {
  clearTimeout(slow);showFailure('Could not start the game. '+error.message);
}
