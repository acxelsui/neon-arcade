-- Neon Arcade account foundation. Run once in Supabase > SQL Editor.
-- Safe to re-run. Passwords belong to Supabase Auth, never these tables.
begin;

create table if not exists public.neon_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists neon_username_unique
  on public.neon_profiles (lower(username));

create table if not exists public.neon_sessions (
  user_id uuid not null references public.neon_profiles(id) on delete cascade,
  session_id uuid not null,
  game_id text check (length(game_id) between 1 and 120),
  game_name text check (length(game_name) between 1 and 120),
  game_started_at timestamptz,
  last_seen timestamptz not null default now(),
  primary key (user_id, session_id),
  check ((game_id is null and game_name is null and game_started_at is null)
    or (game_id is not null and game_name is not null and game_started_at is not null))
);
create index if not exists neon_sessions_seen on public.neon_sessions (last_seen);
alter table public.neon_profiles enable row level security;
alter table public.neon_sessions enable row level security;
revoke all on public.neon_profiles, public.neon_sessions from anon, authenticated;

-- Only the account owner can create their profile. Usernames ignore case for uniqueness.
create or replace function public.neon_create_profile(chosen_username text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if chosen_username is null or chosen_username !~ '^[a-zA-Z0-9_]{3,24}$' then
    raise exception 'Use 3-24 letters, numbers, or underscores';
  end if;
  insert into public.neon_profiles(id, username) values(auth.uid(), chosen_username);
end;
$$;

-- Clients report a game; the server owns timestamps and the authenticated identity.
-- Expired sessions do not keep accruing playing time after a disconnected browser.
create or replace function public.neon_heartbeat(tab_id uuid, playing_id text default null, playing_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if tab_id is null then raise exception 'Missing browser session'; end if;
  if (playing_id is null) <> (playing_name is null) then raise exception 'Invalid game'; end if;
  delete from public.neon_sessions where user_id = auth.uid() and last_seen < now() - interval '2 minutes';
  if not exists (select 1 from public.neon_sessions where user_id=auth.uid() and session_id=tab_id)
    and (select count(*) from public.neon_sessions where user_id=auth.uid()) >= 10 then
    raise exception 'Too many active tabs';
  end if;
  insert into public.neon_sessions as s (user_id,session_id,game_id,game_name,game_started_at,last_seen)
  values(auth.uid(),tab_id,playing_id,playing_name,case when playing_id is null then null else now() end,now())
  on conflict (user_id,session_id) do update set
    game_started_at = case when excluded.game_id is null then null
      when s.game_id is distinct from excluded.game_id then now() else s.game_started_at end,
    game_id=excluded.game_id, game_name=excluded.game_name, last_seen=now();
end;
$$;

create or replace function public.neon_leave(tab_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.neon_sessions where user_id=auth.uid() and session_id=tab_id;
$$;

-- Expose only active members, not the user directory, emails, or login details.
create or replace function public.neon_online()
returns table(id uuid,username text,game_id text,game_name text,game_started_at timestamptz,last_seen timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (p.id) p.id,p.username,s.game_id,s.game_name,s.game_started_at,s.last_seen
  from public.neon_profiles p join public.neon_sessions s on s.user_id=p.id
  where auth.uid() is not null and s.last_seen > now() - interval '2 minutes'
  order by p.id,(s.game_id is not null) desc,s.last_seen desc limit 100;
$$;

create or replace function public.neon_my_profile()
returns table(id uuid,username text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.username from public.neon_profiles p where p.id=auth.uid();
$$;

revoke all on function public.neon_create_profile(text), public.neon_heartbeat(uuid,text,text),
  public.neon_leave(uuid), public.neon_online(), public.neon_my_profile() from public, anon;
grant execute on function public.neon_create_profile(text), public.neon_heartbeat(uuid,text,text),
  public.neon_leave(uuid), public.neon_online(), public.neon_my_profile() to authenticated;

-- Private images. Owners upload to <their user UUID>/avatar; signed-in members can view.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('neon-avatars','neon-avatars',false,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=1048576,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Neon avatar read" on storage.objects;
create policy "Neon avatar read" on storage.objects for select to authenticated
using(bucket_id='neon-avatars');
drop policy if exists "Neon avatar insert" on storage.objects;
create policy "Neon avatar insert" on storage.objects for insert to authenticated
with check(bucket_id='neon-avatars' and name=auth.uid()::text || '/avatar');
drop policy if exists "Neon avatar update" on storage.objects;
create policy "Neon avatar update" on storage.objects for update to authenticated
using(bucket_id='neon-avatars' and name=auth.uid()::text || '/avatar')
with check(bucket_id='neon-avatars' and name=auth.uid()::text || '/avatar');
drop policy if exists "Neon avatar delete" on storage.objects;
create policy "Neon avatar delete" on storage.objects for delete to authenticated
using(bucket_id='neon-avatars' and name=auth.uid()::text || '/avatar');
commit;
