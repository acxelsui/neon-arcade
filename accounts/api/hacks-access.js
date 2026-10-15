import {hackIdentity,hackLaunchers,HacksError} from '../lib/hacks-access.js';
import {readJSON,respond} from '../lib/remote-proxy.js';
export function createHacksAPI({verify=hackIdentity}={}){
 return async(req,res)=>{try{
  if(req.method!=='POST')throw new HacksError('Use the Hacks app.',405);
  if(!['https://neon-arcade-improvedv3.vercel.app','http://localhost:3002'].includes(req.headers.origin))throw new HacksError('Open through your Neon account.',403);
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HacksError('JSON is required.',415);
  let body;try{body=await readJSON(req,256);}catch(error){throw new HacksError(error.message,error.status||400);}
  if(!body||Array.isArray(body)||Object.keys(body).some(key=>key!=='id')||(body.id!==undefined&&!Object.hasOwn(hackLaunchers,body.id)))throw new HacksError('Choose Blooket or Kahoot.',400);
  const token=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(req.headers.authorization||'')?.[1];
  const self=await verify(token);
  respond(res,200,body.id?{self,allowed:true,entry:{...hackLaunchers[body.id]}}:{self,allowed:true,entries:Object.values(hackLaunchers).map(({url,...entry})=>entry)});
 }catch(error){respond(res,error.status||503,{error:error.status?error.message:'Hacks could not connect. Please retry.'});}};
}
export default createHacksAPI();
