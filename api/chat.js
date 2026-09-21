import { timingSafeEqual } from 'node:crypto';

export function createChatHandler({env=process.env,request=fetch}={}) {
  const attempts=new Map();
  return async function chat(req,res) {
    res.setHeader('Cache-Control','no-store');
    const reply=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body))};
    const configured=Boolean(env.AI_API_KEY&&env.AI_BASE_URL&&env.AI_MODEL&&env.AI_ACCESS_CODE);
    if(req.method==='GET')return reply(200,{configured});
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return reply(405,{error:'Use POST to send a message.'})}
    if(!configured)return reply(503,{error:'AI Chat is not connected yet. The site owner needs to finish setting up the AI provider.'});
    // A shared access code keeps a public arcade from exposing an unrestricted paid API.
    const supplied=Buffer.from(String(req.headers['x-chat-access']||''));
    const expected=Buffer.from(env.AI_ACCESS_CODE);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return reply(401,{error:'Enter the chat access code from the site owner.'});
    const now=Date.now();
    for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
    const address=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
    const bucket=attempts.get(address)||{count:0,until:now+60000};
    if(bucket.count>=12)return reply(429,{error:'Please wait a minute before sending another message.'});
    bucket.count++;attempts.set(address,bucket);
    let body=req.body;
    try{
      if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>64000)return reply(413,{error:'This conversation is too long. Start a new chat.'})}body=JSON.parse(raw)}
      if(typeof body==='string')body=JSON.parse(body);
    }catch{return reply(400,{error:'The message could not be read.'})}
    const messages=body?.messages;
    if(!Array.isArray(messages)||!messages.length||messages.length>30||messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>(m.role==='user'?8000:24000))||messages.at(-1).role!=='user'||messages.reduce((n,m)=>n+m.content.length,0)>40000)return reply(400,{error:'Send a message under 8,000 characters, or start a new chat.'});
    let endpoint;
    try{endpoint=new URL(env.AI_BASE_URL.replace(/\/$/,'')+'/chat/completions');if(endpoint.protocol!=='https:')throw Error()}catch{return reply(503,{error:'The AI provider address needs to be corrected by the site owner.'})}
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    const disconnected=()=>{if(!res.writableEnded)controller.abort()};
    res.on('close',disconnected);
    try{
      const upstream=await request(endpoint,{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.AI_MODEL,messages:[{role:'system',content:'You are Neon, the helpful assistant in Neon Arcade. Be friendly, accurate and clear. Use concise answers unless more detail is requested. Admit uncertainty. You cannot browse the web or access the user’s files. Never claim actions you did not perform.'},...messages],max_tokens:4096,stream:false})});
      if(!upstream.ok)return reply(upstream.status===429?429:502,{error:upstream.status===429?'The AI provider is busy or has reached its usage limit. Try again later.':'The AI provider could not answer. The site owner may need to check its settings or balance.'});
      const result=await upstream.json();const content=result.choices?.[0]?.message?.content;
      if(typeof content!=='string'||!content.trim())return reply(502,{error:'The AI returned an empty reply. Please retry.'});
      return reply(200,{content:content.slice(0,24000)});
    }catch{return reply(502,{error:controller.signal.aborted?'The reply took too long. Please retry.':'Could not reach the AI provider. Please retry.'})}
    finally{clearTimeout(timer);res.off('close',disconnected)}
  };
}
export default createChatHandler();

