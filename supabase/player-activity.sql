-- Run after the existing account and owner-toolkit setup. Safe to rerun.
-- Records aggregate presence only. Existing accounts, sessions and saves stay intact.
begin;

create table if not exists public.neon_player_activity (
  minute timestamptz primary key,
  observed_at timestamptz not null,
  online_count integer not null check (online_count between 0 and 1000000)
);
alter table public.neon_player_activity enable row level security;
revoke all on public.neon_player_activity from public, anon, authenticated;

-- The existing heartbeat/leave functions write sessions. Sample once per minute,
-- after the complete transaction, so heartbeat cleanup cannot sample before
-- the replacement session is inserted. Clients cannot submit counts or times.
-- Each account
-- counts once, regardless of tabs. No scheduler or new heartbeat is required.
create or replace function public.neon_record_player_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz := clock_timestamp(); bucket timestamptz; players integer;
begin
  bucket := pg_catalog.date_trunc('minute', stamp);
  if exists (select 1 from public.neon_player_activity where minute = bucket) then return null; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(7843997) then return null; end if;
  if exists (select 1 from public.neon_player_activity where minute = bucket) then return null; end if;
  select count(distinct s.user_id)::integer into players
    from public.neon_sessions s join public.neon_profiles p on p.id = s.user_id
    where s.last_seen > stamp - interval '2 minutes' and not p.site_banned;
  insert into public.neon_player_activity (minute, observed_at, online_count)
    values (bucket, stamp, players) on conflict (minute) do nothing;
  delete from public.neon_player_activity where minute < bucket - interval '90 days';
  return null;
end; $$;
revoke all on function public.neon_record_player_activity() from public, anon, authenticated;
drop trigger if exists neon_record_player_activity on public.neon_sessions;
create constraint trigger neon_record_player_activity after insert or update or delete
  on public.neon_sessions deferrable initially deferred for each row
  execute function public.neon_record_player_activity();

create or replace function public.neon_owner_player_activity(window_hours integer default 24)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare stamp timestamptz := now(); step_minutes integer; last_bucket timestamptz;
  first_bucket timestamptz; current_players integer; result jsonb;
begin
  perform public.neon_owner_access();
  if window_hours is null or window_hours not in (1, 24, 168) then raise exception 'Choose 1 hour, 24 hours or 7 days'; end if;
  step_minutes := case window_hours when 1 then 1 when 24 then 5 else 60 end;
  last_bucket := pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', stamp) / (step_minutes * 60)) * (step_minutes * 60));
  first_bucket := last_bucket - pg_catalog.make_interval(hours => window_hours);
  select count(distinct s.user_id)::integer into current_players
    from public.neon_sessions s join public.neon_profiles p on p.id = s.user_id
    where s.last_seen > stamp - interval '2 minutes' and not p.site_banned;
  with recorded as (
    select pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', a.minute) / (step_minutes * 60)) * (step_minutes * 60)) as bucket,
      max(a.online_count) as online_count
    from public.neon_player_activity a
    where a.minute >= first_bucket and a.minute <= stamp group by 1
  ), timeline as (
    select t.bucket, r.online_count from pg_catalog.generate_series(first_bucket, last_bucket, pg_catalog.make_interval(mins => step_minutes)) t(bucket)
      left join recorded r on r.bucket = t.bucket
  )
  select pg_catalog.jsonb_build_object(
    'server_time', stamp, 'from', first_bucket, 'to', stamp, 'step_minutes', step_minutes,
    'recording_since', (select min(minute) from public.neon_player_activity),
    'current_online', current_players,
    'points', pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('time', bucket, 'count', online_count) order by bucket)
  ) into result from timeline;
  return result;
end; $$;
revoke all on function public.neon_owner_player_activity(integer) from public, anon;
grant execute on function public.neon_owner_player_activity(integer) to authenticated;
commit;
