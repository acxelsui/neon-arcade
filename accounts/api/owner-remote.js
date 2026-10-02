// Only relay the account token to this PC's role-checking gateway. Never proxy desktop traffic.
const remoteOrigin='https://1sg997aseb9mj.tail8b44df.ts.net';
const account='https://neon-arcade-improvedv3.vercel.app';
const accounts=new Set([account,'http://localhost:3002']);
export function createTicketBridge({fetcher=fetch}={}){
 return async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  if(req.method!=='POST'){reply(405,{error:'Use the Neon Arcade connection button.'});return;}
  if(!accounts.has(req.headers.origin)){reply(403,{error:'Open through your signed-in Neon Arcade account.'});return;}
  const match=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(req.headers.authorization||'');
  if(!match){reply(401,{error:'Sign in again before connecting.'});return;}
  try{
   const response=await fetcher(remoteOrigin+'/api/owner-session',{method:'POST',redirect:'error',headers:{Origin:account,Authorization:'Bearer '+match[1]},signal:AbortSignal.timeout(12000)});
   if(!response.ok){reply(response.status===403?403:503,{error:response.status===403?'An active owner role is required.':'Your PC could not open a connection. Keep it awake and its remote services running, then retry.'});return;}
   const data=await response.json();
   if(typeof data.ticket!=='string'||!/^[\w-]{43}$/.test(data.ticket))throw Error('Invalid ticket');
   reply(200,{ticket:data.ticket});
  }catch{reply(503,{error:'Cannot reach your PC. Keep it awake with its remote services running, then retry.'});}
 };
}
export default createTicketBridge();
