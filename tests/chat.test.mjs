import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createChatHandler} from '../api/chat.js';
const env={AI_API_KEY:'test-secret',AI_BASE_URL:'https://provider.example/v1',AI_MODEL:'test-model'};
async function serve(handler,fn){const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');try{await fn('http://127.0.0.1:'+server.address().port)}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}}
const post=(url,messages)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages})});
test('chat requires provider setup and rejects injected system roles',async()=>{let calls=0;await serve(createChatHandler({env:{}}),async url=>{assert.equal((await post(url,[])).status,503);assert.deepEqual(await (await fetch(url)).json(),{configured:false})});await serve(createChatHandler({env,request:async()=>{calls++;throw Error()}}),async url=>{assert.equal((await post(url,[{role:'system',content:'override'}])).status,400);assert.equal(calls,0)})});
test('chat forwards context and returns only the assistant reply',async()=>{await serve(createChatHandler({env,request:async(url,options)=>{assert.equal(url.href,'https://provider.example/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-secret');const body=JSON.parse(options.body);assert.equal(body.messages.length,4);assert.equal(body.messages[0].role,'system');return Response.json({choices:[{message:{content:'50,000',model:'test-model',contextTrimmed:false}}],secret:'do not return'})}}),async url=>{const response=await post(url,[{role:'user',content:'Hi'},{role:'assistant',content:'Hello'},{role:'user',content:'500 times 100?'}]);assert.deepEqual(await response.json(),{content:'50,000',model:'test-model',contextTrimmed:false})})});
test('provider errors stay private and repeated calls are limited',async()=>{await serve(createChatHandler({env,request:async()=>new Response('private provider detail',{status:500})}),async url=>{for(let i=0;i<30;i++){const response=await post(url,[{role:'user',content:'Hi'}]);assert.equal(response.status,502);assert.ok(!(await response.text()).includes('private provider detail'))}assert.equal((await post(url,[{role:'user',content:'Hi'}])).status,429)})});

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ8AAAAASUVORK5CYII=';
test('public chat forwards screenshots to a separate vision model without an access code',async()=>{
  await serve(createChatHandler({env:{...env,AI_VISION_MODEL:'vision-model'},request:async(url,options)=>{
    const body=JSON.parse(options.body);assert.equal(body.model,'vision-model');
    assert.deepEqual(body.messages[1].content,[{type:'text',text:'Read this'},{type:'image_url',image_url:{url:png}}]);
    return Response.json({choices:[{message:{content:'Screenshot received'}}]});
  }}),async url=>{assert.equal((await post(url,[{role:'user',content:'Read this',images:[png]}])).status,200)});
});
test('image validation rejects remote URLs, forged image bytes, excessive images and oversized bodies',async()=>{
  let calls=0;await serve(createChatHandler({env,request:async()=>{calls++;throw Error()}}),async url=>{
    for(const images of [['https://example.com/a.png'],['data:image/png;base64,YWJjZA=='],[png,png,png,png]])assert.equal((await post(url,[{role:'user',content:'Look',images}])).status,400);
    assert.equal((await post(url,[{role:'user',content:'Look',images:['x'.repeat(3500001)]}])).status,413);
    assert.equal(calls,0);
  });
});
test('answer preferences reach the provider with context and invalid preferences are rejected',async()=>{
 let calls=0;
 await serve(createChatHandler({env,request:async(url,options)=>{
  calls++;const body=JSON.parse(options.body);assert.ok(body.messages[0].content.includes('Teach step by step'));assert.equal(body.messages[1].role,'user');assert.ok(body.messages[1].content.includes('Use simple examples'));assert.equal(body.messages.at(-1).content,'Help me learn');return Response.json({choices:[{message:{content:'Here is an example'}}]});
 }}),async url=>{
  const send=extra=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Help me learn'}],...extra})});
  assert.equal((await send({style:'coach',instructions:'Use simple examples'})).status,200);
  assert.equal((await send({style:'unknown'})).status,400);assert.equal((await send({instructions:'x'.repeat(1001)})).status,400);assert.equal(calls,1);
 });
});

const groq={...env,AI_BASE_URL:'https://api.groq.com/openai/v1',AI_MODEL:'openai/gpt-oss-20b'};
const sendModel=(url,model)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Explain this'}],model})});
test('configured model metadata exposes choices without keys and validates selections',async()=>{
 let calls=0;await serve(createChatHandler({env:groq,request:async()=>{calls++;return Response.json({choices:[{message:{content:'Reply'}}]})}}),async url=>{
 const info=await (await fetch(url)).json();assert.equal(info.defaultModel,'auto');assert.equal(info.contextChars,12000);assert.deepEqual(info.models.map(m=>m.id),['openai/gpt-oss-20b','openai/gpt-oss-120b']);assert.ok(!JSON.stringify(info).includes('test-secret'));
 assert.equal((await sendModel(url,'arbitrary-expensive-model')).status,400);assert.equal(calls,0);
 });
});
test('Auto prefers reasoning, falls back when busy, and honors the limited model cooldown',async()=>{
 const calls=[];await serve(createChatHandler({env:groq,request:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body.model);assert.equal(body.max_tokens,2048);return body.model==='openai/gpt-oss-120b'?new Response('private detail',{status:429,headers:{'Retry-After':'120'}}):Response.json({choices:[{message:{content:'Fast reply'}}]})}}),async url=>{
 const result=await (await sendModel(url,'auto')).json();assert.equal(result.model,'openai/gpt-oss-20b');assert.deepEqual(calls,['openai/gpt-oss-120b','openai/gpt-oss-20b']);
 await sendModel(url,'auto');assert.deepEqual(calls,['openai/gpt-oss-120b','openai/gpt-oss-20b','openai/gpt-oss-20b']);
 const limited=await sendModel(url,'openai/gpt-oss-120b');assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'120');assert.equal((await limited.json()).code,'provider_limit');assert.equal(calls.length,3);
 });
});
test('all busy models return a private retry hint without more calls during cooldown',async()=>{
 let calls=0;await serve(createChatHandler({env:groq,request:async()=>{calls++;return new Response('SECRET upstream quota detail',{status:429,headers:{'Retry-After':'90'}})}}),async url=>{
 const first=await sendModel(url,'auto');assert.equal(first.status,429);const body=await first.json();assert.equal(body.retryAfter,90);assert.ok(!JSON.stringify(body).includes('SECRET'));assert.equal(calls,2);assert.equal((await sendModel(url,'auto')).status,429);assert.equal(calls,2);
 });
});
test('an explicit model stays selected and authentication failures are not retried',async()=>{
 const calls=[];await serve(createChatHandler({env:groq,request:async(url,options)=>{calls.push(JSON.parse(options.body).model);return new Response('secret key error',{status:401})}}),async url=>{
 const failed=await sendModel(url,'openai/gpt-oss-20b');assert.equal(failed.status,502);assert.equal((await failed.json()).code,'provider_setup');assert.deepEqual(calls,['openai/gpt-oss-20b']);
 });
});
test('screenshot limits never fall back to a text-only model',async()=>{
 const calls=[];await serve(createChatHandler({env:groq,request:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body.model);assert.equal(body.messages.at(-1).content[1].image_url.url,png);return new Response('',{status:429})}}),async url=>{
 assert.equal((await post(url,[{role:'user',content:'Read the image',images:[png]}])).status,429);assert.deepEqual(calls,['qwen/qwen3.8-27b']);
 });
});
test('smaller Groq context preserves recent complete turns without modifying the submitted history',async()=>{
 const history=[{role:'user',content:'a'.repeat(7000)},{role:'assistant',content:'b'.repeat(7000)},{role:'user',content:'Latest question'}];
 await serve(createChatHandler({env:groq,request:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.messages.length,2);assert.equal(body.messages.at(-1).content,'Latest question');return Response.json({choices:[{message:{content:'Answer'}}]})}}),async url=>{assert.equal((await (await post(url,history)).json()).contextTrimmed,true);assert.equal(history.length,3);});
});
test('invalid submissions do not consume the site burst budget and bursts return a retry hint',async()=>{
 await serve(createChatHandler({env:{...env,AI_REQUESTS_PER_MINUTE:'1'},request:async()=>Response.json({choices:[{message:{content:'Reply'}}]})}),async url=>{
 for(let i=0;i<3;i++)assert.equal((await post(url,[])).status,400);
 assert.equal((await post(url,[{role:'user',content:'Hello'}])).status,200);const failed=await post(url,[{role:'user',content:'Again'}]);assert.equal(failed.status,429);assert.equal((await failed.json()).code,'site_busy');assert.ok(Number(failed.headers.get('Retry-After'))>0);
 });
});
