import {gameStatusRequest} from './game-status-rules.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function ownerRequest(data){
 switch(data.action){
 case 'owner-game-status':case 'owner-game-review':return gameStatusRequest(data);
 case 'owner-overview':return ['neon_owner_overview',{}];
 case 'owner-players':
  if(!['all','banned','muted','staff'].includes(data.filter)||!Number.isInteger(data.offset)||data.offset<0||data.offset>100000)throw Error('Choose a valid player filter.');
  return ['neon_owner_players',{query:String(data.query||'').trim().slice(0,24),category:data.filter,page_offset:data.offset}];
 case 'owner-audit':return ['neon_owner_audit',{}];
 case 'owner-action':{
  if(typeof data.target!=='string'||!uuid.test(data.target)||!['site-ban','site-unban','role','mute','unmute','ban','unban'].includes(data.operation))throw Error('Invalid owner action.');
  const value=String(data.value||''),reason=String(data.reason||'').trim();
  if(reason.length>240)throw Error('Keep the reason under 240 characters.');
  if(data.operation==='site-ban'&&!reason)throw Error('Add a ban reason.');
  if(data.operation==='role'&&!['member','vip','admin','owner'].includes(value))throw Error('Choose a valid role.');
  if(data.operation==='mute'&&!['10','60','1440'].includes(value))throw Error('Choose a valid mute duration.');
  return ['neon_owner_action',{target_id:data.target,operation:data.operation,value:value.slice(0,12),reason}];
 }
 case 'owner-announce':{
  const message=String(data.text||'').trim();if(!message||message.length>1000)throw Error('Use 1–1,000 characters.');
  return ['neon_owner_announce',{message}];
 }
 default:throw Error('Unknown owner action.');
 }
}
