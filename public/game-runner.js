import { watchFrame } from './proxy-feedback.js';
import { gameTransport, GAME_ORIGIN } from './game-transport.js';
import {createGameLoadReport} from './game-load-report.js';
import {prepareGameSave} from './game-save-runner.js';
import {prepareLolMod} from './lol-mod-runner.js';
import {getLolModGame} from './lol-mod-games.js';
const status = document.querySelector('#status');
const report=createGameLoadReport({gameId:new URLSearchParams(location.search).get('id')});
let failed=false;
function showFailure(message,outcome='failed',detail='start'){report(outcome,detail);failed=true;status.hidden=false;status.replaceChildren();const text=document.createElement('p');text.textContent=message;const retry=document.createElement('button');retry.textContent='Try again ↻';retry.onclick=()=>location.reload();status.append(text,retry)}
let slow=setTimeout(()=>showFailure('This game is taking longer than expected. You can retry or return to Games.','slow','timeout'),45000);
try {
  const response = await fetch('/catalog.json');
  if (!response.ok) throw new Error('Could not load the game catalog.');
  const catalog = await response.json();
  const game = catalog.games.find(game => game.id === new URLSearchParams(location.search).get('id'));
  if (!game || game.unavailable) throw new Error('This game is unavailable.');
  document.title = game.name + ' · Neon Arcade';
  clearTimeout(slow);
  const saveReady=await prepareGameSave(game.id,status);
  if(saveReady!==false){
  slow=setTimeout(()=>showFailure('This game is taking longer than expected. You can retry or return to Games.','slow','timeout'),45000);
  const mod=getLolModGame(game.id)?await prepareLolMod({gameId:game.id}):null;
  const controller = await initBootstrap(transport => gameTransport(transport, location.origin));
  const frame = controller.createFrame();
  watchFrame(frame,message=>{clearTimeout(slow);showFailure(message,'failed',message.includes('error (')?'http':'network')},()=>{clearTimeout(slow);failed=false;status.hidden=true;report('loaded')});
  frame.element.title = game.name;
  frame.element.allow = 'autoplay; fullscreen; gamepad';
  frame.element.allowFullscreen = true;
  frame.element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-modals');
  frame.element.addEventListener('load', () => { if(!failed && frame.element.src) {clearTimeout(slow);status.hidden = true;} });
  document.body.append(frame.element);
  mod?.attach(frame);
  frame.go(new URL(game.url, GAME_ORIGIN).href);
  }
} catch (error) {
  clearTimeout(slow);showFailure('Could not start the game. '+error.message);
}
