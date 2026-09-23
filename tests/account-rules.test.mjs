import test from 'node:test';
import assert from 'node:assert/strict';
import {username,loginIdentity,allowedMessage,activity,separateOrigin} from '../accounts/rules.js';
test('username login is case insensitive and rejects invalid identifiers',()=>{
 assert.equal(loginIdentity(' Player_One '),'player_one@accounts.neon.invalid');
 assert.equal(username('Player_One'),'Player_One');
 for(const name of ['ab','a'.repeat(25),'foo@example.com','a<b','a b'])assert.throws(()=>username(name));
});
test('account bridge requires the exact content window and origin',()=>{
 const frame={};const event={source:frame,origin:'https://arcade.example',data:{channel:'neon-members-v1'}};
 assert.ok(allowedMessage(event,frame,'https://arcade.example'));
 assert.ok(!allowedMessage({...event,source:{}},frame,'https://arcade.example'));
 assert.ok(!allowedMessage({...event,origin:'https://evil.example'},frame,'https://arcade.example'));
 assert.ok(!allowedMessage({...event,data:{type:'token'}},frame,'https://arcade.example'));
});
test('activity accepts only bounded game descriptions and explicit stop',()=>{
 assert.equal(activity(null),null);assert.equal(activity({id:'x',name:'a'.repeat(121)}),undefined);
 assert.equal(activity({id:5,name:'x'}),undefined);
 assert.deepEqual(activity({id:'fish',name:'How to Fish',token:'ignored'}),{id:'fish',name:'How to Fish'});
});
test('login must never run on the proxy origin',()=>{
 assert.throws(()=>separateOrigin('https://arcade.example','https://arcade.example'));
 assert.throws(()=>separateOrigin('http://arcade.example','https://accounts.example'));
 assert.equal(separateOrigin('https://arcade.example/#home','https://accounts.example'),'https://arcade.example');
 assert.equal(separateOrigin('http://localhost:3001','http://localhost:3002'),'http://localhost:3001');
});
