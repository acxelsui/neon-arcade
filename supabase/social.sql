-- Run after setup.sql and chat.sql. Preserves accounts, chat, and existing avatars.
begin;
alter table public.neon_profiles add column if not exists bio text not null default '' check(char_length(bio)<=240);
alter table public.neon_profiles add column if not exists favorite_games text[] not null default '{}' check(cardinality(favorite_games)<=6);
alter table public.neon_profiles add column if not exists avatar_decoration text not null default 'none' check(avatar_decoration in ('none','halo','cat','orbit','ribbon','headphones','flame','wings','pixel'));
create table if not exists public.neon_friends (
 low_id uuid not null references public.neon_profiles(id) on delete cascade,
 high_id uuid not null references public.neon_profiles(id) on delete cascade,
 requester uuid not null references public.neon_profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 primary key(low_id,high_id),check(low_id<high_id),check(requester in (low_id,high_id))
);
create table if not exists public.neon_playlists (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null references public.neon_profiles(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 50),
 tracks jsonb not null default '[]',revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(tracks)='array' and jsonb_array_length(tracks)<=100)
);
create index if not exists neon_playlist_owner on public.neon_playlists(owner);
alter table public.neon_friends enable row level security;
alter table public.neon_playlists enable row level security;
revoke all on public.neon_friends,public.neon_playlists from public,anon,authenticated;

create or replace function public.neon_social_access() returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.neon_profiles where id=auth.uid() and not chat_banned) then raise exception 'Sign in with an active account'; end if;
end; $$;

create or replace function public.neon_player_profile(player_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.neon_social_access();
 select jsonb_build_object('id',p.id,'username',p.username,'bio',p.bio,'role',p.chat_role,'favorite_games',p.favorite_games,'decoration',p.avatar_decoration,'joined',p.created_at,
 'online',s.last_seen>now()-interval '2 minutes','game_name',s.game_name,'game_id',s.game_id,
 'relationship',case when p.id=auth.uid() then 'self' when f.status='accepted' then 'friend' when f.requester=auth.uid() then 'outgoing' when f.requester is not null then 'incoming' else 'none' end)
 into result from public.neon_profiles p
 left join public.neon_friends f on f.low_id=least(p.id,auth.uid()) and f.high_id=greatest(p.id,auth.uid())
 left join lateral(select n.game_name,n.game_id,n.last_seen from public.neon_sessions n where n.user_id=p.id and n.last_seen>now()-interval '2 minutes' order by (n.game_id is not null) desc,n.last_seen desc limit 1)s on true
 where p.id=coalesce(player_id,auth.uid()) and not p.chat_banned;
 if result is null then raise exception 'Player unavailable'; end if;
 return result;
end; $$;

create or replace function public.neon_profile_save(about text,game_ids text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.neon_social_access();
 if about is null or char_length(about)>240 or game_ids is null or cardinality(game_ids)>6 or exists(select 1 from unnest(game_ids)g where g is null or g!~'^[a-zA-Z0-9_-]{1,80}$') then raise exception 'Use a bio under 240 characters and up to 6 games'; end if;
 update public.neon_profiles set bio=btrim(about),favorite_games=array(select distinct g from unnest(game_ids)g) where id=auth.uid();
end; $$;
create or replace function public.neon_decoration_save(style text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.neon_social_access();
 if style is null or style not in ('none','halo','cat','orbit','ribbon','headphones','flame','wings','pixel') then raise exception 'Choose an available decoration'; end if;
 update public.neon_profiles set avatar_decoration=style where id=auth.uid();
end; $$;
revoke all on function public.neon_decoration_save(text) from public,anon;
grant execute on function public.neon_decoration_save(text) to authenticated;
create or replace function public.neon_decorations(player_ids uuid[]) returns table(id uuid,decoration text)
language sql stable security definer set search_path='' as $$
 select p.id,p.avatar_decoration from public.neon_profiles p where auth.uid() is not null and cardinality(player_ids)<=100 and p.id=any(player_ids) and not p.chat_banned;
$$;
revoke all on function public.neon_decorations(uuid[]) from public,anon;
grant execute on function public.neon_decorations(uuid[]) to authenticated;

create or replace function public.neon_friend_action(peer uuid,operation text) returns void
language plpgsql security definer set search_path='' as $$
declare lo uuid;hi uuid;relation public.neon_friends;
begin
 perform public.neon_social_access();
 if peer is null or peer=auth.uid() or not exists(select 1 from public.neon_profiles where id=peer and not chat_banned) then raise exception 'Choose another active player'; end if;
 lo=least(peer,auth.uid());hi=greatest(peer,auth.uid());
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lo::text||hi::text,0));
 select * into relation from public.neon_friends where low_id=lo and high_id=hi;
 if operation='request' then
  if relation.low_id is not null then raise exception 'A request or friendship already exists'; end if;
  if (select count(*) from public.neon_friends where low_id=auth.uid() or high_id=auth.uid())>=200 then raise exception 'Your friends list is full'; end if;
  if (select count(*) from public.neon_friends where low_id=peer or high_id=peer)>=200 then raise exception 'This player has a full friends list'; end if;
  if (select count(*) from public.neon_friends where requester=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'Wait before adding more friends'; end if;
  insert into public.neon_friends(low_id,high_id,requester)values(lo,hi,auth.uid());
 elsif operation='accept' then
  if relation.status is distinct from 'pending' or relation.requester=auth.uid() then raise exception 'Only the recipient can accept a pending request'; end if;
  update public.neon_friends set status='accepted' where low_id=lo and high_id=hi;
 elsif operation='remove' then delete from public.neon_friends where low_id=lo and high_id=hi;
 else raise exception 'Unknown friend action'; end if;
end; $$;

create or replace function public.neon_friends_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.neon_social_access();
 select coalesce(jsonb_agg(public.neon_player_profile(peer) order by created_at desc),'[]') into result
 from (select case when low_id=auth.uid() then high_id else low_id end peer,created_at from public.neon_friends f
 where (low_id=auth.uid() or high_id=auth.uid()) and exists(select 1 from public.neon_profiles p where p.id=case when low_id=auth.uid() then high_id else low_id end and not p.chat_banned) limit 400)r;
 return result;
end; $$;

create or replace function public.neon_player_search(query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.neon_social_access();
 if query is null or char_length(query) not between 2 and 24 then raise exception 'Search with 2-24 characters'; end if;
 select coalesce(jsonb_agg(public.neon_player_profile(id) order by lower(username)),'[]') into result from
 (select p.id,p.username from public.neon_profiles p where p.id<>auth.uid() and not chat_banned and position(lower(query) in lower(p.username))>0 order by lower(p.username) limit 20)r;
 return result;
end; $$;

create or replace function public.neon_playlists_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.neon_social_access();
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'tracks',tracks,'revision',revision) order by updated_at desc),'[]') into result from public.neon_playlists where owner=auth.uid();return result;
end; $$;

create or replace function public.neon_playlist_save(playlist_id uuid,playlist_name text,songs jsonb,expected_revision bigint default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare item jsonb;clean jsonb='[]';result uuid;count_songs int;
begin
 perform public.neon_social_access();
 perform 1 from public.neon_profiles where id=auth.uid() for update;
 if playlist_name is null or char_length(btrim(playlist_name)) not between 1 and 50 or songs is null or jsonb_typeof(songs)<>'array' then raise exception 'Choose a playlist name and valid songs'; end if;
 count_songs=jsonb_array_length(songs);if count_songs>100 then raise exception 'A playlist holds up to 100 songs'; end if;
 for item in select value from jsonb_array_elements(songs) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'id','')!~'^[a-zA-Z0-9_-]{1,120}$' or char_length(coalesce(item->>'title','')) not between 1 and 200 or char_length(coalesce(item->>'artist',''))>200
   or char_length(coalesce(item->>'thumb',''))>2000 or (coalesce(item->>'thumb','')<>'' and (item->>'thumb')!~'^https://[^/@[:space:]]+(/|$)')
   or coalesce(item->>'duration','0')!~'^[0-9]{1,6}$' then raise exception 'Invalid song details'; end if;
  if exists(select 1 from jsonb_array_elements(clean)c where c->>'id'=item->>'id') then raise exception 'That song is already in the playlist'; end if;
  clean=clean||jsonb_build_array(jsonb_build_object('id',item->>'id','title',item->>'title','artist',coalesce(item->>'artist',''),'thumb',coalesce(item->>'thumb',''),'duration',coalesce(item->>'duration','0')::int));
 end loop;
 if playlist_id is null then
  if (select count(*) from public.neon_playlists where owner=auth.uid())>=30 then raise exception 'You can save up to 30 playlists'; end if;
  insert into public.neon_playlists(owner,name,tracks)values(auth.uid(),btrim(playlist_name),clean)returning id into result;
 else
  update public.neon_playlists set name=btrim(playlist_name),tracks=clean,revision=revision+1,updated_at=now() where id=playlist_id and owner=auth.uid() and revision=expected_revision returning id into result;
  if result is null then raise exception 'Playlist changed or is unavailable. Refresh before editing'; end if;
 end if;return result;
end; $$;
create or replace function public.neon_playlist_delete(playlist_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin perform public.neon_social_access();delete from public.neon_playlists where id=playlist_id and owner=auth.uid();end; $$;

revoke all on function public.neon_social_access(),public.neon_player_profile(uuid),public.neon_profile_save(text,text[]),public.neon_friend_action(uuid,text),public.neon_friends_list(),public.neon_player_search(text),public.neon_playlists_list(),public.neon_playlist_save(uuid,text,jsonb,bigint),public.neon_playlist_delete(uuid) from public,anon;
grant execute on function public.neon_player_profile(uuid),public.neon_profile_save(text,text[]),public.neon_friend_action(uuid,text),public.neon_friends_list(),public.neon_player_search(text),public.neon_playlists_list(),public.neon_playlist_save(uuid,text,jsonb,bigint),public.neon_playlist_delete(uuid) to authenticated;
commit;
