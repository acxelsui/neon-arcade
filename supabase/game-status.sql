-- Run after owner-toolkit.sql. Safe to re-run; preserves existing game status.
begin;
create table if not exists public.neon_game_status (
 game_id text primary key check(game_id ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
 latest_load text check(latest_load in ('loaded','failed','slow')),
 load_detail text not null default '' check(load_detail in ('','http','network','timeout','start')),
 loaded_count bigint not null default 0, failed_count bigint not null default 0, slow_count bigint not null default 0,
 last_report_at timestamptz,
 review_status text check(review_status in ('working','broken')),
 review_note text not null default '' check(char_length(review_note)<=240),
 reviewed_by uuid references public.neon_profiles(id) on delete set null,
 reviewed_at timestamptz
);
create table if not exists public.neon_game_load_reports (
 user_id uuid not null references public.neon_profiles(id) on delete cascade,
 run_id uuid not null, game_id text not null references public.neon_game_status(game_id),
 outcome text not null check(outcome in ('loaded','failed','slow')),
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,run_id,outcome)
);
create index if not exists neon_game_load_reports_recent on public.neon_game_load_reports(user_id,created_at);
create index if not exists neon_game_load_reports_retention on public.neon_game_load_reports(created_at);
alter table public.neon_game_status enable row level security;
alter table public.neon_game_load_reports enable row level security;
revoke all on public.neon_game_status,public.neon_game_load_reports from public,anon,authenticated;

create or replace function public.neon_game_load_report(game_id text,run_id uuid,outcome text,detail text default '')
returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if not exists(select 1 from public.neon_profiles p where p.id=auth.uid() and not p.site_banned) then raise exception 'Sign in to report a game load';end if;
 if game_id is null or game_id !~ '^[a-z0-9][a-z0-9_-]{0,119}$' or run_id is null or outcome is null or outcome not in ('loaded','failed','slow') or detail is null or detail not in ('','http','network','timeout','start') then raise exception 'Invalid game load report';end if;
 -- Serialize each account's rate limit and duplicate checks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,71423));
 if exists(select 1 from public.neon_game_load_reports r where r.user_id=auth.uid() and r.run_id=neon_game_load_report.run_id and r.outcome=neon_game_load_report.outcome) then return;end if;
 if (select count(*) from public.neon_game_load_reports r where r.user_id=auth.uid() and r.created_at>clock_timestamp()-interval '1 hour')>=120 then raise exception 'Too many game reports. Try later';end if;
 if not exists(select 1 from public.neon_game_status s where s.game_id=neon_game_load_report.game_id) and (select count(*) from public.neon_game_status)>=5000 then raise exception 'Game status capacity reached';end if;
 insert into public.neon_game_status(game_id) values(game_id) on conflict on constraint neon_game_status_pkey do nothing;
 insert into public.neon_game_load_reports(user_id,run_id,game_id,outcome) values(auth.uid(),run_id,game_id,outcome) on conflict on constraint neon_game_load_reports_pkey do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return;end if;
 update public.neon_game_status s set latest_load=outcome,load_detail=detail,last_report_at=clock_timestamp(),
  loaded_count=s.loaded_count+case when outcome='loaded' then 1 else 0 end,
  failed_count=s.failed_count+case when outcome='failed' then 1 else 0 end,
  slow_count=s.slow_count+case when outcome='slow' then 1 else 0 end
 where s.game_id=neon_game_load_report.game_id;
 -- Keep only the recent deduplication and rate-limit history. Aggregates remain.
 delete from public.neon_game_load_reports where created_at<clock_timestamp()-interval '7 days';
end; $$;

create or replace function public.neon_owner_game_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.neon_owner_access();
 return coalesce((select jsonb_agg(to_jsonb(s)) from (
  select g.game_id,g.latest_load,g.load_detail,g.loaded_count,g.failed_count,g.slow_count,g.last_report_at,
   g.review_status,g.review_note,g.reviewed_at,p.username as reviewed_by
  from public.neon_game_status g left join public.neon_profiles p on p.id=g.reviewed_by
  order by g.game_id limit 5000
 ) s),'[]'::jsonb);
end; $$;

create or replace function public.neon_owner_game_review(game_id text,review_status text,note text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Same lock as owner role changes: losing owner access cannot race a review.
 perform pg_catalog.pg_advisory_xact_lock(7843921);
 perform public.neon_owner_access();
 if game_id is null or game_id !~ '^[a-z0-9][a-z0-9_-]{0,119}$' or review_status is null or review_status not in ('working','broken','clear') or note is null or char_length(note)>240 then raise exception 'Invalid game review';end if;
 if not exists(select 1 from public.neon_game_status s where s.game_id=neon_owner_game_review.game_id) and (select count(*) from public.neon_game_status)>=5000 then raise exception 'Game status capacity reached';end if;
 insert into public.neon_game_status(game_id) values(game_id) on conflict on constraint neon_game_status_pkey do nothing;
 update public.neon_game_status s set
  review_status=case when neon_owner_game_review.review_status='clear' then null else neon_owner_game_review.review_status end,
  review_note=case when neon_owner_game_review.review_status='clear' then '' else btrim(note) end,
  reviewed_by=case when neon_owner_game_review.review_status='clear' then null else auth.uid() end,
  reviewed_at=case when neon_owner_game_review.review_status='clear' then null else clock_timestamp() end
 where s.game_id=neon_owner_game_review.game_id;
 insert into public.neon_chat_audit(actor,action,detail) values(auth.uid(),'game-'||review_status,left(game_id||case when btrim(note)='' then '' else ': '||btrim(note) end,240));
end; $$;

revoke all on function public.neon_game_load_report(text,uuid,text,text),public.neon_owner_game_status(),public.neon_owner_game_review(text,text,text) from public,anon,authenticated;
grant execute on function public.neon_game_load_report(text,uuid,text,text),public.neon_owner_game_status(),public.neon_owner_game_review(text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
