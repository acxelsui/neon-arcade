import {saveAdapters,savePrefix,validSave,readGameSave,emptySave,sameSave} from './game-save-adapters.js';
const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
export function chooseSave({local,meta,cloud}){
 if(!cloud?.state)return 'local';
 if(sameSave(local,cloud.state))return 'cloud';
 if(!meta&&emptySave(local))return 'cloud';
 if(meta&&sameSave(local,meta.base))return 'cloud';
 if(meta&&cloud.revision===meta.revision)return 'local';
 return 'conflict';
}
export function createGameSaveModel({storage,gameId,userId}){
 const key='neon-game-save-v1:'+userId+':'+gameId,claimKey='neon-game-save-owner:'+gameId;
 let meta=read(storage,key),revision=meta?.revision??0,base=meta?.base??null;
 const owner=storage.getItem(claimKey);
 const local=owner===null||owner===userId?readGameSave(storage,gameId):validSave(gameId,meta?.state||Object.fromEntries(saveAdapters[gameId].keys.map(key=>[key,null])));
 function backup(state,previousOwner){
  if(emptySave(state))return;
  const key='neon-game-save-backups:'+gameId,backups=read(storage,key)||[];
  // Store before changing any of the game's keys; if storage is full, don't replace progress.
  storage.setItem(key,JSON.stringify([{state,userId:previousOwner||'legacy',at:new Date().toISOString()},...backups].slice(0,3)));
 }
 function persist(state){storage.setItem(key,JSON.stringify({state,revision,base}));}
 return {
  gameId,userId,local,meta,
  get revision(){return revision;},get base(){return base;},
  choose(cloud){return chooseSave({local,meta,cloud});},
  apply(cloud,choice){
   const state=validSave(gameId,choice==='cloud'?cloud.state:local),raw=readGameSave(storage,gameId);
   if(!sameSave(raw,state))backup(raw,owner);
   if(choice==='cloud'&&!sameSave(local,state))backup(local,userId);
   if(cloud){revision=cloud.revision;base=cloud.state;}
   // Commit the account copy before replacing the game's native keys.
   const previousMeta=storage.getItem(key);
   persist(state);
   try{
    storage.setItem(claimKey,userId);
    for(const [name,value] of Object.entries(state)){if(value===null)storage.removeItem(savePrefix+name);else storage.setItem(savePrefix+name,value);}
   }catch(error){
    // A quota error during replacement must not leave half of a game save applied.
    for(const name of Object.keys(raw))storage.removeItem(savePrefix+name);
    for(const [name,value] of Object.entries(raw))if(value!==null)storage.setItem(savePrefix+name,value);
    if(owner===null)storage.removeItem(claimKey);else storage.setItem(claimKey,owner);
    if(previousMeta===null)storage.removeItem(key);else storage.setItem(key,previousMeta);
    throw error;
   }
   return state;
  },
  sample(){if(storage.getItem(claimKey)!==userId)throw Error('Another account is using this game.');const state=readGameSave(storage,gameId);persist(state);return state;},
  dirty(state){return base===null?!emptySave(state):!sameSave(state,base);},
  committed(state,nextRevision){base=validSave(gameId,state);revision=nextRevision;persist(this.sample());},
  preserve(){try{return this.sample();}catch{return null;}}
 };
}
