const project='https://xfwjzxjeessduxuuqeop.supabase.co';
const key='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
export function createDatabase({fetcher=fetch}={}){
 async function rpc(name,args,token){
  const response=await fetcher(project+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});
  if(!response.ok){const error=Error(response.status===401||response.status===403?'Owner access and an authenticator code are required.':'Remote access could not be verified. Check its database setup.');error.status=response.status===401||response.status===403?403:503;throw error;}return response.json();
 }
 return {
  owner:(token,args)=>rpc('neon_remote_owner',args,token),
  device:(id,secret,state='check')=>rpc('neon_remote_device',{device_id:id,secret,state}),
  session:(secret,operation='check',detail='')=>rpc('neon_remote_session',{secret,operation,detail})
 };
}
