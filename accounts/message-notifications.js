export function incomingMessages(rows,self,since){
 return (Array.isArray(rows)?rows:[]).filter(r=>r.sender_id!==self&&typeof r.id==='string'&&/^\d+$/.test(r.id)&&typeof r.body==='string'&&r.body.length<=1000&&typeof r.username==='string'&&Date.parse(r.created_at)>since).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
}
export function initMessageNotifications({rpc,send,getProfile}){
 let owner=null,seen=new Map(),started=0,busy=false,initialized=false;
 async function poll(){
  const id=getProfile()?.id;
  if(id!==owner){owner=id;seen=new Map();started=Date.now();initialized=false;send('message-notifications',{self:id||'',rows:[]})}
  if(!id||busy)return;busy=true;
  try{
   const conversations=await rpc('neon_chat_conversations');if(getProfile()?.id!==id)return;
   if(!initialized){for(const c of conversations||[])seen.set(c.id,Date.parse(c.updated_at));initialized=true;return}
   const messages=[];
   for(const c of conversations||[]){
    const previous=seen.get(c.id)??started,next=Date.parse(c.updated_at);if(!(next>previous))continue;
    const rows=await rpc('neon_chat_history',{peer:c.id});if(getProfile()?.id!==id)return;
    messages.push(...incomingMessages(rows,id,previous));seen.set(c.id,next);
   }
   if(messages.length)send('message-notifications',{self:id,rows:messages});
  }catch{/* Retry on the next poll; do not advance a failed conversation. */}finally{busy=false}
 }
 setInterval(poll,5000);window.addEventListener('online',poll);poll();return poll;
}
