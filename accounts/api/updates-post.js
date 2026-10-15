import {readJSON,respond} from '../lib/remote-proxy.js';
import {HacksError} from '../lib/hacks-access.js';
const PROJECT='https://xfwjzxjeessduxuuqeop.supabase.co',KEY='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
export function createUpdatesAPI({request=fetch}={}){return async(req,res)=>{try{
 if(req.method!=='POST')throw new HacksError('Use the Updates channel.',405);
 if(!['https://neon-arcade-improvedv3.vercel.app','http://localhost:3002'].includes(req.headers.origin))throw new HacksError('Open through your Neon account.',403);
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HacksError('JSON is required.',415);
 const token=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(req.headers.authorization||'')?.[1];if(!token)throw new HacksError('Sign in again.',401);
 const body=await readJSON(req,6000);if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='text')||typeof body.text!=='string'||!body.text.trim()||body.text.trim().length>950)throw new HacksError('Write an update under 950 characters.',400);
 const headers={apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const identity=await request(PROJECT+'/rest/v1/rpc/neon_chat_self',{method:'POST',headers,body:'{}',redirect:'error',signal:AbortSignal.timeout(8000)});if(!identity.ok)throw new HacksError('Your account could not be verified.',identity.status===401?401:403);
 const rows=await identity.json(),self=Array.isArray(rows)&&rows.length===1?rows[0]:null;if(self?.role!=='owner'||self.banned||self.site_banned||self.chat_banned||Date.parse(self.muted_until)>Date.now())throw new HacksError('Only an active owner can post updates.',403);
 const result=await request(PROJECT+'/rest/v1/rpc/neon_chat_announce',{method:'POST',headers,body:JSON.stringify({message:'[NEON UPDATE]\n'+body.text.trim()}),redirect:'error',signal:AbortSignal.timeout(8000)});if(!result.ok)throw new HacksError('The update could not be posted. Try again.',502);
 respond(res,200,{posted:true,self:self.id});
 }catch(error){respond(res,error.status||503,{error:error.status?error.message:'Updates could not connect. Please retry.'});}};}
export default createUpdatesAPI();
