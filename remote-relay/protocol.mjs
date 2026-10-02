export const MAX_FRAME=2*1024*1024,MAX_BUFFER=8*1024*1024;
export const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const secret=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function origin(value,{local=false}={}){
 const url=new URL(value);
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.protocol==='https:'||(local&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw Error('Use a fixed HTTPS origin.');
 return url.origin;
}
export function safePath(value){
 if(typeof value!=='string'||value.length>4096||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20\x7f]/.test(value))throw Error('Invalid desktop path');
 const parsed=new URL(value,'http://127.0.0.1:8080');
 if(parsed.origin!=='http://127.0.0.1:8080'||parsed.pathname.startsWith('/neon/'))throw Error('Invalid desktop path');
 return parsed.pathname+parsed.search;
}
const requestHeaders=new Set(['content-type','accept','accept-language','range','if-none-match','if-modified-since']);
const responseHeaders=new Set(['content-type','content-length','content-range','accept-ranges','etag','last-modified']);
export function filterHeaders(headers,response=false){
 const result={};for(const [name,value] of Object.entries(headers||{}))if((response?responseHeaders:requestHeaders).has(name.toLowerCase())&&typeof value==='string'&&value.length<4096&&!/[\r\n]/.test(value))result[name.toLowerCase()]=value;return result;
}
export function pack(id,data,binary=true){
 if(!Number.isInteger(id)||id<1||id>0xffffffff||data.length>MAX_FRAME)throw Error('Invalid channel');
 const prefix=Buffer.alloc(5);prefix.writeUInt32BE(id);prefix[4]=binary?1:0;return Buffer.concat([prefix,Buffer.from(data)]);
}
export function unpack(data){if(data.length<5||data.length>MAX_FRAME+5)throw Error('Invalid frame');return {id:data.readUInt32BE(0),binary:data[4]===1,data:data.subarray(5)};}
export function send(socket,data,options){
 if(socket.readyState!==1||socket.bufferedAmount>MAX_BUFFER)throw Error('Connection overloaded');socket.send(data,options);
}
export function control(socket,message){send(socket,JSON.stringify(message));}
export async function body(req,max=1024*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('Request too large');chunks.push(chunk);}return Buffer.concat(chunks);}
export async function jsonBody(req){const value=JSON.parse((await body(req,8192)).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid request');return value;}
