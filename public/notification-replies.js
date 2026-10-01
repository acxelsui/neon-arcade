const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function canReplyTo(peer){return typeof peer==='string'&&uuid.test(peer)}
export function createNotificationReplies({post,getOwner,setTimer=setTimeout,clearTimer=clearTimeout,newId=()=>crypto.randomUUID()}){
 const pending=new Map();
 function reset(){for(const item of pending.values()){clearTimer(item.timer);item.reject(new Error('Your account changed. Open chat to reconnect.'))}pending.clear()}
 function send(peer,value){
  const owner=getOwner(),text=typeof value==='string'?value.trim():'';
  if(!owner||!canReplyTo(peer)||peer===owner)return Promise.reject(new Error('Choose a valid player to reply to.'));
  if(!text||text.length>1000)return Promise.reject(new Error('Write a reply under 1,000 characters.'));
  if(pending.size>=5)return Promise.reject(new Error('Please wait for your replies to send.'));
  const requestId=newId();return new Promise((resolve,reject)=>{
   const timer=setTimer(()=>{pending.delete(requestId);reject(new Error('Reply could not connect. Try again.'))},15000);
   pending.set(requestId,{owner,resolve,reject,timer});
   try{post({channel:'neon-members-v1',type:'chat-request',requestId,action:'send',peer,text})}catch(error){clearTimer(timer);pending.delete(requestId);reject(error)}
  });
 }
 function receive(data){
  if(data?.type!=='chat-result')return;
  const item=pending.get(data.requestId);if(!item)return;
  clearTimer(item.timer);pending.delete(data.requestId);
  if(item.owner!==getOwner()||(data.self&&data.self!==item.owner))item.reject(new Error('Your account changed. Open chat to reconnect.'));
  else if(data.error)item.reject(new Error(data.error));else item.resolve();
 }
 return {send,receive,reset};
}
