// Yield between small DOM batches so navigation and typing remain responsive.
export function createBatchedRenderer({schedule=callback=>requestAnimationFrame(callback),size=36}={}){
 let version=0;
 return async function render(items,append){
  const current=++version;
  for(let index=0;index<items.length;index+=size){
   if(index)await new Promise(schedule);
   if(current!==version)return false;
   append(items.slice(index,index+size));
  }
  return current===version;
 };
}
