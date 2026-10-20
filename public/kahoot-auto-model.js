// Adapted from kahoot-auto's ParseQuizInformation by Peter Stenger (@reteps).
// Original project: https://github.com/unixpickle/kahoot-hack (BSD-2-Clause).
export const kahootText=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const key=value=>kahootText(value).toLowerCase();
export function kahootQuizId(input){
 const value=String(input).trim(),uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 if(uuid.test(value))return value.toLowerCase();
 try{const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='create.kahoot.it'||url.username||url.password)return null;
  const candidate=url.pathname.split('/').filter(Boolean).find(part=>uuid.test(part))||url.hash.split('/').find(part=>uuid.test(part));return candidate?.toLowerCase()||null;
 }catch{return null;}
}
export function parseKahootQuiz(data){
 if(!data?.questions&&data?.kahoot?.questions)data=data.kahoot;
 if(!data||!Array.isArray(data.questions)||!data.questions.length||data.questions.length>1000)throw Error('This file does not contain a supported Kahoot quiz.');
 const questions=data.questions.map((q,index)=>{
  const choices=Array.isArray(q.choices)?q.choices:[];
  const answers=choices.map(c=>kahootText(c?.answer));
  const correct=choices.flatMap((c,i)=>c?.correct===true?[i]:[]);
  return {index,question:kahootText(q.question),answers,correct,supported:!!kahootText(q.question)&&['quiz','true_false',undefined].includes(q.type)&&answers.length>=2&&answers.length<=4&&answers.every(Boolean)&&new Set(answers.map(key)).size===answers.length&&correct.length===1};
 });
 return {id:kahootQuizId(data.uuid),title:kahootText(data.title)||'Imported quiz',questions};
}
// Match text and the live choice labels; never assume host order matches the file.
export function matchKahootAnswer(quiz,prompt,labels){
 if(!quiz||!kahootText(prompt)||labels.length<2)return null;
 const live=labels.map(key),matches=quiz.questions.filter(q=>q.supported&&key(q.question)===key(prompt)&&q.answers.length===live.length&&q.answers.every(answer=>live.includes(key(answer))));
 if(matches.length!==1)return null;
 const question=matches[0],index=live.indexOf(key(question.answers[question.correct[0]]));
 return index>=0?{question,index,answer:question.answers[question.correct[0]]}:null;
}
export async function fetchPublicKahoot(transport,input,signal){
 const id=kahootQuizId(input);if(!id)throw Error('Paste a public Kahoot quiz link or quiz ID.');
 const result=await transport.request(new URL('https://create.kahoot.it/rest/kahoots/'+id),'GET',null,[['Accept','application/json']],signal);
 if(result.status!==200){await result.body?.cancel?.();throw Error(result.status===401||result.status===403?'This quiz requires access. Import an exported quiz file instead.':'The quiz could not be loaded ('+result.status+').');}
 const reader=result.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4*1024*1024)throw Error('This quiz file is too large.');chunks.push(part.value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}
 const quiz=parseKahootQuiz(JSON.parse(await new Blob(chunks).text()));
 if(quiz.id&&quiz.id!==id)throw Error('The returned quiz does not match this link.');
 return quiz;
}
