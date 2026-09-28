import {chatText} from './chat-rules.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function chatRequest(data){
 const peer=data.peer??null;
 if(peer!==null&&(typeof peer!=='string'||!uuid.test(peer)))throw new Error('Choose a valid player.');
 switch(data.action){
 case 'self':return ['neon_chat_self',{}];
 case 'manage-players':return ['neon_chat_manage_players',{query:String(data.query||'').slice(0,24)}];
 case 'announce':return ['neon_chat_announce',{message:chatText(data.text)}];
 case 'moderate':
  if(typeof data.target!=='string'||!uuid.test(data.target)||!['role','mute','unmute','ban','unban'].includes(data.operation))throw new Error('Invalid moderation action.');
  return ['neon_chat_moderate',{target_id:data.target,operation:data.operation,value:String(data.value||'').slice(0,12)}];
 case 'history':return ['neon_chat_history',{peer}];
 case 'send':return ['neon_chat_send',{message:chatText(data.text),peer}];
 case 'players':return ['neon_chat_players',{query:String(data.query||'').slice(0,24)}];
 case 'conversations':return ['neon_chat_conversations',{}];
 case 'delete':if(typeof data.messageId!=='string'||!/^\d{1,20}$/.test(data.messageId))throw new Error('Invalid message.');return ['neon_chat_delete',{message_id:data.messageId}];
 default:throw new Error('Unknown chat action.');
 }
}
export function initChatBridge({rpc,send,getProfile}){
 let pending=0;
 return async data=>{
  if(!getProfile()||typeof data.requestId!=='string'||data.requestId.length>80)return;
  if(pending>=5){send('chat-result',{requestId:data.requestId,error:'Please wait for chat to catch up.'});return}
  pending++;const owner=getProfile().id;
  try{const [name,args]=chatRequest(data);const result=await rpc(name,args);if(getProfile()?.id===owner)send('chat-result',{requestId:data.requestId,result,self:owner})}
  catch(error){if(getProfile()?.id===owner)send('chat-result',{requestId:data.requestId,error:['PGRST202','42883'].includes(error.code)?'Chat needs its database setup. Ask the site owner to run chat.sql.':error.message||'Chat could not connect. Try again.'})}
  finally{pending--}
 };
}
