const gameId=/^[a-z0-9][a-z0-9_-]{0,119}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function gameStatusRequest(data){
 if(data.action==='owner-game-status')return ['neon_owner_game_status',{}];
 if(typeof data.gameId!=='string'||!gameId.test(data.gameId))throw Error('Choose a valid game.');
 if(data.action==='game-load-report'){
  if(typeof data.runId!=='string'||!uuid.test(data.runId)||!['loaded','failed','slow'].includes(data.outcome)||!['','http','network','timeout','start'].includes(data.detail??''))throw Error('Invalid game load report.');
  return ['neon_game_load_report',{game_id:data.gameId,run_id:data.runId,outcome:data.outcome,detail:data.detail??''}];
 }
 if(data.action==='owner-game-review'){
  const note=typeof data.note==='string'?data.note.trim():'';
  if(!['working','broken','clear'].includes(data.status)||note.length>240)throw Error('Choose Working, Broken, or Clear and keep the note under 240 characters.');
  return ['neon_owner_game_review',{game_id:data.gameId,review_status:data.status,note}];
 }
 throw Error('Unknown game status action.');
}
