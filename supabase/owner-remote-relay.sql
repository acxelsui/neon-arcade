-- Additive migration. Existing profiles, roles, bans and player data are unchanged.
begin;
create table if not exists public.neon_remote_devices(
 id uuid primary key default gen_random_uuid(), label text not null check(char_length(label) between 1 and 60),
 credential_hash bytea not null, registered_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(), last_seen timestamptz,
 online boolean not null default false, revoked_at timestamptz
);
create table if not exists public.neon_remote_sessions(
 id uuid primary key default gen_random_uuid(), device_id uuid not null references public.neon_remote_devices(id),
 owner_id uuid references auth.users(id) on delete set null, owner_name text not null,
 auth_session uuid not null, credential_hash bytea not null unique,
 started_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 ended_at timestamptz, end_reason text
);
create table if not exists public.neon_remote_logs(
 id bigint generated always as identity primary key, actor uuid references auth.users(id) on delete set null,
 actor_name text, device_id uuid references public.neon_remote_devices(id),
 session_id uuid references public.neon_remote_sessions(id), action text not null,
 detail text not null default '', created_at timestamptz not null default clock_timestamp()
);
create index if not exists neon_remote_logs_date on public.neon_remote_logs(created_at desc);
create index if not exists neon_remote_sessions_device on public.neon_remote_sessions(device_id,expires_at);
alter table public.neon_remote_devices enable row level security;
alter table public.neon_remote_sessions enable row level security;
alter table public.neon_remote_logs enable row level security;
revoke all on public.neon_remote_devices,public.neon_remote_sessions,public.neon_remote_logs from public,anon,authenticated;
revoke all on sequence public.neon_remote_logs_id_seq from public,anon,authenticated;

-- Recover expiration audit records after a relay crash or interrupted connection.
create or replace function public.neon_remote_expire() returns void
language sql security definer set search_path='' as $$
 with ended as(update public.neon_remote_sessions set ended_at=clock_timestamp(),end_reason='expired' where ended_at is null and expires_at<=clock_timestamp() returning *)
 insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action,detail) select e.owner_id,e.owner_name,e.device_id,e.id,'session-ended','expired' from ended e;
$$;
revoke all on function public.neon_remote_expire() from public,anon,authenticated;

create or replace function public.neon_remote_owner(operation text, device_id uuid default null, label text default '', session_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare secret text; result jsonb; sid uuid; name text; until_time timestamptz;
begin
 perform public.neon_owner_access();
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'Verify your authenticator before using remote access';end if;
 select username into name from public.neon_profiles where id=auth.uid();
 -- Serialize lifecycle changes, including simultaneous session requests.
 perform pg_catalog.pg_advisory_xact_lock(927614);
 perform public.neon_remote_expire();
 if operation='devices' then
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'label',d.label,'online',d.online and d.last_seen>clock_timestamp()-interval '45 seconds','last_seen',d.last_seen,'revoked_at',d.revoked_at) order by d.created_at desc),'[]') into result from public.neon_remote_devices d;
 elsif operation='register' then
  if label is null or char_length(btrim(label)) not between 1 and 60 then raise exception 'Choose a device name under 60 characters';end if;
  if (select count(*) from public.neon_remote_devices where revoked_at is null)>=10 then raise exception 'Revoke an old device before registering another';end if;
  secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into public.neon_remote_devices(label,credential_hash,registered_by) values(btrim(label),sha256(decode(secret,'hex')),auth.uid()) returning id into sid;
  insert into public.neon_remote_logs(actor,actor_name,device_id,action) values(auth.uid(),name,sid,'device-registered');
  result:=jsonb_build_object('id',sid,'secret',secret);
 elsif operation='revoke' then
  update public.neon_remote_devices set revoked_at=clock_timestamp(),online=false where id=device_id and revoked_at is null;
  if not found then raise exception 'Active device not found';end if;
  with ended as(update public.neon_remote_sessions set ended_at=clock_timestamp(),end_reason='device-revoked' where neon_remote_sessions.device_id=neon_remote_owner.device_id and ended_at is null returning *)
  insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action,detail) select auth.uid(),name,e.device_id,e.id,'session-ended','device-revoked' from ended e;
  insert into public.neon_remote_logs(actor,actor_name,device_id,action) values(auth.uid(),name,device_id,'device-revoked');
  result:='{}';
 elsif operation='start' then
  if not exists(select 1 from public.neon_remote_devices d where d.id=device_id and d.revoked_at is null and d.online and d.last_seen>clock_timestamp()-interval '45 seconds') then raise exception 'Your PC is offline';end if;
  if (select count(*) from public.neon_remote_logs where actor=auth.uid() and action='session-started' and created_at>clock_timestamp()-interval '1 minute')>=6 then raise exception 'Wait a minute before starting another session';end if;
  if exists(select 1 from public.neon_remote_sessions s where s.device_id=neon_remote_owner.device_id and s.ended_at is null and s.expires_at>clock_timestamp()) then raise exception 'End the active session for this PC first';end if;
  until_time:=least(clock_timestamp()+interval '10 minutes',to_timestamp((auth.jwt()->>'exp')::double precision));
  if until_time<clock_timestamp()+interval '30 seconds' then raise exception 'Refresh your sign-in and try again';end if;
  secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into public.neon_remote_sessions(device_id,owner_id,owner_name,auth_session,credential_hash,expires_at) values(device_id,auth.uid(),name,(auth.jwt()->>'session_id')::uuid,sha256(decode(secret,'hex')),until_time) returning id into sid;
  insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action) values(auth.uid(),name,device_id,sid,'session-started');
  result:=jsonb_build_object('id',sid,'secret',secret,'device_id',device_id,'expires_at',until_time);
 elsif operation='stop' then
  with ended as(update public.neon_remote_sessions set ended_at=clock_timestamp(),end_reason='owner-ended' where id=session_id and ended_at is null returning *)
  insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action,detail) select auth.uid(),name,e.device_id,e.id,'session-ended','owner-ended' from ended e;
  result:='{}';
 elsif operation='sessions' then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'device_id',s.device_id,'owner_name',s.owner_name,'started_at',s.started_at,'expires_at',s.expires_at) order by s.started_at desc),'[]') into result from public.neon_remote_sessions s where ended_at is null and expires_at>clock_timestamp();
 elsif operation='logs' then
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id desc),'[]') into result from (select a.id,a.actor_name,a.device_id,a.session_id,a.action,a.detail,a.created_at from public.neon_remote_logs a order by a.id desc limit 100) l;
 else raise exception 'Unknown remote action';end if;
 return result;
end; $$;

-- Device credentials cannot access profiles or issue owner sessions.
create or replace function public.neon_remote_device(device_id uuid, secret text, state text default 'check')
returns boolean language plpgsql security definer set search_path='' as $$
declare d public.neon_remote_devices;
begin
 if secret is null or secret !~ '^[a-f0-9]{64}$' or state not in ('check','online','offline') then return false;end if;
 select * into d from public.neon_remote_devices where id=device_id and credential_hash=sha256(decode(secret,'hex')) and revoked_at is null for update;
 if d.id is null then return false;end if;
 if state<>'check' then
  perform public.neon_remote_expire();
  if d.online<>(state='online') then insert into public.neon_remote_logs(device_id,action) values(d.id,'device-'||state);end if;
  update public.neon_remote_devices set online=(state='online'),last_seen=clock_timestamp() where id=d.id;
 end if;
 return true;
end; $$;

-- Anonymous transport capabilities are random 256-bit secrets, stored only as hashes.
create or replace function public.neon_remote_session(secret text, operation text default 'check', detail text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.neon_remote_sessions; valid boolean;
begin
 if secret is null or secret !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into s from public.neon_remote_sessions where credential_hash=sha256(decode(secret,'hex')) for update;
 if s.id is null then return null;end if;
 valid:=s.ended_at is null and s.expires_at>clock_timestamp()
 and exists(select 1 from public.neon_profiles p where p.id=s.owner_id and p.chat_role='owner' and not p.site_banned and not p.chat_banned and (p.chat_muted_until is null or p.chat_muted_until<=clock_timestamp()))
 and exists(select 1 from auth.sessions a where a.id=s.auth_session)
 and exists(select 1 from public.neon_remote_devices d where d.id=s.device_id and d.revoked_at is null);
 if operation='end' then
  if detail not in ('closed','expired','revoked','device-offline','relay-restarted','launch-failed') then return null;end if;
 elsif not valid then
  if s.ended_at is null then
   update public.neon_remote_sessions set ended_at=clock_timestamp(),end_reason='expired-or-revoked' where id=s.id;
   insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action,detail) values(s.owner_id,s.owner_name,s.device_id,s.id,'session-ended','expired-or-revoked');
  end if;
  return null;
 elsif operation not in ('check','action') then return null;end if;
 if operation='end' and s.ended_at is null then
  update public.neon_remote_sessions set ended_at=clock_timestamp(),end_reason=detail where id=s.id;
  insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action,detail) values(s.owner_id,s.owner_name,s.device_id,s.id,'session-ended',detail);
 elsif operation='action' then
  if detail not in ('desktop-request','stream-opened','session-opened') then return null;end if;
  insert into public.neon_remote_logs(actor,actor_name,device_id,session_id,action) values(s.owner_id,s.owner_name,s.device_id,s.id,detail);
 end if;
 return jsonb_build_object('id',s.id,'device_id',s.device_id,'expires_at',s.expires_at);
end; $$;
revoke all on function public.neon_remote_owner(text,uuid,text,uuid),public.neon_remote_device(uuid,text,text),public.neon_remote_session(text,text,text) from public,anon,authenticated;
grant execute on function public.neon_remote_owner(text,uuid,text,uuid) to authenticated;
grant execute on function public.neon_remote_device(uuid,text,text),public.neon_remote_session(text,text,text) to anon;
commit;
