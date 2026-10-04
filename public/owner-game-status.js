import {gameStatusRows,filterGameStatus} from './game-status-model.js';
export function initOwnerGameStatus({dialog,request,isAllowed,onDenied}){
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const section=el('section',undefined,'owner-game-status');section.setAttribute('aria-labelledby','owner-games-heading');
 const title=el('h3','Game status');title.id='owner-games-heading';
 const description=el('p','Shared load reports and owner reviews. Loaded means the game page responded; it does not guarantee gameplay. Connection issues can also cause failed loads.');
 const summary=el('div',undefined,'owner-game-summary'),controls=el('div',undefined,'owner-game-filters'),search=el('input');search.type='search';search.placeholder='Find a game…';search.setAttribute('aria-label','Search game status');
 const filter=el('select');filter.setAttribute('aria-label','Filter game status');for(const [value,text] of [['all','All games'],['issues','Broken / load issues'],['good','Working / loaded'],['unchecked','Unchecked']]){const option=el('option',text);option.value=value;filter.append(option);}
 const reload=el('button','Refresh game status');reload.type='button';
 controls.append(search,filter,reload);const status=el('p');status.setAttribute('role','status');const list=el('div',undefined,'owner-game-list'),pagination=el('div',undefined,'owner-pagination'),prev=el('button','← Previous'),next=el('button','Next →'),page=el('span');prev.type=next.type='button';pagination.append(prev,page,next);section.append(title,description,summary,controls,status,list,pagination);dialog.querySelector('.owner-columns').before(section);
 let catalog=null,rows=[],offset=0,generation=0,saving=false;const drafts=new Map();
 const labels={working:'Working · owner checked',broken:'Broken · owner checked',loaded:'Loaded successfully',failed:'Load failed',slow:'Slow / no load response',unchecked:'Unchecked',unavailable:'Unavailable game file'};
 function reset(){generation++;rows=[];drafts.clear();summary.replaceChildren();list.replaceChildren();status.textContent='';pagination.hidden=true;}
 function card(item){
  const {game,row}=item,card=el('article',undefined,'owner-game-card'),heading=el('div',undefined,'owner-game-heading'),badge=el('span',labels[item.status],item.issue?'owner-game-badge issue':'owner-game-badge '+(item.good?'good':'unknown'));
  heading.append(el('strong',game.name),badge);card.append(heading);
  if(item.status==='working'&&item.issue)card.append(el('p','A new load issue was reported. Retest this game.'));
  const counts=`${row.loaded_count||0} loaded · ${row.failed_count||0} failed · ${row.slow_count||0} slow`;
  card.append(el('p',row.last_report_at?counts+' · Last report '+new Date(row.last_report_at).toLocaleString():'No load reports yet.'));
  if(row.load_detail&&row.latest_load!=='loaded')card.append(el('p',({http:'The game server returned an error.',network:'The proxy could not reach the game.',timeout:'No successful page response after 45 seconds.',start:'The game could not start.'})[row.load_detail]));
  if(row.reviewed_at)card.append(el('p','Reviewed by '+(row.reviewed_by||'a former owner')+' · '+new Date(row.reviewed_at).toLocaleString()));
  const note=el('input');note.maxLength=240;note.placeholder='Owner note (optional)';note.setAttribute('aria-label','Owner note for '+game.name);note.value=drafts.has(game.id)?drafts.get(game.id):row.review_note||'';note.oninput=()=>drafts.set(game.id,note.value);card.append(note);
  const actions=el('div',undefined,'owner-game-actions');
  const test=el('button','Test game');test.type='button';test.disabled=!!game.unavailable||saving;test.onclick=()=>{if(!isAllowed())return;dialog.close();window.dispatchEvent(new CustomEvent('neon-play-game',{detail:game.id}));};actions.append(test);
  for(const [value,label] of [['working','Mark working'],['broken','Mark broken'],['clear','Clear review']]){const button=el('button',label);button.type='button';button.disabled=saving;button.onclick=()=>review(game.id,value,note.value);actions.append(button);}card.append(actions);return card;
 }
 function render(){
  if(!isAllowed()||!dialog.open)return;
  const selected=filterGameStatus(rows,{query:search.value,filter:filter.value});offset=Math.max(0,Math.min(offset,Math.max(0,Math.ceil(selected.length/25)-1)*25));
  summary.replaceChildren(...[['issues','Needs attention',rows.filter(r=>r.issue).length],['good','Working / loaded',rows.filter(r=>r.good).length],['unchecked','Unchecked',rows.filter(r=>r.status==='unchecked').length]].map(([value,text,count])=>{const button=el('button',count+' '+text);button.type='button';button.onclick=()=>{filter.value=value;offset=0;render()};return button;}));
  list.replaceChildren(...(selected.length?selected.slice(offset,offset+25).map(card):[el('p','No games match this filter.')]));pagination.hidden=false;prev.disabled=offset===0;next.disabled=offset+25>=selected.length;page.textContent=selected.length?`${offset+1}–${Math.min(offset+25,selected.length)} of ${selected.length}`:'0 games';
 }
 async function refresh(){
  if(!dialog.open||!isAllowed()||saving)return;const token=++generation;reload.disabled=true;
  try{
   const [games,reports]=await Promise.all([catalog?Promise.resolve(catalog):fetch('/catalog.json').then(async response=>{if(!response.ok)throw Error('The game catalog could not load.');return (await response.json()).games;}),request('owner-game-status')]);
   if(token!==generation||!dialog.open||!isAllowed())return;catalog=games;rows=gameStatusRows(games,reports);status.textContent='';if(!list.contains(document.activeElement))render();
  }catch(error){if(token===generation&&dialog.open){rows=[];summary.replaceChildren();list.replaceChildren();pagination.hidden=true;status.textContent=error.message;}onDenied?.();}
  finally{if(token===generation)reload.disabled=false;}
 }
 async function review(gameId,value,note){
  if(saving||!isAllowed())return;saving=true;let saved=false;const token=generation;section.setAttribute('aria-busy','true');render();status.textContent='Saving review…';
  try{await request('owner-game-review',{gameId,status:value,note});if(token!==generation||!isAllowed()||!dialog.open)return;drafts.delete(gameId);saved=true;status.textContent='Review saved.';}
  catch(error){if(token===generation)status.textContent=error.message;onDenied?.();}
  finally{saving=false;section.removeAttribute('aria-busy');if(token===generation){if(saved)await refresh();render();}}
 }
 search.oninput=filter.onchange=()=>{offset=0;render();};reload.onclick=refresh;prev.onclick=()=>{offset=Math.max(0,offset-25);render();};next.onclick=()=>{offset+=25;render();};
 dialog.addEventListener('close',()=>{generation++;reload.disabled=false;});reset();return {refresh,reset};
}
