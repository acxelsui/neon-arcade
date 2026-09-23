import {next} from '@vercel/edge';
import {createAccessGate} from './lib/access-gate.mjs';
const gate=createAccessGate();
export const config={matcher:'/:path*'};
export default async function middleware(request){
 const denied=await gate(request);if(denied)return denied;
 const response=next();response.headers.set('Cache-Control','private, no-store');return response;
}
