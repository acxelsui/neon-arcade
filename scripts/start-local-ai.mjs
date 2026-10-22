import {spawn} from 'node:child_process';
import {access,mkdir,open} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const data=path.join(homedir(),'.local','share','neon-ai');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function available(url){try{return (await fetch(url,{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}}
async function background(file,args,name,env=process.env){
 await mkdir(data,{recursive:true});const log=await open(path.join(data,name+'.log'),'a');
 const child=spawn(file,args,{cwd:root,env,detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await log.close();
}
if(!await available('http://127.0.0.1:11434/api/version')){
 const candidates=[path.join(data,'ollama','ollama.exe'),...(process.env.LOCALAPPDATA?[path.join(process.env.LOCALAPPDATA,'Programs','Ollama','ollama.exe')]:[])];
 let executable;
 for(const candidate of candidates){try{await access(candidate);executable=candidate;break;}catch{}}
 if(!executable)throw Error('Install Ollama from https://ollama.com/download/windows, then start Neon AI again.');
 await background(executable,['serve'],'model',{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:path.join(data,'models'),OLLAMA_NO_CLOUD:'1'});
 let ready=false;for(let i=0;i<30;i++){if(await available('http://127.0.0.1:11434/api/version')){ready=true;break;}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error('The model could not start. See '+path.join(data,'model.log'));
}
const tags=await (await fetch('http://127.0.0.1:11434/api/tags')).json();
if(!tags.models?.some(m=>m.name==='qwen3:1.7b')){
 console.log('Downloading the local model. This is only needed once.');
 const result=await fetch('http://127.0.0.1:11434/api/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3:1.7b',stream:false})});
 const info=await result.json();if(!result.ok||info.error)throw Error('The model download failed. Please start Neon AI again.');
}
let companion=false;try{const r=await fetch('http://127.0.0.1:11435/api/chat',{signal:AbortSignal.timeout(1000)});companion=r.status===403;}catch{}
if(!companion)await background(process.execPath,['scripts/local-ai.mjs'],'companion');
console.log('Neon AI is running on this computer. Open Neon AI through your signed-in owner account and choose Connect local AI.');
