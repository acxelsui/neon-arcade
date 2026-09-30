// Open from the account origin to retain its isolation and cookie partition.
// The external host module must send the pass from the popup's own realm:
// postMessage from this module would identify the original account window.
export function openBlankGame({game,contentOrigin,accountOrigin,pass,host=window}){
 if(!game||typeof game.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(game.id)||typeof game.name!=='string'||game.name.length>120||!pass)return false;
 const tab=host.open('about:blank','_blank');if(!tab)return false;
 try{
  const doc=tab.document;doc.title=game.name+' · Neon Arcade';doc.body.className='blank-game';
  const status=doc.createElement('p');status.id='blank-status';status.textContent='Opening your game…';doc.body.append(status);
  const css=doc.createElement('link');css.rel='stylesheet';css.href=accountOrigin+'/style.css';doc.head.append(css);
  tab.neonBlankGameLaunch={game:{id:game.id,name:game.name},contentOrigin,pass};
  const script=doc.createElement('script');script.type='module';script.src=accountOrigin+'/blank-game-host.js';
  script.onerror=()=>{delete tab.neonBlankGameLaunch;status.textContent='The game launcher could not load. Close this tab and try about:blank again.'};
  doc.head.append(script);tab.opener=null;return true;
 }catch{tab.close?.();return false}
}
