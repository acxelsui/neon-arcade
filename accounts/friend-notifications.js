export function initFriendNotifications({rpc,send,getProfile,events=window,repeat=setInterval,now=Date.now}){
 let owner=null,seen=new Set(),queued=new Map(),initialized=false,busy=false;
 async function poll(){
  const id=getProfile()?.id;
  if(id!==owner){owner=id;seen=new Set();queued=new Map();initialized=false;send('friend-notifications',{self:id||'',rows:[]});}
  if(!id||busy)return;busy=true;
  try{
   const rows=await rpc('neon_friend_requests');if(getProfile()?.id!==id)return;
   const valid=(Array.isArray(rows)?rows:[]).filter(row=>typeof row.id==='string'&&typeof row.sender_id==='string'&&row.sender_id!==id&&typeof row.username==='string');
   if(!initialized){seen=new Set(valid.map(row=>row.id));initialized=true;return;}
   const pending=new Set(valid.map(row=>row.id));for(const key of queued.keys())if(!pending.has(key))queued.delete(key);
   for(const row of valid)if(!seen.has(row.id)){seen.add(row.id);queued.set(row.id,{row,expires:now()+15000});}
   if(seen.size>1000)seen=new Set([...seen].slice(-500));
  }catch{/* A failed refresh must not baseline or consume new requests. */}
  finally{
   if(getProfile()?.id===id){for(const [key,item] of queued)if(item.expires<=now())queued.delete(key);if(queued.size)send('friend-notifications',{self:id,rows:[...queued.values()].map(item=>item.row)});}
   busy=false;
  }
 }
 repeat(poll,5000);events.addEventListener('online',poll);events.addEventListener('focus',poll);poll();return poll;
}
