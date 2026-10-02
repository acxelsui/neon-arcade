import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '../remote-relay/node_modules/@electric-sql/pglite/dist/index.js';
test('remote SQL migration enforces real PostgreSQL permissions, MFA, revocation and durable audit',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create table public.neon_profiles(id uuid primary key references auth.users,username text,chat_role text,site_banned boolean default false,chat_banned boolean default false,chat_muted_until timestamptz);
 create table public.player_data(id text primary key,value jsonb);
 insert into public.player_data values('playlist','{"songs":["1","2"]}'),('movies','{"continueWatching":["saved"]}');
 create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb; $$;
 create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
 grant usage on schema public to anon,authenticated;
 `);
 const toolkit=await readFile(new URL('../supabase/owner-toolkit.sql',import.meta.url),'utf8');
 await db.exec(toolkit.match(/create or replace function public\.neon_owner_access\(\)[\s\S]*?end; \$\$;/)[0]);
 const migration=await readFile(new URL('../supabase/owner-remote-relay.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 const owner=randomUUID(),member=randomUUID(),admin=randomUUID(),authSession=randomUUID();
 for(const [id,name,role] of [[owner,'Owner','owner'],[member,'Player','member'],[admin,'Admin','admin']]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.neon_profiles(id,username,chat_role) values($1,$2,$3)',[id,name,role]);}
 await db.query('insert into auth.sessions values($1,$2)',[authSession,owner]);
 async function auth(id,aal='aal2',exp=Math.floor(Date.now()/1000)+3600){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal,exp,session_id:authSession})]);await db.exec('set role authenticated');}
 async function rpc(operation,args={}){const result=await db.query('select public.neon_remote_owner($1,$2,$3,$4) as data',[operation,args.device_id??null,args.label??'',args.session_id??null]);return result.rows[0].data;}
 async function device(id,key,state='check'){await db.exec('set role anon');return (await db.query('select public.neon_remote_device($1,$2,$3) as data',[id,key,state])).rows[0].data;}
 async function session(key,operation='check',detail=''){await db.exec('set role anon');return (await db.query('select public.neon_remote_session($1,$2,$3) as data',[key,operation,detail])).rows[0].data;}
 for(const id of [member,admin]){await auth(id);await assert.rejects(rpc('devices'),/Owner access required/);await assert.rejects(rpc('register',{label:'Not allowed'}),/Owner access required/);}
 await auth(owner,'aal1');await assert.rejects(rpc('devices'),/authenticator/);
 await auth(owner);const registered=await rpc('register',{label:'My PC'});assert.match(registered.secret,/^[a-f0-9]{64}$/);
 await assert.rejects(db.query('select * from public.neon_remote_devices'),/permission denied/);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.neon_remote_logs'),/permission denied/);await assert.rejects(db.query("select public.neon_remote_owner('devices')"),/permission denied/);await assert.rejects(db.query('select public.neon_remote_expire()'),/permission denied/);
 assert.equal(await device(registered.id,'a'.repeat(64),'online'),false);assert.equal(await device(registered.id,registered.secret,'online'),true);
 await auth(owner);let start=await rpc('start',{device_id:registered.id});assert.equal(start.device_id,registered.id);assert.ok(Date.parse(start.expires_at)-Date.now()<=600000);assert.notEqual(start.secret,registered.secret);
 assert.equal(await session(registered.secret),null);assert.equal((await session(start.secret)).device_id,registered.id);assert.ok(await session(start.secret,'action','stream-opened'));assert.equal(await session(start.secret,'action','run-shell'),null);
 await auth(owner);await assert.rejects(rpc('start',{device_id:registered.id}),/active session/);await rpc('stop',{session_id:start.id});assert.equal(await session(start.secret),null);
 await auth(owner);start=await rpc('start',{device_id:registered.id});await db.exec('reset role');await db.query("update public.neon_profiles set chat_role='admin' where id=$1",[owner]);assert.equal(await session(start.secret),null);
 await db.exec('reset role');await db.query("update public.neon_profiles set chat_role='owner' where id=$1",[owner]);await auth(owner);start=await rpc('start',{device_id:registered.id});await db.exec('reset role');await db.query('update public.neon_profiles set site_banned=true where id=$1',[owner]);assert.equal(await session(start.secret),null);
 await db.exec('reset role');await db.query('update public.neon_profiles set site_banned=false where id=$1',[owner]);await auth(owner);start=await rpc('start',{device_id:registered.id});await rpc('revoke',{device_id:registered.id});assert.equal(await session(start.secret),null);assert.equal(await device(registered.id,registered.secret),false);
 await auth(owner);const second=await rpc('register',{label:'Another PC'});assert.equal(await device(second.id,second.secret,'online'),true);await auth(owner,'aal2',Math.floor(Date.now()/1000)+45);start=await rpc('start',{device_id:second.id});assert.ok(Date.parse(start.expires_at)-Date.now()<45000);
 await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[authSession]);assert.equal(await session(start.secret),null);
 await db.exec('reset role');await db.query('insert into auth.sessions values($1,$2)',[authSession,owner]);await auth(owner);start=await rpc('start',{device_id:second.id});await db.exec('reset role');await db.query("update public.neon_remote_sessions set expires_at=clock_timestamp()-interval '1 second' where id=$1",[start.id]);
 await device(second.id,second.secret,'online');await auth(owner);const logs=await rpc('logs');assert.ok(logs.some(row=>row.action==='session-ended'&&row.detail==='expired'));assert.ok(logs.some(row=>row.action==='device-revoked'));assert.ok(logs.some(row=>row.action==='stream-opened'));assert.ok(logs.every(row=>!JSON.stringify(row).includes(start.secret)));
 await db.exec('reset role');const data=await db.query('select * from public.player_data order by id');assert.deepEqual(data.rows,[{id:'movies',value:{continueWatching:['saved']}},{id:'playlist',value:{songs:['1','2']}}]);
});
