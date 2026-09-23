-- Add server-checked arcade access without exposing Supabase login tokens to games.
begin;
create table if not exists public.neon_access_passes (
  token_hash bytea primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.neon_access_passes enable row level security;
revoke all on public.neon_access_passes from anon,authenticated;
create index if not exists neon_access_owner on public.neon_access_passes(user_id);

create or replace function public.neon_issue_access()
returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if auth.uid() is null or not exists(select 1 from public.neon_profiles where id=auth.uid()) then
  raise exception 'A signed-in Neon profile is required';
 end if;
 delete from public.neon_access_passes where user_id=auth.uid() and expires_at<now();
 if (select count(*) from public.neon_access_passes where user_id=auth.uid())>=50 then
  raise exception 'Too many arcade sessions. Sign out of older sessions or try again later';
 end if;
 token:=replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
 insert into public.neon_access_passes values(sha256(decode(token,'hex')),auth.uid(),now()+interval '8 hours');
 return token;
end;
$$;
create or replace function public.neon_check_access(pass text)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if pass is null or pass !~ '^[a-f0-9]{64}$' then return false; end if;
 return exists(select 1 from public.neon_access_passes where token_hash=sha256(decode(pass,'hex')) and expires_at>now());
end;
$$;
create or replace function public.neon_revoke_access(pass text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if pass is not null and pass ~ '^[a-f0-9]{64}$' then
  delete from public.neon_access_passes where user_id=auth.uid() and token_hash=sha256(decode(pass,'hex'));
 end if;
end;
$$;
revoke all on function public.neon_issue_access(),public.neon_check_access(text),public.neon_revoke_access(text) from public,anon,authenticated;
grant execute on function public.neon_issue_access(),public.neon_revoke_access(text) to authenticated;
grant execute on function public.neon_check_access(text) to anon,authenticated;
commit;
