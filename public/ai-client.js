import {accountOrigin} from './account-request.js';
export function createAIClient({win=window,origin=accountOrigin,onRevoke=()=>{}}={}){
 let self=null,authorized=false,checking=false;const pending=new Map();let grant,deny;
 const ready=new Promise((resolve,reject)=>{grant=resolve;deny=reject;});
 ready.catch(()=>{});
 function reset(){authorized=false;for(const item of pending.values())item.reject(Error('Your account changed. Reopen Neon AI.'));pending.clear();onRevoke();}
 function call(action,payload,signal){
  if(signal?.aborted)return Promise.reject(new DOMException('Stopped','AbortError'));
  if(win.parent===win||!self)return Promise.reject(Error('Open Neon AI through your signed-in account.'));
  const requestId=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
   const abort=()=>{win.parent.postMessage({channel:'neon-members-v1',type:'ai-request',action:'cancel',requestId:crypto.randomUUID(),target:requestId},origin);finish();reject(new DOMException('Stopped','AbortError'));};
   const timer=setTimeout(()=>{finish();reject(Error('Neon AI did not respond. Start the companion and try again.'));},190000);
   const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);pending.delete(requestId);};
   pending.set(requestId,{self,resolve:data=>{finish();resolve(data);},reject:error=>{finish();reject(error);}});
   signal?.addEventListener('abort',abort,{once:true});
   win.parent.postMessage({channel:'neon-members-v1',type:'ai-request',action,requestId,payload},origin);
  });
 }
 win.addEventListener('message',event=>{
  if(event.source!==win.parent||event.origin!==origin||event.data?.channel!=='neon-members-v1')return;
  const data=event.data;
  if(data.type==='members'){
   const next=data.self?.id||null;if(self&&next!==self){reset();deny(Error('Your account changed. Reload Neon AI.'));self=next;return;}
   if(next&&!checking){self=next;checking=true;call('access').then(({result})=>{if(result?.allowed!==true||result.self!==self)throw Error('Sign in to use the installed companion.');authorized=true;grant(self);}).catch(error=>{if(authorized)reset();deny(error);}).finally(()=>{checking=false;});}return;
  }
  if(data.type!=='ai-result')return;const item=pending.get(data.requestId);if(!item)return;
  if(data.self!==self||item.self!==self)item.reject(Error('Your account changed.'));
  else if(data.error)item.reject(Error(data.error));else item.resolve(data);
 });
 if(win.parent===win)deny(Error('Open Neon AI through your signed-in account.'));
 return {ready,isAllowed:()=>authorized,async request(url,options={}){
  if(!authorized)throw Error('Sign in to use the installed companion.');
  const {result,status=200}=await call(options.method==='POST'?'chat':'status',options.body?JSON.parse(options.body):undefined,options.signal);
  return Response.json(result||{error:'Neon AI is unavailable.'},{status});
 }};
}
