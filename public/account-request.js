export const accountOrigin=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
export function createAccountRequests(){
 const pending=new Map();let self=null;
 function reset(){for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Your account changed. Please retry.'));}pending.clear();}
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==accountOrigin||event.data?.channel!=='neon-members-v1')return;
  const data=event.data;if(data.type==='members'&&data.self?.id){if(self&&self!==data.self.id)reset();self=data.self.id;return;}
  if(data.type!=='social-result')return;const item=pending.get(data.requestId);if(!item)return;
  clearTimeout(item.timer);pending.delete(data.requestId);
  if((item.self&&data.self&&item.self!==data.self)||(self&&data.self&&self!==data.self))item.reject(Error('Your account changed. Please retry.'));
  else if(data.error)item.reject(Error(data.error));else{self=data.self;item.resolve(data.result);}
 });
 return {getSelf:()=>self,request(action,args={}){
  if(parent===window)return Promise.reject(Error('Open Neon Arcade through your signed-in account.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Your account could not connect. Please retry.'));},15000);
   pending.set(requestId,{resolve,reject,timer,self});parent.postMessage({channel:'neon-members-v1',type:'social-request',requestId,action,...args},accountOrigin);
  });
 }};
}
