import {remoteRequest} from './remote-rules.js';

export async function checkRemoteConnection({getSession,fetcher=fetch,isCurrent=()=>true,sessionTimeout=4000}){
 const checks=[];let phase='Sign-in session',timer,sessionTimedOut=false;
 try{
  const session=await Promise.race([getSession(),new Promise((_,reject)=>{timer=setTimeout(()=>{sessionTimedOut=true;reject(Error('Sign-in timeout'));},sessionTimeout);})]);
  clearTimeout(timer);if(!isCurrent())return null;
  const token=session.data?.session?.access_token;
  if(!token||session.error)throw Error('Refresh Neon Arcade and sign in again.');
  checks.push({label:phase,ok:true});phase='Browser request to Neon';
  let response;
  try{response=await fetcher('/api/remote-access',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"action":"list"}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}
  catch{throw Error('This browser could not send the request to Neon. The connection may be interrupted or blocked.');}
  if(!isCurrent())return null;checks.push({label:phase,ok:true});phase='Owner check and relay';
  let result;try{result=await response.json();}catch{throw Error('Neon returned an unexpected response. Refresh the website and try again.');}
  if(!response.ok)throw Error(typeof result.error==='string'?result.error.slice(0,300):'Neon could not verify owner access or connect to the relay.');
  if(result.configured!==true)throw Error('The remote relay is not configured on this website.');
  checks.push({label:phase,ok:true});return {ok:true,checks};
 }catch(error){
  if(!isCurrent())return null;
  const message=phase==='Sign-in session'?(sessionTimedOut?'Your sign-in session did not respond. Refresh Neon Arcade and sign in again.':'Your sign-in session could not refresh. Reload Neon Arcade and sign in again.'):error.message||'The connection check could not complete.';
  checks.push({label:phase,ok:false,message});return {ok:false,checks};
 }finally{clearTimeout(timer);}
}

export function createRemoteBridge({getProfile,getSession,send,fetcher=fetch}){
 let pending=0;
 return async data=>{
  const owner=getProfile()?.id;if(!owner||typeof data.requestId!=='string'||data.requestId.length>80)return;
  const reply=extra=>{if(getProfile()?.id===owner)send('owner-remote-v2-result',{requestId:data.requestId,self:owner,...extra});};
  if(pending>=4){reply({error:'The remote connection is catching up.'});return;}
  pending++;
  try{
   if(data.action==='connection-check'){
    const result=await checkRemoteConnection({getSession,fetcher,isCurrent:()=>getProfile()?.id===owner});
    if(result)reply({result});return;
   }
   const action=remoteRequest(data),session=await getSession();if(getProfile()?.id!==owner)return;
   const token=session.data?.session?.access_token;if(!token)throw Error('Sign in again to use remote access.');
   const response=await fetcher('/api/remote-access',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(action),cache:'no-store',signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'The remote connection failed.');reply({result});
  }catch(error){reply({error:error.message||'Remote access could not connect.'});}
  finally{pending--;}
 };
}
