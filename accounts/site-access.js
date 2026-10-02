// A database-owned site ban removes the active arcade, including live games.
export function createSiteAccessMonitor({rpc,getProfile,onBanned,getDeviceKey}){
 let busy=false;
 return async()=>{
  const id=getProfile()?.id;if(!id||busy)return null;busy=true;
  try{const rows=await rpc(getDeviceKey?'neon_browser_access_status':'neon_site_status',getDeviceKey?{device_key:getDeviceKey()}:undefined);const status=rows?.[0];if(getProfile()?.id!==id)return null;if(status?.banned)onBanned(status);return status||null;}
  catch(error){if(!['PGRST202','42883'].includes(error.code))throw error;return null;}
  finally{busy=false;}
 };
}
