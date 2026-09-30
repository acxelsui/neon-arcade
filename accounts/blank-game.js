// The account-origin blank window keeps the same top-level cookie partition
// and isolation policy as the signed-in account page.
export function openBlankGame({game,contentOrigin,accountOrigin,pass,host=window}){
 if(!game||typeof game.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(game.id)||typeof game.name!=='string'||game.name.length>120||!pass)return false;
 const tab=host.open('about:blank','_blank');if(!tab)return false;
 try{
  const doc=tab.document;doc.title=game.name+' · Neon Arcade';doc.body.className='blank-game';
  const css=doc.createElement('link');css.rel='stylesheet';css.href=accountOrigin+'/style.css';doc.head.append(css);
  const frame=doc.createElement('iframe');frame.title=game.name;frame.allow='cross-origin-isolated; autoplay; fullscreen; gamepad';frame.allowFullscreen=true;
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-modals');
  let sent=false;
  tab.addEventListener('message',event=>{
   if(event.source!==frame.contentWindow||event.origin!==contentOrigin||event.data?.channel!=='neon-members-v1'||event.data.type!=='access-ready'||sent)return;
   sent=true;frame.contentWindow.postMessage({channel:'neon-members-v1',type:'access-pass',pass},contentOrigin);
  });
  frame.src=contentOrigin+'/neon-access#game='+encodeURIComponent(game.id);doc.body.append(frame);tab.opener=null;return true;
 }catch{tab.close?.();return false}
}
