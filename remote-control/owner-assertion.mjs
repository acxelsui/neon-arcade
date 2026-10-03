import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const mac=(key,payload)=>createHmac('sha256',key).update('neon-owner-v1.'+payload).digest();
// Issued only after the website verifies live authentication and the owner RPC.
// Bound to one token and exact request, so the relay need not repeat that RPC.
export function signOwnerAssertion({key,owner,token,body,now=Date.now()}){
 if(!uuid.test(owner||'')||typeof key!=='string'||key.length<32)throw Error('Invalid owner assertion configuration.');
 const claims={sub:owner,iat:now,nonce:randomBytes(16).toString('hex'),request:hash(JSON.stringify(body)),token:hash(token)};
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');return payload+'.'+mac(key,payload).toString('base64url');
}
export function verifyOwnerAssertion({assertion,key,token,body,now=Date.now()}){
 if(typeof assertion!=='string'||assertion.length>1200||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(assertion))throw Error('Invalid owner assertion.');
 const [payload,signature]=assertion.split('.'),actual=Buffer.from(signature,'base64url'),expected=mac(key,payload);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Invalid owner assertion.');
 const claims=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(!uuid.test(claims.sub||'')||!Number.isSafeInteger(claims.iat)||claims.iat>now+1000||claims.iat<now-5000||!/^[a-f0-9]{32}$/.test(claims.nonce||'')||claims.request!==hash(JSON.stringify(body))||claims.token!==hash(token))throw Error('Expired or mismatched owner assertion.');
 return {id:claims.sub,name:'Owner',nonce:claims.nonce,expires:claims.iat+6000};
}
