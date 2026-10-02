// A database-owned site ban removes the active arcade, including live games.
export function createSiteAccessMonitor({rpc,getProfile,onBanned}){
 let busy=false;
 return async()=>{
  const id=getProfile()?.id;if(!id||busy)return null;busy=true;
  try{const rows=await rpc('neon_site_status');const status=rows?.[0];if(getProfile()?.id!==id)return null;if(status?.banned)onBanned(status);return status||null;}
  catch(error){if(!['PGRST202','42883'].includes(error.code))throw error;return null;}
  finally{busy=false;}
 };
}
