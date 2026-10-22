// Authentication stays in the account page. The arcade receives replies only.
export function createAIBridge({getProfile,getSession,rpc,send,fetcher=fetch}){
 const pending=new Map();
 return async data=>{
  const self=getProfile()?.id;
  if(!self||typeof data.requestId!=='string'||data.requestId.length>80)return;
  if(data.action==='cancel'){const item=pending.get(data.target);if(item?.self===self)item.controller.abort();return;}
  const reply=value=>{if(getProfile()?.id===self)send('ai-result',{requestId:data.requestId,self,...value});};
  if(pending.size>=2){reply({error:'Please wait for the current reply.'});return;}
  const controller=new AbortController();pending.set(data.requestId,{self,controller});
  try{
   if(!['access','status','chat'].includes(data.action))throw Error('Unknown AI action.');
   // This RPC rejects non-owners, banned accounts and invalid sessions server-side.
   const permission=await rpc('neon_owner_overview',{});
   if(getProfile()?.id!==self)return;
   if(!Number.isInteger(permission?.players))throw Error('Owner access is required.');
   if(data.action==='access'){reply({result:{allowed:true,self}});return;}
   const session=await getSession();if(getProfile()?.id!==self)return;
   const token=session.data?.session?.access_token;if(!token||session.error)throw Error('Sign in again.');
   const payload=data.action==='status'?{action:'status'}:{action:'chat',messages:data.payload?.messages,style:data.payload?.style,model:data.payload?.model,instructions:data.payload?.instructions};
   const response=await fetcher('http://127.0.0.1:11435/api/chat',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(185000)])});
   const result=await response.json();
   if(result.self&&result.self!==self)throw Error('Your account changed. Reopen Neon AI.');
   reply({status:response.status,result});
  }catch(error){reply({error:error.name==='AbortError'?'Reply stopped.':error instanceof TypeError?'Start Neon AI on this computer and allow the browser to connect to it.':error.message||'Owner access is required.'});}
  finally{pending.delete(data.requestId);}
 };
}
