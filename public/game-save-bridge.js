import {saveAdapters,validSave} from './game-save-adapters.js';
import {createGameSaveModel} from './game-save-model.js';
export function validSaveMessage(event,{source,origin,gameId}){
 const data=event.data;
 return !!source&&event.source===source&&event.origin===origin&&data?.channel==='neon-game-save-v1'&&data.gameId===gameId&&Object.hasOwn(saveAdapters,gameId)&&['prepare','choose','start'].includes(data.action)&&typeof data.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(data.requestId);
}
export function initGameSaveBridge(){
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app',pending=new Map();
 let self=null,active=null,session=null,generation=0,closing=Promise.resolve();
 const notice=document.createElement('span');notice.id='game-save-status';notice.setAttribute('role','status');document.querySelector('#game-menu-panel')?.append(notice);
 function message(copy){notice.textContent=copy;notice.title=copy;}
 function request(action,args,userId=self){
  if(!userId||userId!==self||parent===window)return Promise.reject(Error('Open through your signed-in Neon account.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Cloud saves could not connect. Browser progress is kept.'));},10000);pending.set(requestId,{resolve,reject,timer,userId});parent.postMessage({channel:'neon-members-v1',type:'chat-request',action,requestId,expectedUserId:userId,...args},account);});
 }
 function snapshot(result,userId,gameId){
  if(result?.user_id!==userId||!Number.isSafeInteger(result.revision)||result.revision<0)throw Error('Your save account changed. Reopen the game.');
  return {...result,state:result.state===null?null:validSave(gameId,result.state)};
 }
 async function flush(item){
  if(!item?.started||item.closed||item.userId!==self)return;
  item.model.preserve();
  if(item.writing){await item.writing;return flush(item);}
  let state;try{state=item.model.sample();}catch(error){message(error.message);return;}
  if(!item.online||item.conflict||!item.model.dirty(state))return;
  item.writing=(async()=>{
   try{
    const result=await request('game-save-write',{gameId:item.gameId,state,revision:item.model.revision},item.userId);
    if(item.userId!==self)return;
    if(result?.conflict){item.conflict=true;message('Another laptop has a newer save. Reopen to choose.');return;}
    snapshot({...result,state:null},item.userId,item.gameId);item.model.committed(state,result.revision);message('Saved to your Neon account');
   }catch(error){message('Browser save kept · cloud sync unavailable');}
   finally{item.writing=null;}
  })();await item.writing;
 }
 function stop(){
  generation++;const item=session;session=null;if(!item)return;
  clearInterval(item.sampleTimer);clearInterval(item.syncTimer);item.model?.preserve();
  closing=closing.catch(()=>{}).then(()=>flush(item)).catch(()=>{}).finally(()=>{item.closed=true;item.release?.();});
 }
 window.addEventListener('neon-game',event=>{stop();active=event.detail?.id??null;message(active&&saveAdapters[active]?'Checking account save…':'');});
 window.addEventListener('message',async event=>{
  const data=event.data;
  if(event.source===parent&&event.origin===account&&data?.channel==='neon-members-v1'){
   if(data.type==='members'&&data.self?.id){if(self&&self!==data.self.id){stop();for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Your account changed.'));}pending.clear();}self=data.self.id;}
   if(data.type==='chat-result'){
    const item=pending.get(data.requestId);if(!item)return;pending.delete(data.requestId);clearTimeout(item.timer);
    if(item.userId!==self||data.self!==self)item.reject(Error('Your account changed.'));else if(data.error)item.reject(Error(data.error));else item.resolve(data.result);
   }return;
  }
  const frame=document.querySelector('#game-frame-wrap iframe');
  if(!validSaveMessage(event,{source:frame?.contentWindow,origin:location.origin,gameId:active}))return;
  const id=active,source=event.source;let version=generation;
  const reply=extra=>{if(generation===version&&active===id&&document.querySelector('#game-frame-wrap iframe')?.contentWindow===source)source.postMessage({channel:'neon-game-save-result-v1',gameId:id,requestId:data.requestId,...extra},location.origin);};
  try{
   if(data.action==='prepare'){
    if(session){stop();version=generation;}
    await closing;if(version!==generation)return;
    if(!self)throw Error('Account saves are unavailable. Your existing browser progress is kept.');
    const item={gameId:id,userId:self,started:false,online:false,closed:false,conflict:false};session=item;
    if(navigator.locks){
     const acquired=await new Promise((resolve,reject)=>{navigator.locks.request('neon-game-save:'+id,{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}await new Promise(release=>{item.release=release;resolve(true);});}).catch(reject);});
     if(!acquired){session=null;reply({locked:true});return;}
    }
    if(version!==generation){item.release?.();return;}
    item.model=createGameSaveModel({storage:localStorage,gameId:id,userId:self});
    try{item.cloud=snapshot(await request('game-save-read',{gameId:id}),item.userId,id);item.online=true;}catch{item.cloud=null;}
    if(version!==generation){item.release?.();return;}
    const choice=item.model.choose(item.cloud);
    if(choice==='conflict'){reply({conflict:true});return;}
    item.model.apply(item.cloud,choice);message(item.online?'Account save ready':'Browser saves · cloud sync unavailable');reply({ready:true,online:item.online});
   }else if(data.action==='choose'){
    if(!session?.model||!session.cloud||session.started||!['local','cloud'].includes(data.choice))throw Error('Choose a valid saved game.');
    session.model.apply(session.cloud,data.choice);message('Account save ready');reply({ready:true,online:true});
   }else{
    if(!session?.model||session.started)throw Error('Game save is not ready.');session.started=true;
    const item=session;item.sampleTimer=setInterval(()=>{try{item.model.sample();}catch{}},1000);
    item.syncTimer=setInterval(()=>flush(item),15000);reply({ready:true});
   }
  }catch(error){message('Browser progress is kept');reply({error:error.message});}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush(session);});
 window.addEventListener('pagehide',()=>{session?.model.preserve();});
 // The settings copy describes real coverage; it never promises every game's engine can sync.
 const section=document.createElement('section');section.className='settings-panel glass';section.id='game-save-settings';
 const title=document.createElement('h2');title.textContent='Game saves';const copy=document.createElement('p');copy.textContent='Keep your progress between laptops with the same Neon account. Account sync supports 2048, Spacebar Clicker, and the 12 saved-world slots in Sandboxels. Other games keep their current save system. Cloud sync runs in the main game player; about:blank keeps browser saves. If progress differs, you choose which save to continue. A backup is kept before replacing it.';
 const backups=document.createElement('button');backups.textContent='Download save backups';backups.onclick=()=>{
  const saved={};for(const id of Object.keys(saveAdapters)){try{const rows=JSON.parse(localStorage.getItem('neon-game-save-backups:'+id)||'[]').filter(row=>row.userId===self||row.userId==='legacy');if(rows.length)saved[saveAdapters[id].name]=rows;}catch{}}
  if(!Object.keys(saved).length){backupStatus.textContent='No saves have needed a backup yet.';return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='neon-game-save-backups.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);backupStatus.textContent='Backup download started.';
 };const backupStatus=document.createElement('p');backupStatus.setAttribute('role','status');section.append(title,copy,backups,backupStatus);document.querySelector('#settings')?.append(section);
}
