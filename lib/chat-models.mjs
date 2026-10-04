const groqModels=[{id:'openai/gpt-oss-120b',label:'GPT-OSS 120B · Reasoning'},{id:'openai/gpt-oss-20b',label:'GPT-OSS 20B · Fast'}];
export function chatModels(env){
 let groq=false;try{groq=new URL(env.AI_BASE_URL).hostname==='api.groq.com'}catch{}
 const ids=[env.AI_MODEL,...String(env.AI_MODELS||'').split(',')].map(id=>id?.trim()).filter(id=>id&&id.length<=160&&/^[\w./:-]+$/.test(id));
 const models=[...new Set(ids)].slice(0,8).map(id=>({id,label:groqModels.find(m=>m.id===id)?.label||id}));
 if(groq)for(const model of groqModels)if(!models.some(m=>m.id===model.id))models.push(model);
 const vision=env.AI_VISION_MODEL||(groq?'qwen/qwen3.8-27b':env.AI_MODEL);
 const automatic=groq?'openai/gpt-oss-120b':env.AI_MODEL;
 return {models,automatic,vision,contextChars:groq?12000:32000};
}
export function modelCandidates(config,selection,images){
 if(images)return [config.vision];
 if(selection!=='auto')return [selection];
 return [...new Set([config.automatic,...config.models.map(m=>m.id)])].slice(0,3);
}
export function retrySeconds(value,now=Date.now()){
 if(!value)return 60;
 const seconds=Number(value),duration=Number.isFinite(seconds)?seconds:(Date.parse(value)-now)/1000;
 return Number.isFinite(duration)?Math.min(86400,Math.max(1,Math.ceil(duration))):60;
}
// Keep complete recent turns. Saved history stays untouched; only request context is trimmed.
export function fitChatContext(messages,maxChars){
 const recent=messages.slice();
 while(recent.length>1&&recent.reduce((n,m)=>n+m.content.length,0)>maxChars){recent.shift();while(recent[0]?.role==='assistant')recent.shift()}
 return recent;
}
