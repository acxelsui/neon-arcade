export function createHacksBridge({getProfile,getSession,send,fetcher=fetch}){
 let pending=0;
 return async data=>{
  const self=getProfile()?.id;if(!self||typeof data.requestId!=='string'||data.requestId.length>80)return;
  const reply=value=>{if(getProfile()?.id===self)send('hacks-result',{requestId:data.requestId,self,...value});};
  if(pending>=2){reply({error:'Please wait for the access check.'});return;}
  pending++;
  try{
   if(data.id!==undefined&&!['blooket','kahoot'].includes(data.id))throw Error('Choose Blooket or Kahoot.');
   const session=await getSession();if(getProfile()?.id!==self)return;
   const token=session.data?.session?.access_token;if(!token||session.error)throw Error('Sign in again.');
   const response=await fetcher('/api/hacks-access',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data.id?{id:data.id}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Admin or owner access is required.');
   if(result.self!==self||result.allowed!==true)throw Error('Your account changed. Reopen Hacks.');reply({result});
  }catch(error){reply({error:error.message||'Hacks could not connect.'});}finally{pending--;}
 };
}
