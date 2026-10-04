const keys={'114':['bestScore','gameState'],'473':['spacebar_clicker_game'],'309':Array.from({length:12},(_,i)=>'SandboxelsSaves/'+(i+1))};
export function gameSaveRequest(data){
 if(typeof data.gameId!=='string'||!Object.hasOwn(keys,data.gameId))throw Error('Cloud saves are not supported for this game.');
 if(data.action==='game-save-read')return ['neon_game_save_read',{game_id:data.gameId}];
 if(data.action!=='game-save-write'||!Number.isSafeInteger(data.revision)||data.revision<0||!data.state||typeof data.state!=='object'||Array.isArray(data.state)||Object.keys(data.state).length!==keys[data.gameId].length||keys[data.gameId].some(key=>!Object.hasOwn(data.state,key)||(data.state[key]!==null&&typeof data.state[key]!=='string'))||new TextEncoder().encode(JSON.stringify(data.state)).length>524288)throw Error('Invalid game save.');
 return ['neon_game_save_write',{game_id:data.gameId,save_state:Object.fromEntries(keys[data.gameId].map(key=>[key,data.state[key]])),expected_revision:data.revision}];
}
