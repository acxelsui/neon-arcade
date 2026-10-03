import {remoteRequest} from './remote-rules.js';
export function createRemoteBridge({getProfile,getSession,send,fetcher=fetch}){
 let pending=0;
 return async data=>{
  const owner=getProfile()?.id;if(!owner||typeof data.requestId!=='string'||data.requestId.length>80)return;
  const reply=extra=>{if(getProfile()?.id===owner)send('owner-remote-v2-result',{requestId:data.requestId,self:owner,...extra});};
  if(pending>=4){reply({error:'The remote connection is catching up.'});return;}
  pending++;
  try{
   const action=remoteRequest(data),session=await getSession();if(getProfile()?.id!==owner)return;
   const token=session.data?.session?.access_token;if(!token)throw Error('Sign in again to use remote access.');
   const response=await fetcher('/api/remote-access',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(action),cache:'no-store',signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'The remote connection failed.');reply({result});
  }catch(error){reply({error:error.message||'Remote access could not connect.'});}
  finally{pending--;}
 };
}
