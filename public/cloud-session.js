// Provider session lifecycle, following the public Stratus launcher protocol.
// Never reuse another provider's session IDs or send Neon account credentials.
export function portableCloudFetch(send,storage){
 const fields=[['X-Achroma-Session','achroma-portable-session'],['X-Achroma-Uid','achroma-portable-uid']];
 return async(url,options={})=>{
  const headers=new Headers(options.headers);headers.set('X-Achroma-Portable','1');
  for(const [header,key] of fields)try{const value=storage?.getItem(key);if(value)headers.set(header,value);}catch{}
  const response=await send(url,{...options,headers});
  for(const [header,key] of fields)try{const value=response.headers.get(header);if(value!==null){if(value)storage?.setItem(key,value);else storage?.removeItem(key);}}catch{}
  return response;
 };
}
export async function* cloudEvents(response){
 if(!response.body)throw Error('The cloud server returned an empty response.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(true){const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
  let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(line)yield JSON.parse(line);}
  if(done)break;
 }if(buffer.trim())yield JSON.parse(buffer);}finally{reader.releaseLock();}
}
export function createCloudSession({fetch:send=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onStatus=()=>{},onStream=()=>{},onEnd=()=>{},setInterval:repeat=setInterval,clearInterval:cancel=clearInterval}={}){
 let uuid=null,ended=false,quitSent=false,pinging=false,timer;
 const route='/cloud/v1/',queue=position=>onStatus(typeof position==='number'?'In queue · position '+position:'In queue…');
 async function call(method,data){const response=await send(route+method,{method:'POST',keepalive:method==='quitSession',headers:{'Content-Type':'application/json','X-Achroma-Portable':'1'},body:JSON.stringify(data)});const value=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(value.error||'Cloud server returned '+response.status+'.'),{status:response.status});return value;}
 async function quit(){if(uuid&&!quitSent){quitSent=true;try{await call('quitSession',{uuid});}catch{}}}
 async function stop(){ended=true;cancel(timer);onEnd();await quit();}
 async function ping(){if(ended||pinging)return;pinging=true;try{const data=await call('pingSession',{uuid});if(!ended&&Number.isFinite(data.session_time_limit_seconds)&&data.session_time_used_seconds>=data.session_time_limit_seconds){await stop();onStatus('Cloud session time limit reached. Use Reload to start again.');}}catch(error){if(!ended&&[403,404].includes(error.status)){await stop();onStatus('Cloud session ended. Use Reload to reconnect.');}}finally{pinging=false;}}
 async function start(key){
  if(!/^[a-z]{2}\d{4}$/.test(key))throw Error('This cloud game is unavailable.');
  if(uuid||ended)throw Error('Start a new launcher to reconnect.');
  onStatus('Connecting to the cloud server…');
  try{
   let ready=false;
   for(let attempt=0;!uuid&&attempt<3;attempt++){
    const response=await send(route+'createSession',{method:'POST',headers:{'Content-Type':'application/json','X-Achroma-Portable':'1'},body:JSON.stringify({game_key:key})});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Could not create a cloud session ('+response.status+').');}
    for await(const event of cloudEvents(response)){
     if(event.uuid)uuid=event.uuid;
     if(ended){await quit();continue;}
     if(event.status==='error')throw Error(event.error||'The cloud server could not start this game.');
     if(event.status==='finished_queue')ready=true;
     else if(event.status==='queue')queue(event.queue_pos);
     else if(['creating_account','account_ready','requesting_game'].includes(event.status))onStatus('Preparing the cloud game…');
    }
    if(ended){await quit();return;}
    if(!uuid&&attempt<2){onStatus('Waiting for an available cloud session…');await wait(5000);}
   }
   if(!uuid)throw Error('No cloud sessions are available. Use Reload to try again.');
   while(!ready){await wait(4000);if(ended)return;
    const response=await send(route+'getQueue?uuid='+encodeURIComponent(uuid),{headers:{'X-Achroma-Portable':'1'}});
    if(ended)return;if(response.status===429)continue;
    const data=await response.json().catch(()=>({}));if(!response.ok||data.status==='error')throw Error(data.error||'Could not check the cloud queue.');
    if(data.status==='finished_queue')ready=true;else queue(data.queue_pos);
   }
   onStatus('Starting your game…');await call('startGame',{uuid});if(ended)return;
   timer=repeat(ping,15000);onStatus('Connecting to the stream…');onStream(route+'embed?id='+encodeURIComponent(uuid));
  }catch(error){if(ended)return;await stop();onStatus(error.message||'Could not connect. Use Reload to retry.');}
 }
 return {start,stop,ping};
}
