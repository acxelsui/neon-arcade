import {accountOrigin} from './account-request.js';
export function createHacksAccess({win=window,origin=accountOrigin}={}){
 const pending=new Map();let self=null;
 function clear(){for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Your account changed. Reopen Hacks.'));}pending.clear();}
 win.addEventListener('message',event=>{
  if(event.source!==win.parent||event.origin!==origin||event.data?.channel!=='neon-members-v1')return;
  const data=event.data;
  if(data.type==='members'){const next=data.self?.id||null;if(self!==next){self=next;clear();}return;}
  if(data.type!=='hacks-result')return;const item=pending.get(data.requestId);if(!item)return;
  clearTimeout(item.timer);pending.delete(data.requestId);
  if(!self||data.self!==self||item.self!==self)item.reject(Error('Your account changed. Reopen Hacks.'));
  else if(data.error)item.reject(Error(data.error));else if(data.result?.self!==self||data.result?.allowed!==true)item.reject(Error('Admin or owner access is required.'));else item.resolve(data.result);
 });
 return {self:()=>self,request(id){
  if(win.parent===win||!self)return Promise.reject(Error('Open Hacks through your signed-in Neon account.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Hacks access could not be checked. Try again.'));},15000);pending.set(requestId,{resolve,reject,timer,self});win.parent.postMessage({channel:'neon-members-v1',type:'hacks-request',requestId,...(id?{id}:{})},origin);});
 }};
}
