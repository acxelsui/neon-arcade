// A successful document response is a load signal, not proof that gameplay works.
export function createGameLoadReport({gameId,runId=crypto.randomUUID(),send=data=>parent.postMessage(data,location.origin)}){
 const seen=new Set();let finished=false;
 return (outcome,detail='')=>{
  if(finished||!gameId||!['loaded','failed','slow'].includes(outcome)||seen.has(outcome))return;
  seen.add(outcome);
  finished=outcome!=='slow';
  try{send({channel:'neon-game-load-v1',gameId,runId,outcome,detail});}catch{/* Reporting must never prevent a game from starting. */}
 };
}
