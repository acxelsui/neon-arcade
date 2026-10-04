// Only verified save keys are read. Proxy cookies, login data and other storage stay untouched.
export const saveAdapters=Object.freeze({
 '114':{name:'2048',keys:['bestScore','gameState']},
 '473':{name:'Spacebar Clicker',keys:['spacebar_clicker_game']},
 '309':{name:'Sandboxels',keys:Array.from({length:12},(_,i)=>'SandboxelsSaves/'+(i+1))}
});
export const savePrefix='games.neon-arcade.invalid@';
export function validSave(gameId,state){
 const adapter=saveAdapters[gameId];
 if(!adapter||!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).length!==adapter.keys.length||adapter.keys.some(key=>!Object.hasOwn(state,key)||(state[key]!==null&&typeof state[key]!=='string')))throw Error('Invalid game save.');
 if(new TextEncoder().encode(JSON.stringify(state)).length>524288)throw Error('This save is too large to sync. Your browser save is kept.');
 return Object.fromEntries(adapter.keys.map(key=>[key,state[key]]));
}
export function readGameSave(storage,gameId){return validSave(gameId,Object.fromEntries(saveAdapters[gameId].keys.map(key=>[key,storage.getItem(savePrefix+key)])));}
export function emptySave(state){return Object.values(state).every(value=>value===null);}
export function sameSave(a,b){return !!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&a[key]===b[key]);}
