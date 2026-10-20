import {kahootText,parseKahootQuiz,matchKahootAnswer,fetchPublicKahoot} from './kahoot-auto-model.js';

export function createKahootAuto({host,transport,doc=document,win=window}){
 const panel=doc.createElement('aside');panel.className='kahoot-auto';panel.setAttribute('aria-label','Neon Kahoot Auto');
 panel.innerHTML='<header><strong>Neon Kahoot Auto</strong><button type="button" aria-label="Collapse Kahoot panel" aria-expanded="true">−</button></header><div class="ka-body"><form><label>Public quiz link<input type="url" placeholder="https://create.kahoot.it/details/…" aria-label="Public Kahoot quiz link"></label><button type="submit">Load quiz</button></form><label class="ka-import">Import quiz JSON<input type="file" accept=".json,application/json" aria-label="Import Kahoot quiz JSON"></label><p class="ka-quiz">No quiz loaded</p><label class="ka-toggle"><input type="checkbox"> Auto-select matched answers</label><button type="button" class="ka-answer" disabled>Select matched answer</button><p class="ka-state" role="status">Load the quiz, then join the game on the left.</p><details><summary>Answers</summary><ol class="ka-answers"></ol></details><small>Requires the matching answer key and visible question/answer text. Shape-only screens and unsupported questions stay manual.</small></div>';
 host.append(panel);
 if(win.innerWidth<700){panel.querySelector('.ka-body').hidden=true;panel.querySelector('header button').textContent='+';panel.querySelector('header button').setAttribute('aria-expanded','false');}
 const $=selector=>panel.querySelector(selector),status=text=>$('.ka-state').textContent=text;
 let quiz=null,playerDoc=null,stopped=false,abort=null,match=null,lastTarget=null,lastQuestion=null,armedAt=0,loadVersion=0;
 const visible=element=>element?.isConnected&&!element.disabled&&element.getAttribute('aria-disabled')!=='true'&&element.getClientRects().length>0;
 function install(value){quiz=value;lastTarget=null;$('.ka-quiz').textContent=value.title+' · '+value.questions.filter(q=>q.supported).length+' supported questions';
  const list=$('.ka-answers');list.replaceChildren();for(const q of quiz.questions){const row=doc.createElement('li');row.textContent=q.question+' — '+(q.supported?q.answers[q.correct[0]]:'Manual question');list.append(row);}status('Quiz loaded. Waiting for a matching live question.');}
 async function load(work){const version=++loadVersion;abort?.abort();abort=new AbortController();quiz=match=null;lastTarget=lastQuestion=null;$('.ka-answer').disabled=true;$('.ka-answers').replaceChildren();$('.ka-quiz').textContent='No quiz loaded';$('.ka-state').textContent='Loading quiz…';const currentAbort=abort;const timeout=win.setTimeout(()=>currentAbort.abort(),15000);try{const value=await work(currentAbort.signal);if(!stopped&&version===loadVersion)install(value);}catch(error){if(!stopped&&version===loadVersion)status(error.name==='AbortError'?'Quiz loading timed out. Try again or import JSON.':error.message||'Could not read this quiz.');}finally{win.clearTimeout(timeout);}}
 $('form').onsubmit=event=>{event.preventDefault();return load(signal=>fetchPublicKahoot(transport,$('input[type="url"]').value,signal));};
 $('input[type="file"]').onchange=()=>{const file=$('input[type="file"]').files?.[0];if(!file)return;return load(async()=>{if(file.size>4*1024*1024)throw Error('Choose a quiz JSON smaller than 4 MB.');return parseKahootQuiz(JSON.parse(await file.text()));});};
 $('header button').onclick=()=>{const body=$('.ka-body');body.hidden=!body.hidden;$('header button').textContent=body.hidden?'+':'−';$('header button').setAttribute('aria-expanded',String(!body.hidden));};
 function submit(){if(!match||!visible(match.target))return;const selected=match;match=null;$('.ka-answer').disabled=true;armedAt=Infinity;selected.target.click();status('Selected '+selected.answer+'. Waiting for the next question.');}
 $('.ka-answer').onclick=submit;
 function check(){if(stopped||!playerDoc||!quiz)return;
  const buttons=[...playerDoc.querySelectorAll('button[data-functional-selector^="answer-"],button[data-testid^="answer-"]')].filter(el=>/^answer-\d$/.test(el.getAttribute('data-functional-selector')||el.getAttribute('data-testid'))&&visible(el));
  match=null;$('.ka-answer').disabled=true;if(buttons.length<2){lastTarget=null;return;}
  const labels=buttons.map(el=>kahootText(el.innerText||el.textContent||el.getAttribute('aria-label')));
  const prompts=[...playerDoc.querySelectorAll('[data-functional-selector="block-title"],[data-functional-selector="question-title"],[data-functional-selector="question"],h1,h2')].map(el=>kahootText(el.textContent));
  const body=kahootText(playerDoc.body?.innerText);
  const candidates=quiz.questions.filter(q=>q.supported&&q.question&&(prompts.includes(q.question)||body.includes(q.question)));
  const results=[...new Set(candidates.map(q=>q.question))].map(prompt=>matchKahootAnswer(quiz,prompt,labels)).filter(Boolean);
  if(results.length!==1){status('No unique question/answer match. Choose manually for this screen.');return;}
  const result=results[0],target=buttons[result.index];if(lastTarget===target&&lastQuestion===result.question&&armedAt===Infinity)return;match={...result,target};$('.ka-answer').disabled=false;
  if(lastTarget!==target||lastQuestion!==result.question){lastTarget=target;lastQuestion=result.question;armedAt=Date.now();}
  if(armedAt===Infinity)return;
  status('Matched: '+result.answer);
  if($('.ka-toggle input').checked&&Date.now()-armedAt>=700)submit();
 }
 const timer=win.setInterval(()=>{try{check();}catch{match=null;$('.ka-answer').disabled=true;status('Waiting for a supported question screen.');}},300);
 return {setDocument(value){playerDoc=value;match=null;lastTarget=null;},destroy(){stopped=true;loadVersion++;abort?.abort();win.clearInterval(timer);playerDoc=quiz=match=null;panel.remove();}};
}
