export function retryDelay(response,body,attempt){
 if(response?.status===429){const value=Number(body?.retryAfter||response.headers.get('Retry-After'));return Number.isFinite(value)&&value>0?Math.ceil(value)*1000:60000;}
 return Math.min(8000,1000*2**attempt);
}
export function abortableWait(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted)return reject(new DOMException('Stopped','AbortError'));const abort=()=>{clearTimeout(timer);reject(new DOMException('Stopped','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});}
// Retries are bounded and respect provider cooldowns. A Stop cancels both the
// request and its wait; messages are appended only after a complete reply.
export async function requestChat(payload,{signal,request=fetch,wait=abortableWait,progress=()=>{}}={}){
 for(let attempt=0;attempt<3;attempt++){
  let response,body;
  try{response=await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});try{body=await response.json();}catch{body={};}
   if(response.ok&&typeof body.content==='string'&&body.content.trim())return body;
  }catch(error){if(signal.aborted||error.name==='AbortError')throw error;}
  const retryable=!response||[408,429,500,502,503,504].includes(response.status)||(response.ok&&!body?.content);
  const delay=retryDelay(response,body,attempt);
  if(retryable&&attempt<2&&delay<=120000){progress({attempt:attempt+1,seconds:Math.ceil(delay/1000)});await wait(delay,signal);continue;}
  const error=new Error(body?.error||'The connection is unavailable. Your message is saved; you can retry it.');error.retryAfter=response?.status===429?Math.ceil(delay/1000):0;throw error;
 }
}
