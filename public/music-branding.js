// Adapt only the music page identified by its visible brand, not other destinations.
export function brandMusicDocument(doc){
 let queued=false,stopped=false;
 function apply(){
  queued=false;if(stopped)return;
  const headings=[...doc.querySelectorAll('h1,h2,[role="heading"]')];
  const branded=headings.filter(el=>/^(Voidify|Neon Music)$/i.test(el.textContent.trim()));
  if(!branded.length)return;
  for(const heading of branded){
   const walker=doc.createTreeWalker(heading,4);let node;
   while(node=walker.nextNode())if(node.nodeValue.trim()==='Voidify')node.nodeValue=node.nodeValue.replace('Voidify','Neon Music');
  }
  if(/voidify/i.test(doc.title))doc.title='Neon Music';
  // Remove the outer site navigation only. Preserve music navigation and controls.
  const candidates=[...doc.querySelectorAll('header,nav,[role="banner"]')];
  for(const el of candidates){
   const text=el.textContent||'';
   if(/Void Network/i.test(text)&&/VoidCraft/i.test(text)&&!el.contains(branded[0])){
    el.style.setProperty('display','none','important');
   }
  }
 }
 const observer=new MutationObserver(()=>{if(!queued&&!stopped){queued=true;queueMicrotask(apply)}});
 // Observe text/children, not styles, so our visibility edits do not loop.
 observer.observe(doc.body,{childList:true,subtree:true,characterData:true});apply();
 return ()=>{stopped=true;observer.disconnect()};
}
