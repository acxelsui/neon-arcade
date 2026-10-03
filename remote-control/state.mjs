// Only pairing metadata, command number reservations and audit events are durable.
// Screen frames, input contents, sessions and raw host credentials never go here.
export function storedState(value){
 if(!value||!Array.isArray(value.devices)||!Array.isArray(value.logs)||value.devices.length>500||value.logs.length>2000)throw Error('Remote storage returned invalid data.');
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,deviceID=/^dev_[a-f0-9]{32}$/;
 const devices=value.devices.map(d=>{
  if(!d||!deviceID.test(d.id)||!uuid.test(d.owner)||!/^[a-f0-9]{64}$/.test(d.credentialHash)||typeof d.name!=='string'||d.name.length>60||!Number.isSafeInteger(d.created)||!Number.isSafeInteger(d.nextCommand)||d.nextCommand<0)throw Error('Remote storage returned an invalid computer.');
  const grants=d.grants??[];
  if(!Array.isArray(grants)||grants.length>10||grants.some(g=>!g||!uuid.test(g.id)||g.id===d.owner||typeof g.name!=='string'||!/^[a-zA-Z0-9_]{3,24}$/.test(g.name))||new Set(grants.map(g=>g.id)).size!==grants.length)throw Error('Remote storage returned invalid owner permissions.');
  return {id:d.id,owner:d.owner,name:d.name,credentialHash:d.credentialHash,created:d.created,nextCommand:d.nextCommand,...(grants.length?{grants:grants.map(({id,name})=>({id,name}))}:{})};
 });
 if(new Set(devices.map(d=>d.id)).size!==devices.length)throw Error('Remote storage returned duplicate computers.');
 const logs=value.logs.map(row=>{
  if(!row||!uuid.test(row.owner)||!deviceID.test(row.device)||!/^[-a-z]{1,64}$/.test(row.action)||!(row.session===null||/^ses_[a-f0-9]{32}$/.test(row.session))||typeof row.at!=='string'||row.at.length>32||!Number.isFinite(Date.parse(row.at)))throw Error('Remote storage returned an invalid event.');
  return {owner:row.owner,device:row.device,action:row.action,session:row.session,at:row.at};
 });
 return {devices,logs};
}
