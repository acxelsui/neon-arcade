import {updates} from './updates.js';
const prefix='[NEON UPDATE]\n';
export function isOwnerUpdate(row){return row?.announcement===true&&row.role==='owner'&&typeof row.body==='string'&&row.body.startsWith(prefix);}
export function updateMessages(history=[]){
 const releases=updates.map((entry,index)=>({id:'release-'+entry.date+'-'+index,sender_id:'neon-system-bot',username:'Neon Arcade Bot',role:'bot',system:true,body:entry.title+'\n\n'+entry.text,created_at:entry.date+'T12:00:00Z',announcement:true}));
 const owners=history.filter(isOwnerUpdate).map(row=>({...row,body:row.body.slice(prefix.length)}));
 return [...owners,...releases].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
}
