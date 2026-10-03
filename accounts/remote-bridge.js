import {remoteRequest} from './remote-rules.js';

function publicOrigin(value){
 try{const url=new URL(value);if(!['http:','https:','ws:','wss:'].includes(url.protocol)||url.username||url.password)return 'unavailable';return url.origin;}catch{return value==='about:blank'?'about:blank':'unavailable';}
}
function connectionRule(policy){
 const match=String(policy||'').match(/(?:^|;)\s*(connect-src)\s+([^;]+)/)||String(policy||'').match(/(?:^|;)\s*(default-src)\s+([^;]+)/);
 if(!match)return 'unavailable';
 const sources=match[2].trim().split(/\s+/).slice(0,12).map(source=>{
  if(["'self'","'none'",'*','https:','http:','wss:','ws:'].includes(source))return source;
  const origin=publicOrigin(source);return origin==='unavailable'?'[other source]':origin;
 });
 return (match[1]+' '+sources.join(' ')).slice(0,600);
}

export async function checkRemoteConnection({getSession,fetcher=fetch,isCurrent=()=>true,sessionTimeout=4000,policyTarget=globalThis.document,pageLocation=globalThis.location}){
 const checks=[],details=[],policies=[];let phase='Sign-in session',timer,sessionTimedOut=false,listening=false;
 const pageOrigin=publicOrigin(pageLocation?.href),endpoint=new URL('/api/remote-access',pageOrigin==='unavailable'||pageOrigin==='about:blank'?'https://neon-arcade-improvedv3.vercel.app':pageOrigin);
 function onPolicy(event){
  if(event.disposition!=='enforce'||event.effectiveDirective!=='connect-src'||policies.length>=3)return;
  try{const blocked=new URL(event.blockedURI);if(blocked.origin!==endpoint.origin||!['/','/api/remote-access'].includes(blocked.pathname))return;}catch{return;}
  const rule=connectionRule(event.originalPolicy),documentOrigin=publicOrigin(event.documentURI);
  if(!policies.some(item=>item.rule===rule&&item.documentOrigin===documentOrigin))policies.push({rule,documentOrigin});
 }
 try{
  const session=await Promise.race([getSession(),new Promise((_,reject)=>{timer=setTimeout(()=>{sessionTimedOut=true;reject(Error('Sign-in timeout'));},sessionTimeout);})]);
  clearTimeout(timer);if(!isCurrent())return null;
  const token=session.data?.session?.access_token;
  if(!token||session.error)throw Error('Refresh Neon Arcade and sign in again.');
  checks.push({label:phase,ok:true});phase='Browser request to Neon';
  let response;const started=Date.now();
  if(policyTarget?.addEventListener&&policyTarget?.removeEventListener){policyTarget.addEventListener('securitypolicyviolation',onPolicy);listening=true;}
  try{response=await fetcher('/api/remote-access',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"action":"list"}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}
  catch(error){
   // CSP events are queued separately from the rejected fetch promise.
   await new Promise(resolve=>setTimeout(resolve,30));
   const kind=['TypeError','TimeoutError','AbortError','NotAllowedError','SecurityError'].includes(error?.name)?error.name:'RequestError';
   details.push('Check version: remote-details-v1','Page origin: '+pageOrigin,'Request: '+endpoint.origin+endpoint.pathname,'Browser result: '+kind+' after '+(Date.now()-started)+' ms');
   for(const policy of policies)details.push('Blocking rule: '+policy.rule,'Policy document: '+policy.documentOrigin);
   if(!policies.length)details.push('No matching page security violation was reported.');
   throw Error(policies.length?'The browser blocked remote access with a page security rule. See the connection details below.':'The browser request failed. See the connection details below.');
  }
  if(!isCurrent())return null;checks.push({label:phase,ok:true});phase='Owner check and relay';
  let result;try{result=await response.json();}catch{throw Error('Neon returned an unexpected response. Refresh the website and try again.');}
  if(!response.ok)throw Error(typeof result.error==='string'?result.error.slice(0,300):'Neon could not verify owner access or connect to the relay.');
  if(result.configured!==true)throw Error('The remote relay is not configured on this website.');
  checks.push({label:phase,ok:true});return {ok:true,checks};
 }catch(error){
  if(!isCurrent())return null;
  const message=phase==='Sign-in session'?(sessionTimedOut?'Your sign-in session did not respond. Refresh Neon Arcade and sign in again.':'Your sign-in session could not refresh. Reload Neon Arcade and sign in again.'):error.message||'The connection check could not complete.';
  checks.push({label:phase,ok:false,message});return {ok:false,checks,...(details.length?{details}:{})};
 }finally{clearTimeout(timer);if(listening)policyTarget.removeEventListener('securitypolicyviolation',onPolicy);}
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
