// Shared movement prediction for the two camera adapters. It changes only
// the point the camera follows; it never changes a bullet or reports a hit.
export function createNativeTargetTracker(){
 const actors=new Map();
 return {
  observe(id,position,now){
   if(!Number.isFinite(now)||!position?.every(Number.isFinite))return;
   let entry=actors.get(id);
   if(!entry||now<entry.at){actors.set(id,{position:[...position],velocity:[0,0,0],at:now,seen:now});return;}
   entry.seen=now;const dt=(now-entry.at)/1000;if(dt<.05)return;
   const raw=position.map((p,i)=>(p-entry.position[i])/dt),speed=Math.hypot(...raw);
   // Respawns, teleports and gaps in sampling must not produce a lead offset.
   if(dt>.2||speed>35||position.some((p,i)=>Math.abs(p-entry.position[i])>3))entry.velocity=[0,0,0];
   else if(speed<.2)entry.velocity=[0,0,0];
   else {
    const reversal=raw.reduce((n,v,i)=>n+v*entry.velocity[i],0)<0;
    const alpha=reversal?1:1-Math.exp(-dt/.04);
    entry.velocity=entry.velocity.map((v,i)=>v+(raw[i]-v)*alpha);
   }
   entry.position=[...position];entry.at=now;
  },
  predict(id,position,now,smoothing=70){
   const entry=actors.get(id);if(!entry||now-entry.at>200)return [...position];
   // Compensate for camera smoothing, with a short horizon and a strict world
   // distance bound. Vertical lead is smaller to avoid following head bob.
   const horizon=Math.min(.18,.04+Math.min(100,Math.max(1,smoothing))*.002);
   const delta=entry.velocity.map((v,i)=>v*(i===1?Math.min(.035,horizon):horizon));
   const length=Math.hypot(...delta),factor=length>.65?.65/length:1;
   return position.map((p,i)=>p+delta[i]*factor);
  },
  remove(id){actors.delete(id);},
  prune(now){for(const [id,entry] of actors)if(now-entry.seen>300)actors.delete(id);},
  clear(){actors.clear();}
 };
}
