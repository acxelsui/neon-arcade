export const browserModels=[
 {id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',label:'Qwen 2.5 · Light'},
 {id:'Llama-3.2-1B-Instruct-q4f16_1-MLC',label:'Llama 3.2 · Balanced'},
];
export function createBrowserAI({progress=()=>{},load=()=>import('https://esm.run/@mlc-ai/web-llm@0.2.85'),gpu=()=>navigator.gpu,makeWorker=()=>new Worker('/browser-ai-worker.js',{type:'module'})}={}){
 let engine,worker,selected,loading,busy=false,cancelLoad;
 const choose=id=>browserModels.find(model=>model.id===id)||browserModels[0];
 async function connect(id){
  const model=choose(id);
  if(!gpu())throw Error('Browser AI needs WebGPU. Use an updated Chrome or Edge with hardware acceleration, or open one of the free chat links.');
  if(engine&&selected===model.id)return engine;
  if(loading)return loading;
  loading=(async()=>{
   try{if(engine)await engine.unload();worker?.terminate();engine=null;selected=null;
    const {CreateWebWorkerMLCEngine}=await load();worker=makeWorker();
    let timer,errorHandler;
    const failure=new Promise((_,reject)=>{
     cancelLoad=()=>reject(new DOMException('Stopped','AbortError'));
     errorHandler=()=>reject(Error('The browser AI worker could not start.'));
     worker.addEventListener?.('error',errorHandler,{once:true});
     timer=setTimeout(()=>reject(Error('The model download took too long. Retry on a faster connection.')),300000);
    });
    try{engine=await Promise.race([CreateWebWorkerMLCEngine(worker,model.id,{initProgressCallback:info=>progress(info.text||'Loading model...')}),failure]);}
    finally{clearTimeout(timer);worker?.removeEventListener?.('error',errorHandler);cancelLoad=null;}
    selected=model.id;return engine;
   }catch(error){worker?.terminate();worker=null;engine=null;if(error.name==='AbortError')throw error;throw Error('Browser model could not load. Check your connection, free storage and WebGPU support. '+error.message);}
   finally{loading=null;}
  })();return loading;
 }
 return {connect,async request(_url,options={}){
  if(options.method!=='POST')return Response.json({configured:!!engine,models:browserModels,contextChars:10000});
  if(busy)return Response.json({error:'Wait for the current reply.'},{status:409});
  const payload=JSON.parse(options.body),signal=options.signal;
  if(signal?.aborted)throw new DOMException('Stopped','AbortError');
  busy=true;let stopped=false;const abort=()=>{stopped=true;cancelLoad?.();engine?.interruptGenerate();};signal?.addEventListener('abort',abort,{once:true});
  try{
   const instance=await connect(payload.model);if(stopped)throw new DOMException('Stopped','AbortError');
   const styles={quick:'Answer briefly.',detailed:'Explain with examples.',coach:'Teach step by step.',balanced:'Be clear and practical.'};
   const messages=payload.messages.map(({role,content})=>({role,content}));
   const result=await instance.chat.completions.create({messages:[{role:'system',content:'You are Neon, a helpful AI assistant. Be accurate and honest. You cannot browse or take actions. '+(styles[payload.style]||styles.balanced)+(payload.instructions?' User preferences: '+payload.instructions:'')},...messages],max_tokens:payload.style==='quick'?256:768,temperature:.6});
   if(stopped)throw new DOMException('Stopped','AbortError');
   const content=result.choices?.[0]?.message?.content;if(!content?.trim())throw Error('The model returned no reply. Try again.');
   return Response.json({content,model:selected});
  }catch(error){if(stopped||error.name==='AbortError')throw new DOMException('Stopped','AbortError');return Response.json({error:error.message},{status:422});}
  finally{busy=false;signal?.removeEventListener('abort',abort);}
 },stop(){cancelLoad?.();engine?.interruptGenerate();},async unload(){if(busy)throw Error('Stop the current reply first.');await engine?.unload();worker?.terminate();engine=null;worker=null;selected=null;}};
}
