import {saveAdapters} from './game-save-adapters.js';
export async function prepareGameSave(gameId,status){
 if(!saveAdapters[gameId]||parent===window)return;
 // about:blank's parent is on the isolated account origin. Keep its original browser saves.
 try{if(parent.location.origin!==location.origin)return;}catch{return;}
 function request(action,extra={}){
  const requestId=crypto.randomUUID();return new Promise(resolve=>{
   const finish=result=>{clearTimeout(timer);window.removeEventListener('message',receive);resolve(result);};
   const receive=event=>{const data=event.data;if(event.source===parent&&event.origin===location.origin&&data?.channel==='neon-game-save-result-v1'&&data.requestId===requestId&&data.gameId===gameId)finish(data);};
   const timer=setTimeout(()=>finish({error:'Account save connection unavailable.'}),15000);window.addEventListener('message',receive);parent.postMessage({channel:'neon-game-save-v1',gameId,requestId,action,...extra},location.origin);
  });
 }
 const result=await request('prepare');
 if(result.locked){status.replaceChildren();status.append(Object.assign(document.createElement('p'),{textContent:'This game is open in another Neon window. Close it there, then retry to protect your save.'}));const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>location.reload();status.append(retry);return false;}
 if(result.conflict){
  const choice=await new Promise(resolve=>{status.replaceChildren();const title=document.createElement('h2');title.textContent='Two different saved games';const copy=document.createElement('p');copy.textContent='This browser and your Neon account have different progress. Choose which to continue. A browser backup is kept before replacing any progress.';status.append(title,copy);for(const [choice,label] of [['local','Keep this browser’s progress'],['cloud','Use my Neon account save']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>resolve(choice);status.append(button);}});
  const chosen=await request('choose',{choice});if(!chosen.ready)throw Error(chosen.error||'Could not choose the save. Please retry.');
 }
 if(result.ready||result.conflict){const started=await request('start');if(!started.ready)throw Error(started.error||'Could not prepare the save.');}
 return true;
}
