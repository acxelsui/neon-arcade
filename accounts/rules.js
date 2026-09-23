export function username(value){
 const name=String(value??'').trim();
 if(!/^[a-zA-Z0-9_]{3,24}$/.test(name))throw new Error('Use 3–24 letters, numbers, or underscores for your username.');
 return name;
}
// Supabase Auth requires an email-shaped identifier. Confirmation must be disabled.
// This is never displayed as a real email or used for email delivery/recovery.
export function loginIdentity(value){return username(value).toLowerCase()+'@accounts.neon.invalid'}
export function allowedMessage(event,frame,origin){return event.source===frame&&event.origin===origin&&event.data?.channel==='neon-members-v1'}
export function activity(value){
 if(value===null)return null;
 if(!value||typeof value.id!=='string'||typeof value.name!=='string'||value.id.length<1||value.id.length>120||value.name.length<1||value.name.length>120)return undefined;
 return {id:value.id,name:value.name};
}
export function separateOrigin(content,account){
 const url=new URL(content);
 if(url.origin===account)throw new Error('Accounts must be hosted at a different address from the arcade.');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='localhost'))throw new Error('The arcade address must use HTTPS.');
 return url.origin;
}
