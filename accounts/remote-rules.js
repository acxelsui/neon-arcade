const fail=message=>{throw Error(message);};
export function remoteRequest(value){
 if(!value||!['list','pair','open','poll','input','close','forget','logs','grant','revoke'].includes(value.action))return fail('Choose a remote action.');
 const result={action:value.action};
 if(value.action==='pair'){const code=String(value.code||'').replace(/[\s-]/g,'').toUpperCase();if(!/^[A-F0-9]{16}$/.test(code))return fail('Enter the launcher pairing code.');result.code=code;}
 if(['open','forget','grant','revoke'].includes(value.action)){if(!/^dev_[a-f0-9]{32}$/.test(value.device||''))return fail('Choose a computer.');result.device=value.device;}
 if(['poll','input','close'].includes(value.action)){if(!/^ses_[a-f0-9]{32}$/.test(value.session||''))return fail('Choose a remote session.');result.session=value.session;}
 if(value.action==='grant'){const username=String(value.username||'').trim();if(!/^[a-zA-Z0-9_]{3,24}$/.test(username))throw Error('Enter the other owner account username.');result.username=username;}
 if(value.action==='revoke'){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.target||''))throw Error('Choose an approved owner.');result.target=value.target;}
 if(value.action==='open')result.video=value.video===true;
 if(value.action==='poll'){result.sequence=Number.isSafeInteger(value.sequence)&&value.sequence>=0?value.sequence:0;if(/^[a-f0-9]{32}$/.test(value.videoStream||''))result.videoStream=value.videoStream;}
 if(value.action==='input'){if(!Array.isArray(value.events)||value.events.length>40)return fail('Too many input events.');result.events=value.events;}
 return result;
}
