export function incomingMessages(rows,self,since){
 return (Array.isArray(rows)?rows:[]).filter(r=>r.sender_id!==self&&typeof r.id==='string'&&/^\d+$/.test(r.id)&&typeof r.body==='string'&&r.body.length<=1000&&typeof r.username==='string'&&Date.parse(r.created_at)>since).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
}
export function initMessageNotifications({rpc,send,getProfile}){
 let owner=null,seen=new Map(),busy=false,initialized=false,queued=new Map();
 async function poll(){
  const id=getProfile()?.id;
  if(id!==owner){owner=id;seen=new Map();queued=new Map();initialized=false;send('message-notifications',{self:id||'',rows:[]})}
  if(!id||busy)return;busy=true;
  try{
   const conversations=await rpc('neon_chat_conversations');if(getProfile()?.id!==id)return;
   if(!initialized){for(const c of conversations||[])seen.set(c.id,Date.parse(c.updated_at));initialized=true;return}

   for(const c of conversations||[]){
    // New conversations must not depend on the visitor's device clock.
    const previous=seen.get(c.id)??-Infinity,next=Date.parse(c.updated_at);if(!(next>previous))continue;
    const rows=await rpc('neon_chat_history',{peer:c.id});if(getProfile()?.id!==id)return;
    const incoming=incomingMessages(rows,id,previous);
    for(const row of incoming)queued.set(row.id,{row,expires:Date.now()+15000});
    if(incoming.length)send('message-notifications',{self:id,rows:incoming});
    seen.set(c.id,next);
   }
  }catch{/* Retry on the next poll; do not advance a failed conversation. */}finally{
   if(getProfile()?.id===id){
    for(const [key,item] of queued)if(item.expires<=Date.now())queued.delete(key);
    if(queued.size)send('message-notifications',{self:id,rows:[...queued.values()].map(item=>item.row)});
   }
   busy=false;
  }
 }
 setInterval(poll,5000);window.addEventListener('online',poll);poll();return poll;
}
