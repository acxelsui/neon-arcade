export class RemoteError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function inputBatch(value){
 if(!Array.isArray(value)||value.length>40)throw new RemoteError('Too many input events.');
 return value.map(event=>{
  if(!event||typeof event!=='object')throw new RemoteError('Invalid input.');
  if(event.type==='release')return {type:'release'};
  if(event.type==='key'&&Number.isInteger(event.key)&&event.key>=8&&event.key<=222&&typeof event.down==='boolean')return {type:'key',key:event.key,down:event.down};
  if(event.type==='text'&&typeof event.text==='string'&&event.text.length<=400)return {type:'text',text:event.text};
  if(['move','button','wheel'].includes(event.type)){
   if(!Number.isFinite(event.x)||!Number.isFinite(event.y)||event.x<0||event.x>1||event.y<0||event.y>1)throw new RemoteError('Pointer is outside the screen.');
   const point={type:event.type,x:event.x,y:event.y};
   if(event.type==='move')return point;
   if(event.type==='button'&&[0,1,2].includes(event.button)&&typeof event.down==='boolean')return {...point,button:event.button,down:event.down};
   if(event.type==='wheel'&&Number.isFinite(event.delta)&&Math.abs(event.delta)<=1200)return {...point,delta:Math.round(event.delta)};
  }
  throw new RemoteError('Unsupported remote input.');
 });
}
export function ownerAction(value){
 if(!value||typeof value!=='object'||!['list','pair','open','poll','input','close','forget','logs'].includes(value.action))throw new RemoteError('Choose a remote action.');
 const result={action:value.action};
 if(value.action==='pair'){
  const code=String(value.code||'').replace(/[\s-]/g,'').toUpperCase();
  if(!/^[A-F0-9]{16}$/.test(code))throw new RemoteError('Enter the pairing code shown by Neon Launcher.');result.code=code;
 }
 if(['open','forget'].includes(value.action)){
  if(typeof value.device!=='string'||!/^dev_[a-f0-9]{32}$/.test(value.device))throw new RemoteError('Choose a computer.');result.device=value.device;
 }
 if(['poll','input','close'].includes(value.action)){
  if(typeof value.session!=='string'||!/^ses_[a-f0-9]{32}$/.test(value.session))throw new RemoteError('Choose a remote session.');result.session=value.session;
 }
 if(value.action==='input')result.events=inputBatch(value.events);
 if(value.action==='open')result.video=value.video===true;
 if(value.action==='poll'){result.sequence=Number.isSafeInteger(value.sequence)&&value.sequence>=0?value.sequence:0;if(/^[a-f0-9]{32}$/.test(value.videoStream||''))result.videoStream=value.videoStream;}
 return result;
}
