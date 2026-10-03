import {RemoteError} from './protocol.mjs';

export async function readJSONStream(stream,limit=800000){
 const chunks=[];let bytes=0;
 if(stream)for await(const chunk of stream){const next=typeof chunk==='string'?new TextEncoder().encode(chunk):chunk;bytes+=next.byteLength;if(bytes>limit)throw new RemoteError('Request is too large.',413);chunks.push(next);}
 const combined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(combined)||'{}');}catch{throw new RemoteError('JSON is required.');}
}

export function jsonResponse(status,data){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}

export async function fetchRelay(relay,request){
 const result=await relay.handle({route:new URL(request.url).pathname,method:request.method,headers:Object.fromEntries(request.headers),ip:request.headers.get('x-neon-client-ip')||request.headers.get('cf-connecting-ip')||'unknown',readBody:()=>readJSONStream(request.body)});
 return jsonResponse(result.status,result.data);
}
