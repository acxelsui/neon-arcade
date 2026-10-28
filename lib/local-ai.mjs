import {readJSON,respond,RemoteError} from '../accounts/lib/remote-proxy.js';
import {memberAIIdentity} from './member-ai-identity.mjs';

export const aiOrigins=new Set(['https://neon-arcade-improvedv3.vercel.app','http://localhost:3002']);
const styles={balanced:'Be clear and practical.',quick:'Answer briefly and directly.',detailed:'Explain with useful detail and examples.',coach:'Teach step by step and explain why.'};
export function validateChat(body){
 const messages=body?.messages;
 if(!Array.isArray(messages)||!messages.length||messages.length>60||messages.at(-1)?.role!=='user'||messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>(m.role==='user'?8000:24000))||messages.reduce((n,m)=>n+m.content.length,0)>40000)throw new RemoteError('Send a message under 8,000 characters, or start a new chat.');
 if(messages.some(m=>m.images?.length))throw new RemoteError('This local model supports text. Remove screenshots before sending.');
 if(!Object.hasOwn(styles,body.style??'balanced')||typeof(body.instructions??'')!=='string'||(body.instructions??'').length>1000||!['auto','qwen3:1.7b'].includes(body.model??'auto'))throw new RemoteError('Choose a valid model and answer style.');
 const recent=[];let chars=0;
 for(const m of [...messages].reverse()){if(recent.length&&chars+m.content.length>12000)break;recent.unshift({role:m.role,content:m.content});chars+=m.content.length;}
 return {recent,contextTrimmed:recent.length!==messages.length,style:body.style??'balanced',instructions:body.instructions??''};
}
export function createLocalAI({verify=memberAIIdentity,request=fetch}={}){
 let running=false;
 return async(req,res)=>{
  const origin=req.headers.origin;
  if(!aiOrigins.has(origin))return respond(res,403,{error:'Open Neon AI through your signed-in account.'});
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){
   res.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Access-Control-Allow-Private-Network':'true'});return res.end();
  }
  let controller,closed,timer,ownsSlot=false;
  try{
   if(req.url!=='/api/chat'||req.method!=='POST')throw new RemoteError('Use Neon AI.',405);
   if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new RemoteError('JSON is required.',415);
   const body=await readJSON(req,150000);
   if(!body||!['status','chat'].includes(body.action))throw new RemoteError('Choose a valid chat action.');
   const token=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(req.headers.authorization||'')?.[1];
   const self=await verify(token);
   const context=body.action==='chat'?validateChat(body):null;
   controller=new AbortController();timer=setTimeout(()=>controller.abort(),180000);
   closed=()=>{if(!res.writableEnded)controller.abort();};res.on('close',closed);
   if(!context){
    let models;try{const upstream=await request('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)]),redirect:'error'});if(!upstream.ok)throw Error();models=(await upstream.json()).models;}catch{throw new RemoteError('Start the Neon AI companion on this computer, then try again.',503);}
    const configured=Array.isArray(models)&&models.some(m=>m.name==='qwen3:1.7b');
    return respond(res,200,{self,allowed:true,configured,models:[{id:'qwen3:1.7b',label:'Neon Local · Qwen 3'}],contextChars:12000,visionModel:null,...(!configured?{error:'The local model is still downloading. Try again when setup finishes.'}:{})});
   }
   if(running)throw new RemoteError('Neon is finishing another reply. Try again shortly.',409);
   running=true;ownsSlot=true;
   let upstream;try{upstream=await request('http://127.0.0.1:11434/api/chat',{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3:1.7b',think:false,stream:false,keep_alive:'5m',options:{num_ctx:4096,num_predict:context.style==='quick'?256:1024},messages:[{role:'system',content:'You are Neon, a helpful assistant in Neon Arcade. Be friendly, accurate and honest. You cannot browse, see the screen, edit files or take actions. Never claim to be ChatGPT or to have performed actions. Admit uncertainty. '+styles[context.style]},...(context.instructions?[{role:'user',content:'My preferences: '+context.instructions}]:[]),...context.recent]})});}catch{throw new RemoteError(controller.signal.aborted?'Reply stopped or took too long. Try a shorter question.':'The local model is offline. Start Neon AI on this computer.',503);}
   if(!upstream.ok)throw new RemoteError('The local model could not answer. Check that its download is complete.',503);
   const content=(await upstream.json()).message?.content;
   if(typeof content!=='string'||!content.trim())throw new RemoteError('The model returned an empty reply. Try again.',502);
   respond(res,200,{self,allowed:true,content:content.slice(0,24000),model:'qwen3:1.7b',contextTrimmed:context.contextTrimmed});
  }catch(error){if(!res.destroyed)respond(res,error.status||503,{error:error.status?error.message:'Neon AI could not connect. Try again.'});}
  finally{if(ownsSlot)running=false;clearTimeout(timer);if(closed)res.off('close',closed);}
 };
}
