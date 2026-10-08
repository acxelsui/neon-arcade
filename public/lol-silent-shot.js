import {LOL_SHOT_PROFILE} from './lol-shot-profile.js';
import {BUILDNOW_SHOT_PROFILE} from './buildnow-shot-profile.js';
// Changes only the inspected local shot ray, after its camera ray is built.
// Original physics, damage, ammo, network validation and camera stay intact.
const leb=(b,p)=>{let value=0,shift=0,n;do{if(p>=b.length||shift>28)throw Error('Invalid engine section');n=b[p++];value|=(n&127)<<shift;shift+=7;}while(n&128);return [value>>>0,p];};
const encode=n=>{const a=[];do{const b=n&127;n>>>=7;a.push(b|(n?128:0));}while(n);return new Uint8Array(a);};
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const hash=async(b,subtle)=>Array.from(new Uint8Array(await subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
function localInfo(body){let [count,p]=leb(body,0);for(let i=0;i<count;i++){[,p]=leb(body,p);p++;}return {count,end:p};}
export const patchLolShotWasm=(input,options={})=>patchShotWasm(input,LOL_SHOT_PROFILE,options);
export const patchBuildNowShotWasm=(input,options={})=>patchShotWasm(input,BUILDNOW_SHOT_PROFILE,options);
async function patchShotWasm(input,profile,{subtle=globalThis.crypto.subtle,validate=b=>WebAssembly.validate(b)}={}){
 const isBuffer=Object.prototype.toString.call(input)==='[object ArrayBuffer]';
 if(!isBuffer&&!ArrayBuffer.isView(input))return null;
 const b=isBuffer?new Uint8Array(input):new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
 if(b.length!==profile.bytes||await hash(b,subtle)!==profile.sha256)return null;
 const parts=[b.subarray(0,8)];let p=8,changed=0;
 while(p<b.length){const id=b[p++],[size,start]=leb(b,p),end=start+size;let data=b.subarray(start,end);
  if(id===6){const [count,q]=leb(b,start);if(count!==profile.globalCount)throw Error('Unknown engine globals');data=join([encode(count+1),b.subarray(q,end),new Uint8Array([0x7f,1,0x41,0,0x0b])]);}
  else if(id===7){const [count,q]=leb(b,start),name=new TextEncoder().encode('neonSilentState');data=join([encode(count+1),b.subarray(q,end),encode(name.length),name,new Uint8Array([3]),encode(profile.globalIndex)]);}
  else if(id===10){const [count,q]=leb(b,start),bodies=[encode(count)];let cursor=q;
   for(let i=0;i<count;i++){const [length,bodyStart]=leb(b,cursor);let body=b.subarray(bodyStart,bodyStart+length);cursor=bodyStart+length;
    const index=i+profile.importCount;
    if(index===profile.insertFunction){
     if(await hash(body,subtle)!==profile.insertHash)throw Error('Unknown BuildNow firing routine');
     const locals=localInfo(body),marker=profile.marker;let at=-1;
     for(let j=locals.end;j<=body.length-marker.length;j++)if(marker.every((v,k)=>body[j+k]===v)){if(at!==-1)throw Error('Ambiguous firing branch');at=j;}
     if(at<0)throw Error('Missing firing branch');const [,declStart]=leb(body,0);
     body=join([encode(locals.count+profile.newLocals.length),body.subarray(declStart,locals.end),...profile.newLocals.flatMap(([n,type])=>[encode(n),new Uint8Array([type])]),body.subarray(locals.end,at),new Uint8Array(profile.insert),body.subarray(at)]);changed++;
    }else if(index===profile.checkFunction){if(await hash(body,subtle)!==profile.checkHash)throw Error('Unknown shot routine');const locals=localInfo(body);body=join([body.subarray(0,locals.end),new Uint8Array(profile.checkPrefix),body.subarray(locals.end)]);changed++;}
    else if(index===profile.rayFunction){if(await hash(body,subtle)!==profile.rayHash)throw Error('Unknown ray routine');const locals=localInfo(body),marker=join([new Uint8Array([0x10]),encode(profile.afterCall)]);let at=-1;
     for(let j=locals.end;j<=body.length-marker.length;j++)if(marker.every((v,k)=>body[j+k]===v)){if(at!==-1)throw Error('Ambiguous shot ray');at=j+marker.length;}
     if(at<0)throw Error('Missing shot ray');const [,declStart]=leb(body,0);
     body=join([encode(locals.count+1),body.subarray(declStart,locals.end),encode(profile.newFloatLocals),new Uint8Array([0x7d]),body.subarray(locals.end,at),new Uint8Array(profile.rayInsert),body.subarray(at)]);changed++;
    }
    bodies.push(encode(body.length),body);
   }data=join(bodies);
  }
  parts.push(new Uint8Array([id]),encode(data.length),data);
  p=end;
 }
 const output=join(parts);if(changed!==(profile.insertFunction?1:2)||!validate(output))throw Error('Shot patch did not validate');return output;
}
export function installLolSilentShot(win,{notify=()=>{},gameId='58'}={}){
 const patchEngine=gameId==='58'?patchLolShotWasm:gameId==='581'?patchBuildNowShotWasm:null;if(!patchEngine)return null;
 const wa=win.WebAssembly;if(!wa||!win.crypto?.subtle)return null;
 let permitted=true,global=null,memory=null,module=null,pointer=0,ready=false,lastCount=0;
 const restore=[];
 const capture=(result,imports)=>{if(!permitted)return;const instance=result?.instance??result,g=instance?.exports?.neonSilentState;if(g){const values=[...Object.values(instance.exports),...Object.values(imports??{}).flatMap(namespace=>Object.values(namespace??{}))];const found=values.find(value=>value instanceof (wa.Memory??WebAssembly.Memory));if(found){if(global!==g||memory!==found){clear();if(global)global.value=0;module=null;pointer=0;ready=false;lastCount=0;}global=g;memory=found;}}};
 const prepare=async input=>{if(!permitted)return input;try{return await patchEngine(input,{subtle:win.crypto.subtle,validate:b=>wa.validate(b)})??input;}catch(error){win.console?.warn('Neon shot controls unavailable:',error.message);return input;}};
 function patch(key,handler){if(typeof wa[key]!=='function')return;const original=wa[key],wrapped=new Proxy(original,{apply:handler});wa[key]=wrapped;restore.push(()=>{if(wa[key]===wrapped)wa[key]=original;});}
 const instantiate=wa.instantiate;
 patch('instantiate',async(target,receiver,args)=>{const result=await Reflect.apply(target,receiver,[await prepare(args[0]),...args.slice(1)]);capture(result,args[1]);return result;});
 patch('compile',async(target,receiver,args)=>Reflect.apply(target,receiver,[await prepare(args[0]),...args.slice(1)]));
 patch('instantiateStreaming',async(target,receiver,args)=>{const response=await args[0],bytes=await response.clone().arrayBuffer(),prepared=await prepare(bytes);if(prepared!==bytes){const result=await Reflect.apply(instantiate,wa,[prepared,args[1]]);capture(result,args[1]);return result;}const result=await Reflect.apply(target,receiver,[response,...args.slice(1)]);capture(result,args[1]);return result;});
 const clear=()=>{if(module?.HEAPU32&&pointer&&pointer+12<=module.HEAPU32.byteLength){module.HEAPU32[pointer>>>2]=0;module.HEAPU32[(pointer+8)>>>2]=0;}};
 return {
  update(m,{enabled=false,shooting=0,actor=0,health=0,kind=0,point=null,chance=90}={}){
   clear();if(!permitted||!global||memory?.buffer!==m.HEAPU8.buffer)return false;
   if(module!==m||!pointer){module=m;pointer=m._malloc(48);if(!pointer||pointer%4||pointer+48>m.HEAPU8.length){pointer=0;return false;}m.HEAPU8.fill(0,pointer,pointer+48);m.HEAPU32[(pointer+12)>>>2]=Math.floor(Math.random()*0xffffffff)||1;global.value=pointer;}
   if(global.value!==pointer)global.value=pointer;
   if(!ready){ready=true;notify('shot-ready');}
   const count=m.HEAPU32[(pointer+36)>>>2];if(count!==lastCount){lastCount=count;notify('shot-redirected');}
   if(!enabled||!shooting||!actor||!point?.every(Number.isFinite))return true;
   m.HEAPU32[(pointer+4)>>>2]=shooting;if(gameId==='581'){m.HEAPU32[(pointer+8)>>>2]=kind==='dummy'?1:kind==='training-bot'?2:kind==='trainer'?3:0;m.HEAPU32[(pointer+32)>>>2]=health;}m.HEAPF32.set(point,(pointer+16)>>>2);m.HEAPU32[(pointer+28)>>>2]=Math.min(100,Math.max(1,Math.round(chance)||90));m.HEAPU32[(pointer+44)>>>2]=actor;m.HEAPU32[pointer>>>2]=1;return true;
  },
  clear,
  reset(){clear();ready=false;},
  revoke(){permitted=false;clear();if(global)global.value=0;if(module&&pointer)module._free(pointer);pointer=0;restore.reverse().forEach(fn=>fn());}
 };
}
