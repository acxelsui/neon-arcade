export function acceptGameReport(event,{source,origin,gameId}){
 const data=event.data;
 if(!source||event.source!==source||event.origin!==origin||data?.channel!=='neon-game-load-v1'||data.gameId!==gameId||!['loaded','failed','slow'].includes(data.outcome)||!['','http','network','timeout','start'].includes(data.detail)||typeof data.runId!=='string'||!/^[a-f0-9-]{36}$/i.test(data.runId))return null;
 return {action:'game-load-report',gameId,runId:data.runId,outcome:data.outcome,detail:data.detail};
}
export function initGameStatusBridge(){
 let active=null;const sent=new Set(),account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 window.addEventListener('neon-game',event=>{active=event.detail?.id??null;sent.clear();});
 window.addEventListener('message',event=>{
  if(parent===window||!active)return;
  const report=acceptGameReport(event,{source:document.querySelector('#game-frame-wrap iframe')?.contentWindow,origin:location.origin,gameId:active});
  if(!report)return;const key=report.runId+':'+report.outcome;if(sent.has(key)||sent.size>=12)return;sent.add(key);
  parent.postMessage({channel:'neon-members-v1',type:'chat-request',requestId:crypto.randomUUID(),...report},account);
 });
}
if(typeof window!=='undefined')initGameStatusBridge();
