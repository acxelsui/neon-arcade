import {achromaGames} from './cloud-sources.js';
export const cloudMoonGames=Object.freeze({roblox:'com.roblox.client',clash:'com.supercell.clashroyale',stumble:'com.kitkagames.fallbuddies',fortnite:'com.epicgames.fortnite'});
export function cloudChoices(game){
 const choices=[{id:'original',name:'Original'}];
 if(Object.hasOwn(achromaGames,game))choices.push({id:'achroma',name:'Achroma'});
 if(Object.hasOwn(cloudMoonGames,game))choices.push({id:'cloudmoon',name:'CloudMoon'});
 return choices;
}
export function cloudMoonPlayer(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='www.cloudmoonapp.com'||url.pathname!=='/run-site/'||url.username||url.password||!/^[-\w]{16,100}$/.test(url.searchParams.get('sid')||''))return null;
 return 'https://www.cloudmoonapp.com/run-site/?'+new URLSearchParams({sid:url.searchParams.get('sid'),quality:['SD','HD','FHD'].includes(url.searchParams.get('quality'))?url.searchParams.get('quality'):'SD'});
 }catch{return null}
}
export function chooseCloudLauncher(game,name){return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.className='cloud-launcher-dialog';
 const title=document.createElement('h2');title.id='cloud-launcher-choice-title';title.textContent='Launch '+name;dialog.setAttribute('aria-labelledby',title.id);
 const note=document.createElement('p');note.textContent='Choose a launcher for this game.';
 const options=document.createElement('div');options.className='cloud-launcher-options';
 const message=document.createElement('p');message.setAttribute('role','status');let result=null;
 dialog.append(title,note,options,message);
 for(const choice of cloudChoices(game)){
  const button=document.createElement('button');button.type='button';button.textContent=choice.name;
  if(choice.id==='cloudmoon'){
   const field=document.createElement('input');field.type='url';field.placeholder='Paste this game’s CloudMoon player link';field.setAttribute('aria-label',name+' CloudMoon player link');
   try{field.value=sessionStorage.getItem('neon-cloudmoon-'+game)||''}catch{}
   const help=document.createElement('small');help.textContent='Use a fresh CloudMoon player link for this game. CloudMoon may require sign-in. Links may expire or work only in the browser that created them. Kept only in this tab.';
   button.onclick=()=>{const url=cloudMoonPlayer(field.value);if(!url){message.textContent='Paste a valid CloudMoon run-site player link first.';field.focus();return;}try{sessionStorage.setItem('neon-cloudmoon-'+game,url)}catch{}result={source:choice.id,url};dialog.close();};
   const fresh=document.createElement('a');fresh.href='https://www.cloudmoonapp.com/game/'+cloudMoonGames[game]+'/';fresh.target='_blank';fresh.rel='noopener noreferrer';fresh.textContent='Open '+name+' on CloudMoon';
   const card=document.createElement('div');card.className='cloudmoon-choice';card.append(field,button,fresh,help);options.append(card);
  }else{button.onclick=()=>{result={source:choice.id};dialog.close();};options.append(button)}
 }
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();dialog.append(cancel);
 dialog.addEventListener('close',()=>{dialog.remove();resolve(result)},{once:true});document.body.append(dialog);dialog.showModal();
});}
