import {savePrefix} from './game-save-adapters.js';

export const creditGames=Object.freeze({
 '33':{name:'Retro Bowl',key:'RetroBowl.0.savedata.ini'},
 '34':{name:'Retro Bowl College',key:'RetroBowlCollege.0.savedata.ini'}
});
const creditLine=/^([ \t]*coach_credit[ \t]*=[ \t]*")([0-9]+(?:\.0+)?)("[ \t]*\r?$)/gm;
export function creditAmount(value){
 const text=String(value).trim();
 if(!/^\d{1,12}$/.test(text))throw Error('Choose a whole number from 0 to 999,999,999,999.');
 return String(Number(text));
}
export function readCredits(storage,gameId,slot=1){
 const game=creditGames[gameId];if(!game)throw Error('Credits are available only for Retro Bowl and Retro Bowl College.');
 if(!Number.isInteger(slot)||slot<1||slot>5)throw Error('Choose a save slot from 1 to 5.');
 const key=savePrefix+game.key.replace('savedata.ini','savedata'+(slot===1?'':slot)+'.ini'),save=storage.getItem(key);
 if(!save)throw Error('No saved career in slot '+slot+'. Start or load a career and let the game save, then try Apply again.');
 const matches=[...save.matchAll(creditLine)];
 if(save.length>2*1024*1024||matches.length!==1)throw Error('This save format is not supported. Your progress has not changed.');
 return {key,save,credits:String(Number(matches[0][2]))};
}
export function updateCredits(storage,gameId,amount,now=Date.now(),slot=1){
 const value=creditAmount(amount),before=readCredits(storage,gameId,slot);
 const backupKey='neon-retro-credit-backup:'+gameId;
 let history=[];try{const saved=JSON.parse(storage.getItem(backupKey)||'[]');if(Array.isArray(saved))history=saved;}catch{}
 // Keep the backup before touching the game's existing proxy storage.
 const backup={at:now,save:before.save};if(slot!==1)backup.slot=slot;
 storage.setItem(backupKey,JSON.stringify([backup,...history].slice(0,10)));
 const next=before.save.replace(creditLine,(_,left,old,right)=>left+value+right);
 storage.setItem(before.key,next);
 return {credits:value,previous:before.credits};
}

export function initGameCredits({doc=document,win=window,storage=localStorage}={}){
 const panel=doc.querySelector('#game-menu-panel');if(!panel||doc.querySelector('#game-hacks'))return;
 const section=doc.createElement('section');section.id='game-hacks';section.className='game-menu-hacks';section.hidden=true;section.setAttribute('aria-label','Retro Bowl hacks');
 const toggle=doc.createElement('button');toggle.type='button';toggle.id='game-hacks-toggle';toggle.textContent='Hacks';toggle.setAttribute('aria-label','Hacks');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','game-hacks-form');
 const form=doc.createElement('form');form.id='game-hacks-form';form.hidden=true;form.noValidate=true;
 const heading=doc.createElement('strong'),description=doc.createElement('p');description.textContent='Choose your saved career and credits (0–999,999,999,999). Applying keeps a backup and refreshes the game.';
 const slotLabel=doc.createElement('label');slotLabel.textContent='Save slot';slotLabel.htmlFor='game-hacks-slot';const slots=doc.createElement('select');slots.id='game-hacks-slot';
 for(let slot=1;slot<=5;slot++){const option=doc.createElement('option');option.value=String(slot);option.textContent='Slot '+slot;slots.append(option);}
 const label=doc.createElement('label');label.textContent='Coaching credits';label.htmlFor='game-hacks-credits';
 const amount=doc.createElement('input');amount.id='game-hacks-credits';amount.type='number';amount.inputMode='numeric';amount.min='0';amount.max='999999999999';amount.step='1';amount.required=true;
 const actions=doc.createElement('div');actions.className='game-hacks-actions';
 const apply=doc.createElement('button');apply.type='submit';apply.textContent='Apply & refresh';
 const refresh=doc.createElement('button');refresh.type='button';refresh.textContent='Refresh game';refresh.onclick=()=>doc.querySelector('#retry-game').click();
 const status=doc.createElement('p');status.id='game-hacks-status';status.setAttribute('role','status');
 actions.append(apply,refresh);form.append(heading,description,slotLabel,slots,label,amount,status,actions);section.append(toggle,form);panel.append(section);
 let active=null;const selected=new Map();
 function close(){form.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function inspect(){
  // Recheck live storage whenever the user selects a career or applies. Never
  // permanently disable the editor because the game had not saved on opening.
  apply.disabled=false;
  try{const state=readCredits(storage,active,Number(slots.value));amount.value=state.credits;status.textContent='Slot '+slots.value+' · current credits: '+Number(state.credits).toLocaleString();}
  catch(error){amount.value='';status.textContent=error.message;}
 }
 slots.onchange=()=>{selected.set(active,Number(slots.value));inspect();};
 toggle.onclick=()=>{
  if(!form.hidden){close();return;}
  form.hidden=false;toggle.setAttribute('aria-expanded','true');heading.textContent=creditGames[active]?.name||'';
  let slot=selected.get(active);if(!slot){slot=1;for(let candidate=1;candidate<=5;candidate++){try{readCredits(storage,active,candidate);slot=candidate;break;}catch{}}}
  slots.value=String(slot);inspect();amount.focus();
 };
 form.onsubmit=event=>{
  event.preventDefault();
  try{const result=updateCredits(storage,active,amount.value,Date.now(),Number(slots.value));status.textContent='Slot '+slots.value+' credits set to '+Number(result.credits).toLocaleString()+'. Refreshing…';doc.querySelector('#retry-game').click();close();}
  catch(error){status.textContent=error.name==='QuotaExceededError'?'Browser storage is full. Credits were not changed.':error.message;}
 };
 win.addEventListener('neon-game',event=>{active=event.detail?.id??null;section.hidden=!Object.hasOwn(creditGames,active);close();status.textContent='';});
}
