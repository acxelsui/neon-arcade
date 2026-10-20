import test from 'node:test';
import assert from 'node:assert/strict';
import {kahootQuizId,parseKahootQuiz,matchKahootAnswer,fetchPublicKahoot,exposedKahootQuizId,kahootJoinDetails,kahootMetadataReferences} from '../public/kahoot-auto-model.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const data={uuid:id,title:'Math',questions:[{type:'quiz',question:'2 + 2?',choices:[{answer:'3'},{answer:'4',correct:true},{answer:'5'},{answer:'6'}]}]};
const perms=values=>values.length?values.flatMap((value,i)=>perms(values.filter((_,j)=>i!==j)).map(rest=>[value,...rest])):[[]];

test('Kahoot links are restricted to the real HTTPS quiz host',()=>{
 for(const input of [id,'https://create.kahoot.it/details/'+id,'https://create.kahoot.it/details/math/'+id,'https://create.kahoot.it/#quiz/'+id])assert.equal(kahootQuizId(input),id);
 for(const input of ['123456','javascript:alert(1)','https://create.kahoot.it.evil.test/details/'+id,'http://create.kahoot.it/details/'+id,'https://user:pass@create.kahoot.it/details/'+id])assert.equal(kahootQuizId(input),null);
});
test('answer selection follows text across every live answer order',()=>{
 const quiz=parseKahootQuiz(data);
 for(const labels of perms(['3','4','5','6']))assert.equal(labels[matchKahootAnswer(quiz,'2 + 2?',labels).index],'4');
 assert.equal(matchKahootAnswer(quiz,'2 + 2?',['triangle','diamond','circle','square']),null);
 assert.equal(matchKahootAnswer(quiz,'2 + 3?',['3','4','5','6']),null);
});
test('unknown keys, unsupported question types, multi-select and conflicting duplicate questions remain manual',()=>{
 for(const question of [{...data.questions[0],type:'jumble'},{...data.questions[0],choices:[{answer:'4',correct:true},{answer:'5',correct:true}]},{...data.questions[0],choices:[{answer:'4'},{answer:'5'}]}]){
  const quiz=parseKahootQuiz({questions:[question]});assert.equal(quiz.questions[0].supported,false);
 }
 const quiz=parseKahootQuiz({questions:[data.questions[0],{...data.questions[0],choices:[{answer:'3',correct:true},{answer:'4'},{answer:'5'},{answer:'6'}]}]});
 assert.equal(matchKahootAnswer(quiz,'2 + 2?',['3','4','5','6']),null);
 assert.throws(()=>parseKahootQuiz({questions:[]}));
});
test('quiz lookup uses only a public GET with no credentials, and never follows a returned mismatched quiz',async()=>{
 let captured;
 const transport={request:async(...args)=>{captured=args;return {status:200,body:new Response(JSON.stringify(data)).body};}};
 assert.equal((await fetchPublicKahoot(transport,id)).questions.length,1);
 assert.equal(captured[0].href,'https://create.kahoot.it/rest/kahoots/'+id);
 assert.equal(captured[1],'GET');assert.equal(captured[2],null);assert.deepEqual(captured[3],[['Accept','application/json']]);
 await assert.rejects(()=>fetchPublicKahoot({request:async()=>({status:403,body:null})},id),/requires access/);
 await assert.rejects(()=>fetchPublicKahoot({request:async()=>({status:200,body:new Response(JSON.stringify({...data,uuid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})).body})},id),/does not match/);
 await assert.rejects(()=>fetchPublicKahoot({request:()=>assert.fail('bad URL must not reach network')},'https://evil.test'),/Paste/);
});


test('wrapped quiz exports are accepted and a missing prompt cannot arm automatic selection',()=>{
 assert.equal(parseKahootQuiz({kahoot:data}).title,'Math');
 const quiz=parseKahootQuiz({questions:[{...data.questions[0],question:''}]});
 assert.equal(quiz.questions[0].supported,false);
 assert.equal(matchKahootAnswer(quiz,'',['3','4','5','6']),null);
});

test('quiz detection only accepts one explicit public quiz reference, never PINs or unrelated UUIDs',()=>{
 assert.equal(exposedKahootQuizId(['https://kahoot.it/?pin=211004']),null);
 assert.equal(exposedKahootQuizId(['https://kahoot.it/?quizId='+id]),id);
 assert.equal(exposedKahootQuizId(['https://create.kahoot.it/details/'+id]),id);
 assert.equal(exposedKahootQuizId(['https://evil.test/?quizId='+id,'https://kahoot.it/?sessionId='+id]),null);
 assert.equal(exposedKahootQuizId(['https://create.kahoot.it/details/'+id,'https://create.kahoot.it/details/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']),null);
});
test('join details validate the real PIN and nickname without guessing a quiz ID',()=>{
 assert.deepEqual(kahootJoinDetails('211 004',' NeonPlayer '),{pin:'211004',nickname:'NeonPlayer'});
 for(const pin of ['123','abc211004','https://kahoot.it'])assert.throws(()=>kahootJoinDetails(pin,'NeonPlayer'),/PIN/);
 for(const name of ['','abcdefghijklmnop'])assert.throws(()=>kahootJoinDetails('211004',name),/nickname/);
});

test('public quiz discovery reads explicit metadata keys and ignores session identifiers',()=>{
 assert.equal(exposedKahootQuizId(kahootMetadataReferences({props:{pageProps:{quizId:id}}})),id);
 assert.equal(exposedKahootQuizId(kahootMetadataReferences({kahoot:{uuid:id}})),id);
 assert.deepEqual(kahootMetadataReferences({sessionId:id,uuid:id,pin:'211004'}),[]);
 const circular={};circular.self=circular;assert.deepEqual(kahootMetadataReferences(circular),[]);
});
