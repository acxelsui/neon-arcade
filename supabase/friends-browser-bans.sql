-- Run AFTER owner-toolkit.sql and social.sql. Preserves profiles, chat and playlists.
-- The Before User Created hook must also be enabled as described in FRIENDS-BANS.md.
begin;
create table if not exists public.neon_browser_devices(
 device_hash bytea not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(device_hash,user_id)
);
create index if not exists neon_browser_user on public.neon_browser_devices(user_id);
alter table public.neon_browser_devices enable row level security;
revoke all on public.neon_browser_devices from public,anon,authenticated;
alter table public.neon_access_passes add column if not exists device_hash bytea;

create or replace function public.neon_browser_blocked(hash_value bytea) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.neon_browser_devices d join public.neon_profiles p on p.id=d.user_id where d.device_hash=hash_value and p.site_banned);
$$;
create or replace function public.neon_user_browser_blocked(player uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.neon_profiles where id=player and chat_role='owner' and not site_banned)
 and exists(select 1 from public.neon_browser_devices d where d.user_id=player and public.neon_browser_blocked(d.device_hash));
$$;
create or replace function public.neon_device_status(device_key text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if device_key is null or device_key!~'^[a-f0-9]{64}$' then raise exception 'Invalid browser identity';end if;
 return public.neon_browser_blocked(sha256(decode(device_key,'hex')));
end; $$;
create or replace function public.neon_bind_device(device_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare hash_value bytea;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if device_key is null or device_key!~'^[a-f0-9]{64}$' then raise exception 'Invalid browser identity';end if;
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 hash_value:=sha256(decode(device_key,'hex'));
 -- An existing owner can sign in to restore access on a shared browser.
 if exists(select 1 from public.neon_profiles where id=auth.uid() and chat_role='owner' and not site_banned) then return false;end if;
 if not exists(select 1 from public.neon_browser_devices where user_id=auth.uid() and device_hash=hash_value)
 and (select count(*) from public.neon_browser_devices where user_id=auth.uid())>=50 then raise exception 'Too many browser identities for this account';end if;
 insert into public.neon_browser_devices(device_hash,user_id)values(hash_value,auth.uid())on conflict do nothing;
 return public.neon_browser_blocked(hash_value);
end; $$;
create or replace function public.neon_browser_access_status(device_key text)
returns table(banned boolean,reason text) language plpgsql stable security definer set search_path='' as $$
begin
 if device_key is null or device_key!~'^[a-f0-9]{64}$' then raise exception 'Invalid browser identity';end if;
 return query select p.site_banned or (p.chat_role<>'owner' and public.neon_device_status(device_key)),
 case when p.site_banned then p.site_ban_reason else 'This browser is blocked until an owner unbans the account.' end
 from public.neon_profiles p where p.id=auth.uid();
end; $$;
create or replace function public.neon_site_status()
returns table(banned boolean,reason text) language sql stable security definer set search_path='' as $$
 select p.site_banned or public.neon_user_browser_blocked(p.id),
 case when p.site_banned then p.site_ban_reason else 'This browser is blocked until an owner unbans the account.' end
 from public.neon_profiles p where p.id=auth.uid();
$$;

-- New clients request a pass bound to the current browser. Bans remain server checked.
create or replace function public.neon_issue_device_access(device_key text) returns text
language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if public.neon_bind_device(device_key) then raise exception 'This browser is banned until an owner unbans the account';end if;
 perform 1 from public.neon_profiles where id=auth.uid() and not site_banned for update;
 if not found then raise exception 'Your account cannot access Neon Arcade';end if;
 delete from public.neon_access_passes where user_id=auth.uid() and expires_at<now();
 if (select count(*) from public.neon_access_passes where user_id=auth.uid())>=50 then raise exception 'Too many arcade sessions';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.neon_access_passes(token_hash,user_id,expires_at,device_hash)
 values(sha256(decode(token,'hex')),auth.uid(),now()+interval '8 hours',sha256(decode(device_key,'hex')));return token;
end; $$;
-- Keep older signed-in tabs compatible while preventing linked accounts using the old RPC.
create or replace function public.neon_issue_access() returns text
language plpgsql security definer set search_path='' as $$
declare token text;
begin
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 perform 1 from public.neon_profiles where id=auth.uid() and not site_banned for update;
 if not found or public.neon_user_browser_blocked(auth.uid()) then raise exception 'Your account cannot access Neon Arcade';end if;
 delete from public.neon_access_passes where user_id=auth.uid() and expires_at<now();
 if (select count(*) from public.neon_access_passes where user_id=auth.uid())>=50 then raise exception 'Too many arcade sessions';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.neon_access_passes(token_hash,user_id,expires_at)values(sha256(decode(token,'hex')),auth.uid(),now()+interval '8 hours');return token;
end; $$;
create or replace function public.neon_check_access(pass text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if pass is null or pass!~'^[a-f0-9]{64}$' then return false;end if;
 return exists(select 1 from public.neon_access_passes a join public.neon_profiles p on p.id=a.user_id
 where a.token_hash=sha256(decode(pass,'hex')) and a.expires_at>now() and not p.site_banned
 and (p.chat_role='owner' or case when a.device_hash is null then not public.neon_user_browser_blocked(p.id) else not public.neon_browser_blocked(a.device_hash) end));
end; $$;
create or replace function public.neon_create_profile(chosen_username text) returns void
language plpgsql security definer set search_path='' as $$
declare device_key text;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if chosen_username is null or chosen_username!~'^[a-zA-Z0-9_]{3,24}$' then raise exception 'Use 3-24 letters, numbers, or underscores';end if;
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 select u.raw_user_meta_data->>'neon_device_key' into device_key from auth.users u where u.id=auth.uid();
 if device_key is not null and public.neon_device_status(device_key) then raise exception 'This browser is banned until an owner unbans the account';end if;
 if public.neon_user_browser_blocked(auth.uid()) then raise exception 'This browser is banned until an owner unbans the account';end if;
 insert into public.neon_profiles(id,username)values(auth.uid(),chosen_username);
 if device_key is not null then perform public.neon_bind_device(device_key);end if;
end; $$;

-- Select this function for Authentication > Hooks > Before User Created.
-- Only Supabase Auth can call it. A client cannot use an RPC to change ban decisions.
create or replace function public.neon_signup_guard(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare device_key text;
begin
 device_key:=event->'user'->'user_metadata'->>'neon_device_key';
 if device_key is null or device_key!~'^[a-f0-9]{64}$' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Open Neon Arcade and try creating your account again.'));
 end if;
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 if public.neon_device_status(device_key) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','This browser is banned until an owner unbans the account.'));
 end if;
 return '{}'::jsonb;
end; $$;

create or replace function public.neon_friend_requests()
returns table(id text,sender_id uuid,username text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.neon_social_access();
 return query select md5(f.low_id::text||f.high_id::text||f.created_at::text),f.requester,p.username,f.created_at
 from public.neon_friends f join public.neon_profiles p on p.id=f.requester
 where f.status='pending' and f.requester<>auth.uid() and auth.uid() in (f.low_id,f.high_id)
 and not p.chat_banned and not p.site_banned order by f.created_at limit 200;
end; $$;
revoke all on function public.neon_browser_blocked(bytea),public.neon_user_browser_blocked(uuid),public.neon_device_status(text),public.neon_bind_device(text),public.neon_browser_access_status(text),public.neon_issue_device_access(text),public.neon_signup_guard(jsonb),public.neon_friend_requests() from public,anon,authenticated;
grant execute on function public.neon_device_status(text) to anon,authenticated;
grant execute on function public.neon_bind_device(text),public.neon_browser_access_status(text),public.neon_issue_device_access(text),public.neon_friend_requests() to authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.neon_signup_guard(jsonb) to supabase_auth_admin;
commit;
