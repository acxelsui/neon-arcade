// Adapt the source app's branding without changing media or player controls.
export function brandMusicDocument(doc,original='Voidify',replacement='Neon Music'){
 let queued=false,stopped=false;
 function apply(){
  queued=false;if(stopped)return;
  const headings=[...doc.querySelectorAll('h1,h2,[role="heading"],strong,p,.brand,.logo')];
  const branded=headings.filter(el=>[original.toLowerCase(),replacement.toLowerCase()].includes(el.textContent.trim().toLowerCase()));
  if(doc.title.toLowerCase().includes(original.toLowerCase()))doc.title=doc.title.replace(new RegExp(original,'ig'),replacement);
  for(const el of doc.querySelectorAll('[aria-label],[title]'))for(const attr of ['aria-label','title'])if(el.getAttribute(attr)?.trim().toLowerCase()===original.toLowerCase())el.setAttribute(attr,replacement);
  if(!branded.length)return;
  for(const heading of branded){
   const walker=doc.createTreeWalker(heading,4);let node;
   while(node=walker.nextNode())if(node.nodeValue.trim().toLowerCase()===original.toLowerCase())node.nodeValue=node.nodeValue.replace(new RegExp(original,'ig'),replacement);
  }
  // Remove the outer site navigation only. Preserve music navigation and controls.
  const candidates=[...doc.querySelectorAll('header,nav,[role="banner"]')];
  for(const el of candidates){
   const text=el.textContent||'';
   if(/Void Network/i.test(text)&&/VoidCraft/i.test(text)&&!el.contains(branded[0])){
    el.style.setProperty('display','none','important');
   }
  }
 }
 // Playback progress and lyrics change frequently. Only rescan the document
 // when new text can contain branding, rather than on every player update.
 function relevant(node){const text=String(node?.textContent||node?.nodeValue||'').toLowerCase();return text.includes(original.toLowerCase())||text.includes('void network')||text.includes('voidcraft');}
 const observer=new MutationObserver(records=>{if(!queued&&!stopped&&records.some(record=>record.type==='characterData'?relevant(record.target):[...record.addedNodes].some(relevant))){queued=true;queueMicrotask(apply)}});
 // Observe text/children, not styles, so our visibility edits do not loop.
 observer.observe(doc.body,{childList:true,subtree:true,characterData:true});apply();
 return ()=>{stopped=true;observer.disconnect()};
}
