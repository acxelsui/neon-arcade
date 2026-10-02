-- Run after setup.sql, chat.sql, access.sql and social.sql. Safe to re-run.
-- Preserves accounts, playlists and messages. Existing chat bans stay chat bans.
begin;
alter table public.neon_profiles add column if not exists site_banned boolean not null default false;
alter table public.neon_profiles add column if not exists site_ban_reason text not null default '' check(char_length(site_ban_reason)<=240);
alter table public.neon_profiles add column if not exists site_banned_at timestamptz;

create or replace function public.neon_site_status()
returns table(banned boolean,reason text) language sql stable security definer set search_path='' as $$
 select p.site_banned,p.site_ban_reason from public.neon_profiles p where p.id=auth.uid();
$$;
create or replace function public.neon_owner_access() returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.neon_profiles where id=auth.uid() and chat_role='owner' and not site_banned and not chat_banned and (chat_muted_until is null or chat_muted_until<=clock_timestamp())) then raise exception 'Owner access required';end if;
end; $$;
create or replace function public.neon_owner_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.neon_owner_access();
 return (select jsonb_build_object('players',count(*),'banned',count(*) filter(where site_banned),'muted',count(*) filter(where chat_muted_until>now()),'staff',count(*) filter(where chat_role in ('owner','admin'))) from public.neon_profiles);
end; $$;
create or replace function public.neon_owner_players(query text default '',category text default 'all',page_offset integer default 0)
returns table(id uuid,username text,role text,muted_until timestamptz,chat_banned boolean,site_banned boolean,ban_reason text,banned_at timestamptz,joined timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.neon_owner_access();
 if query is null or char_length(query)>24 or category is null or category not in ('all','banned','muted','staff') or page_offset is null or page_offset not between 0 and 100000 then raise exception 'Invalid player filter';end if;
 return query select p.id,p.username,p.chat_role,p.chat_muted_until,p.chat_banned,p.site_banned,p.site_ban_reason,p.site_banned_at,p.created_at
 from public.neon_profiles p where position(lower(query) in lower(p.username))>0
 and (category='all' or (category='banned' and p.site_banned) or (category='muted' and p.chat_muted_until>now()) or (category='staff' and p.chat_role in ('owner','admin')))
 order by lower(p.username),p.id limit 25 offset page_offset;
end; $$;
create or replace function public.neon_owner_action(target_id uuid,operation text,value text default '',reason text default '')
returns void language plpgsql security definer set search_path='' as $$
declare other public.neon_profiles;
begin
 -- Use the same lock as chat moderation, including owner grants.
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 perform public.neon_owner_access();
 select * into other from public.neon_profiles where id=target_id for update;
 if other.id is null then raise exception 'Player not found';end if;
 if other.id=auth.uid() or other.chat_role='owner' then raise exception 'Owner accounts are protected';end if;
 if reason is null or char_length(reason)>240 then raise exception 'Keep the reason under 240 characters';end if;
 if operation='site-ban' then
  if char_length(btrim(reason))=0 then raise exception 'Add a ban reason';end if;
  update public.neon_profiles set site_banned=true,site_ban_reason=btrim(reason),site_banned_at=clock_timestamp() where id=target_id;
  delete from public.neon_access_passes where user_id=target_id;
  delete from public.neon_sessions where user_id=target_id;
 elsif operation='site-unban' then
  update public.neon_profiles set site_banned=false,site_ban_reason='',site_banned_at=null where id=target_id;
 elsif operation in ('role','mute','unmute','ban','unban') then
  perform public.neon_chat_moderate(target_id,operation,value);
  return;
 else raise exception 'Unknown owner action';end if;
 insert into public.neon_chat_audit(actor,target,action,detail) values(auth.uid(),target_id,operation,btrim(reason));
end; $$;
create or replace function public.neon_owner_audit()
returns table(id text,actor text,target text,action text,detail text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.neon_owner_access();
 return query select a.id::text,p.username,t.username,a.action,a.detail,a.created_at from public.neon_chat_audit a
 left join public.neon_profiles p on p.id=a.actor left join public.neon_profiles t on t.id=a.target order by a.id desc limit 100;
end; $$;
create or replace function public.neon_owner_announce(message text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 perform public.neon_owner_access();perform public.neon_chat_announce(message);
end; $$;

-- Site access remains server-checked, even if someone changes the page UI.
create or replace function public.neon_issue_access()
returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 -- Serialize issuing passes against a site ban on this account.
 perform 1 from public.neon_profiles where id=auth.uid() and not site_banned for update;
 if not found then raise exception 'Your account cannot access Neon Arcade';end if;
 delete from public.neon_access_passes where user_id=auth.uid() and expires_at<now();
 if (select count(*) from public.neon_access_passes where user_id=auth.uid())>=50 then raise exception 'Too many arcade sessions. Sign out of older sessions or try again later';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.neon_access_passes values(sha256(decode(token,'hex')),auth.uid(),now()+interval '8 hours');return token;
end; $$;
create or replace function public.neon_check_access(pass text)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if pass is null or pass !~ '^[a-f0-9]{64}$' then return false;end if;
 return exists(select 1 from public.neon_access_passes a join public.neon_profiles p on p.id=a.user_id where a.token_hash=sha256(decode(pass,'hex')) and a.expires_at>now() and not p.site_banned);
end; $$;
create or replace function public.neon_social_access() returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.neon_profiles where id=auth.uid() and not chat_banned and not site_banned) then raise exception 'Sign in with an active account';end if;
end; $$;
create or replace function public.neon_chat_can_read() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.neon_profiles where id=auth.uid() and not chat_banned and not site_banned);
$$;

-- Block direct writes from site-banned accounts across existing member RPCs.
-- SECURITY DEFINER RPCs still run these triggers with the authenticated auth.uid().
create or replace function public.neon_active_writer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.neon_profiles where id=auth.uid() and site_banned) then raise exception 'Your account is banned from Neon Arcade';end if;
 if tg_op='DELETE' then return old;end if;return new;
end; $$;
drop trigger if exists neon_active_writer on public.neon_messages;
create trigger neon_active_writer before insert or update or delete on public.neon_messages for each row execute function public.neon_active_writer();
drop trigger if exists neon_active_writer on public.neon_sessions;
create trigger neon_active_writer before insert or update on public.neon_sessions for each row execute function public.neon_active_writer();
drop trigger if exists neon_active_writer on public.neon_profiles;
create trigger neon_active_writer before update on public.neon_profiles for each row execute function public.neon_active_writer();

revoke all on function public.neon_owner_access(),public.neon_owner_overview(),public.neon_owner_players(text,text,integer),public.neon_owner_action(uuid,text,text,text),public.neon_owner_audit(),public.neon_owner_announce(text),public.neon_site_status(),public.neon_active_writer() from public,anon,authenticated;
grant execute on function public.neon_owner_overview(),public.neon_owner_players(text,text,integer),public.neon_owner_action(uuid,text,text,text),public.neon_owner_audit(),public.neon_owner_announce(text),public.neon_site_status() to authenticated;
commit;
