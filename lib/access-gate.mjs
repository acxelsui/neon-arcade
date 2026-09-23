export const ACCOUNT_ORIGIN='https://neon-arcade-improvedv3.vercel.app';
const PROJECT='https://xfwjzxjeessduxuuqeop.supabase.co';
const KEY='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
const COOKIE='neon_arcade_pass';
const valid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless','Cross-Origin-Resource-Policy':'cross-origin','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export function createAccessGate({fetcher=fetch,now=Date.now}={}){
 const cache=new Map();
 async function verify(pass){
  if(!valid(pass))return false;
  if((cache.get(pass)||0)>now())return true;
  const response=await fetcher(PROJECT+'/rest/v1/rpc/neon_check_access',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({pass}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Access service unavailable');
  if(await response.json()!==true){cache.delete(pass);return false}
  if(cache.size>1000)cache.clear();cache.set(pass,now()+15000);return true;
 }
 return async function gate(request){
  const url=new URL(request.url),local=url.hostname==='localhost'||url.hostname==='127.0.0.1';
  const account=local?'http://localhost:3002':ACCOUNT_ORIGIN;
  const pass=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  const text=(body,status=401)=>new Response(body,{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  if(url.pathname==='/neon-access.js')return new Response(bridgeScript(account),{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if(url.pathname==='/neon-access'&&request.method==='GET'&&!url.search){
   return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening Neon Arcade</title><body><p id="status">Checking your Neon account…</p><script src="/neon-access.js"></script></body></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors ${account}; base-uri 'none'`}});
  }
  try{
   if(url.pathname==='/neon-access'&&request.method==='POST'){
    if(request.headers.get('origin')!==url.origin)return text('Invalid origin',403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return text('JSON required',415);
    if(Number(request.headers.get('content-length')||0)>256)return text('Request too large',413);
    const body=await request.text();if(body.length>256)return text('Request too large',413);
    let ticket;try{ticket=JSON.parse(body).pass}catch{return text('Invalid access pass',400)}
    if(!await verify(ticket))return text('Sign in to open Neon Arcade.');
    return new Response('OK',{headers:{...headers,'Set-Cookie':`${COOKIE}=${ticket}; Path=/; HttpOnly; Max-Age=28800; ${local?'SameSite=Lax':'Secure; SameSite=None; Partitioned'}`}});
   }
   if(await verify(pass)){
    if(url.pathname==='/neon-access')return text('OK',200);
    return null;
   }
  }catch{return text('The account check is unavailable. Please retry shortly.',503)}
  if(url.pathname==='/neon-access')return text('Your browser could not keep the arcade access cookie. Allow cookies for this site and retry.');
  if(request.headers.get('sec-fetch-dest')==='iframe')return text('Your arcade session expired. Reload the account page to reconnect.');
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'||request.headers.get('sec-fetch-dest')==='document')){
   return new Response(null,{status:302,headers:{...headers,Location:account+'/'}});
  }
  return text('Sign in to Neon Arcade first.');
 };
}
function bridgeScript(account){return `const account=${JSON.stringify(account)};let accepted=false;const status=document.getElementById('status');window.addEventListener('message',async event=>{if(event.source!==parent||event.origin!==account||event.data?.channel!=='neon-members-v1'||event.data.type!=='access-pass'||accepted)return;accepted=true;try{const response=await fetch('/neon-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:event.data.pass}),credentials:'include'});if(!response.ok)throw new Error(await response.text());const check=await fetch('/neon-access?check=1',{credentials:'include',cache:'no-store'});if(!check.ok)throw new Error(await check.text());location.replace('/#home')}catch(error){status.textContent=error.message;parent.postMessage({channel:'neon-members-v1',type:'access-error'},account)}});parent.postMessage({channel:'neon-members-v1',type:'access-ready'},account);`;}
