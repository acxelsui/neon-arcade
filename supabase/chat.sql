begin;
create table if not exists public.neon_messages (
 id bigint generated always as identity primary key,
 sender_id uuid not null references public.neon_profiles(id) on delete cascade,
 recipient_id uuid references public.neon_profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 1000),
 created_at timestamptz not null default now(),
 check(recipient_id is null or recipient_id<>sender_id)
);
create index if not exists neon_messages_room on public.neon_messages(recipient_id,id desc);
create index if not exists neon_messages_sender on public.neon_messages(sender_id,id desc);
alter table public.neon_messages enable row level security;
revoke all on public.neon_messages from public,anon,authenticated;

create or replace function public.neon_chat_send(message text,peer uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if message is null or char_length(btrim(message)) not between 1 and 1000 then raise exception 'Use 1-1000 characters'; end if;
 if peer=auth.uid() then raise exception 'Choose another player'; end if;
 if peer is not null and not exists(select 1 from public.neon_profiles where id=peer) then raise exception 'Player not found'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.neon_messages where sender_id=auth.uid() and created_at>clock_timestamp()-interval '3 seconds') then raise exception 'Wait a few seconds before sending again'; end if;
 insert into public.neon_messages(sender_id,recipient_id,body) values(auth.uid(),peer,btrim(message));
end; $$;
create or replace function public.neon_chat_players(query text)
returns table(id uuid,username text) language sql stable security definer set search_path='' as $$
 select p.id,p.username from public.neon_profiles p
 where auth.uid() is not null and p.id<>auth.uid() and char_length(query) between 2 and 24
 and position(lower(query) in lower(p.username))>0 order by lower(p.username) limit 15;
$$;
create or replace function public.neon_chat_conversations()
returns table(id uuid,username text,updated_at timestamptz) language sql stable security definer set search_path='' as $$
 select p.id,p.username,max(m.created_at) as updated_at from public.neon_messages m
 join public.neon_profiles p on p.id=case when m.sender_id=auth.uid() then m.recipient_id else m.sender_id end
 where auth.uid() is not null and m.recipient_id is not null and (m.sender_id=auth.uid() or m.recipient_id=auth.uid())
 group by p.id,p.username order by updated_at desc limit 50;
$$;
create or replace function public.neon_chat_delete(message_id bigint)
returns void language sql security definer set search_path='' as $$
 delete from public.neon_messages where id=message_id and sender_id=auth.uid();
$$;
revoke all on function public.neon_chat_send(text,uuid),public.neon_chat_players(text),public.neon_chat_conversations(),public.neon_chat_delete(bigint) from public,anon;
grant execute on function public.neon_chat_send(text,uuid),public.neon_chat_players(text),public.neon_chat_conversations(),public.neon_chat_delete(bigint) to authenticated;
-- Roles and moderation stay server-owned. These assignments use existing accounts only.
alter table public.neon_profiles add column if not exists chat_role text not null default 'member' check(chat_role in ('owner','admin','vip','member'));
alter table public.neon_profiles add column if not exists chat_muted_until timestamptz;
alter table public.neon_profiles add column if not exists chat_banned boolean not null default false;
alter table public.neon_profiles add column if not exists chat_last_sent timestamptz;
alter table public.neon_messages add column if not exists announcement boolean not null default false;
do $$ begin if not exists(select 1 from public.neon_profiles where lower(username)='acxel67') or not exists(select 1 from public.neon_profiles where lower(username)='acxel') then raise exception 'Create the acxel67 and acxel accounts before running chat.sql'; end if; end $$;
update public.neon_profiles set chat_role='owner' where lower(username)='acxel67';
update public.neon_profiles set chat_role='admin' where lower(username)='acxel';

create table if not exists public.neon_chat_audit (
 id bigint generated always as identity primary key,
 actor uuid references public.neon_profiles(id),target uuid references public.neon_profiles(id),
 action text not null,detail text,created_at timestamptz not null default now()
);
alter table public.neon_chat_audit enable row level security;
revoke all on public.neon_chat_audit from public,anon,authenticated;
create or replace function public.neon_chat_self()
returns table(id uuid,username text,role text,muted_until timestamptz,banned boolean)
language sql stable security definer set search_path='' as $$
 select id,username,chat_role,chat_muted_until,chat_banned from public.neon_profiles where id=auth.uid();
$$;
create or replace function public.neon_chat_can_read()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.neon_profiles where id=auth.uid() and not chat_banned);
$$;
-- Drop only the function signature to extend the result; message history is preserved.
drop function if exists public.neon_chat_history(uuid);
create function public.neon_chat_history(peer uuid default null)
returns table(id text,sender_id uuid,username text,body text,created_at timestamptz,role text,announcement boolean)
language sql stable security definer set search_path='' as $$
 select m.id::text,m.sender_id,p.username,m.body,m.created_at,p.chat_role,m.announcement
 from public.neon_messages m join public.neon_profiles p on p.id=m.sender_id
 where public.neon_chat_can_read() and (
 (peer is null and m.recipient_id is null) or
 (peer is not null and ((m.sender_id=auth.uid() and m.recipient_id=peer) or (m.sender_id=peer and m.recipient_id=auth.uid()))))
 order by m.id desc limit 100;
$$;
create or replace function public.neon_chat_send(message text,peer uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare me public.neon_profiles;
begin
 select * into me from public.neon_profiles where id=auth.uid() for update;
 if me.id is null then raise exception 'Sign in first'; end if;
 if me.chat_banned then raise exception 'You are banned from chat'; end if;
 if me.chat_muted_until>clock_timestamp() then raise exception 'You are muted until %',me.chat_muted_until; end if;
 if message is null or char_length(btrim(message)) not between 1 and 1000 then raise exception 'Use 1-1000 characters'; end if;
 if peer=auth.uid() then raise exception 'Choose another player'; end if;
 if peer is not null and not exists(select 1 from public.neon_profiles where id=peer and not chat_banned) then raise exception 'This player is unavailable'; end if;
 if me.chat_last_sent>clock_timestamp()-interval '3 seconds' then raise exception 'Wait a few seconds before sending again'; end if;
 insert into public.neon_messages(sender_id,recipient_id,body) values(me.id,peer,btrim(message));
 update public.neon_profiles set chat_last_sent=clock_timestamp() where id=me.id;
end; $$;
create or replace function public.neon_chat_announce(message text)
returns void language plpgsql security definer set search_path='' as $$
declare me public.neon_profiles;
begin
 select * into me from public.neon_profiles where id=auth.uid() for update;
 if me.id is null or me.chat_role not in ('owner','admin') or me.chat_banned or me.chat_muted_until>clock_timestamp() then raise exception 'Announcements are for active owners and admins'; end if;
 if message is null or char_length(btrim(message)) not between 1 and 1000 then raise exception 'Use 1-1000 characters'; end if;
 if me.chat_last_sent>clock_timestamp()-interval '3 seconds' then raise exception 'Wait a few seconds before sending again'; end if;
 insert into public.neon_messages(sender_id,body,announcement) values(me.id,btrim(message),true);
 update public.neon_profiles set chat_last_sent=clock_timestamp() where id=me.id;
 insert into public.neon_chat_audit(actor,action) values(me.id,'announcement');
end; $$;
create or replace function public.neon_chat_moderate(target_id uuid,operation text,value text default '')
returns void language plpgsql security definer set search_path='' as $$
declare me public.neon_profiles;other public.neon_profiles;
begin
 -- Serialize moderation so role changes cannot race another moderation action.
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 select * into me from public.neon_profiles where id=auth.uid();
 select * into other from public.neon_profiles where id=target_id for update;
 if me.id is null or me.chat_role not in ('owner','admin') or me.chat_banned or me.chat_muted_until>clock_timestamp() then raise exception 'Moderator access required'; end if;
 if other.id is null then raise exception 'Player not found'; end if;
 if other.id=me.id then raise exception 'You cannot moderate yourself'; end if;
 if other.chat_role='owner' then raise exception 'Owners are protected'; end if;
 if me.chat_role='admin' and other.chat_role='admin' then raise exception 'Only an owner can manage admins'; end if;
 if operation='role' then
  if value not in ('member','vip','admin','owner') or (me.chat_role='admin' and value not in ('member','vip')) then raise exception 'You cannot grant this role'; end if;
  update public.neon_profiles set chat_role=value where id=target_id;
 elsif operation='mute' then
  if value not in ('10','60','1440') then raise exception 'Choose 10 minutes, 1 hour, or 24 hours'; end if;
  update public.neon_profiles set chat_muted_until=clock_timestamp()+value::integer*interval '1 minute' where id=target_id;
 elsif operation='unmute' then update public.neon_profiles set chat_muted_until=null where id=target_id;
 elsif operation='ban' then update public.neon_profiles set chat_banned=true where id=target_id;
 elsif operation='unban' then update public.neon_profiles set chat_banned=false where id=target_id;
 else raise exception 'Unknown moderation action'; end if;
 insert into public.neon_chat_audit(actor,target,action,detail) values(me.id,target_id,operation,value);
end; $$;
create or replace function public.neon_chat_manage_players(query text)
returns table(id uuid,username text,role text,muted_until timestamptz,banned boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.username,p.chat_role,p.chat_muted_until,p.chat_banned from public.neon_profiles p
 where exists(select 1 from public.neon_profiles me where me.id=auth.uid() and me.chat_role in ('owner','admin') and not me.chat_banned and (me.chat_muted_until is null or me.chat_muted_until<=now()))
 and char_length(query) between 2 and 24 and position(lower(query) in lower(p.username))>0
 order by lower(p.username) limit 20;
$$;
create or replace function public.neon_chat_delete(message_id bigint)
returns void language plpgsql security definer set search_path='' as $$
declare me public.neon_profiles;
begin
 select * into me from public.neon_profiles where id=auth.uid();
 if me.id is null or me.chat_banned or me.chat_muted_until>clock_timestamp() then raise exception 'Chat access unavailable'; end if;
 delete from public.neon_messages m where m.id=message_id and (
 m.sender_id=me.id or (m.recipient_id is null and me.chat_role in ('admin','owner') and exists(
 select 1 from public.neon_profiles author where author.id=m.sender_id and author.chat_role<>'owner' and (me.chat_role='owner' or author.chat_role<>'admin'))));
end; $$;
revoke all on function public.neon_chat_self(),public.neon_chat_can_read(),public.neon_chat_announce(text),public.neon_chat_moderate(uuid,text,text),public.neon_chat_manage_players(text),public.neon_chat_history(uuid) from public,anon;
grant execute on function public.neon_chat_self(),public.neon_chat_can_read(),public.neon_chat_announce(text),public.neon_chat_moderate(uuid,text,text),public.neon_chat_manage_players(text),public.neon_chat_history(uuid) to authenticated;

commit;
