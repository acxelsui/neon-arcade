-- Run after access.sql. Safe to re-run. Keeps all existing accounts and game data.
begin;
create table if not exists public.neon_game_saves(
 user_id uuid not null references public.neon_profiles(id) on delete cascade,
 game_id text not null check(game_id in ('114','473','309')),
 save_state jsonb not null,
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(user_id,game_id)
);
alter table public.neon_game_saves enable row level security;
revoke all on public.neon_game_saves from public,anon,authenticated;
create or replace function public.neon_game_save_read(game_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.neon_game_saves;
begin
 if not exists(select 1 from public.neon_profiles p where p.id=auth.uid() and not p.site_banned) then raise exception 'Sign in to sync game saves';end if;
 if game_id is null or game_id not in ('114','473','309') then raise exception 'Unsupported game save';end if;
 select * into saved from public.neon_game_saves s where s.user_id=auth.uid() and s.game_id=neon_game_save_read.game_id;
 return jsonb_build_object('user_id',auth.uid(),'revision',coalesce(saved.revision,0),'state',saved.save_state,'updated_at',saved.updated_at);
end;$$;
create or replace function public.neon_game_save_write(game_id text,save_state jsonb,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.neon_game_saves; allowed text[]; actual text[];
begin
 if not exists(select 1 from public.neon_profiles p where p.id=auth.uid() and not p.site_banned) then raise exception 'Sign in to sync game saves';end if;
 if game_id is null or game_id not in ('114','473','309') or expected_revision is null or expected_revision<0 or expected_revision>9007199254740991 or save_state is null or jsonb_typeof(save_state)<>'object' or pg_catalog.octet_length(save_state::text)>524288 then raise exception 'Invalid game save';end if;
 allowed=case game_id when '114' then array['bestScore','gameState'] when '473' then array['spacebar_clicker_game'] else array(select 'SandboxelsSaves/'||i from generate_series(1,12)i) end;
 select array_agg(k order by k) into actual from jsonb_object_keys(save_state)k;
 if actual is distinct from (select array_agg(k order by k) from unnest(allowed)k) or exists(select 1 from jsonb_each(save_state)e where jsonb_typeof(e.value) not in ('string','null')) then raise exception 'Invalid game save keys';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||game_id,92513));
 select * into saved from public.neon_game_saves s where s.user_id=auth.uid() and s.game_id=neon_game_save_write.game_id;
 if coalesce(saved.revision,0)<>expected_revision then return jsonb_build_object('conflict',true,'revision',coalesce(saved.revision,0));end if;
 if saved.updated_at>clock_timestamp()-interval '2 seconds' then raise exception 'Please wait a moment before syncing again';end if;
 insert into public.neon_game_saves(user_id,game_id,save_state,revision) values(auth.uid(),game_id,save_state,1)
 on conflict on constraint neon_game_saves_pkey do update set save_state=excluded.save_state,revision=neon_game_saves.revision+1,updated_at=clock_timestamp()
 returning * into saved;
 return jsonb_build_object('user_id',auth.uid(),'revision',saved.revision,'updated_at',saved.updated_at);
end;$$;
revoke all on function public.neon_game_save_read(text),public.neon_game_save_write(text,jsonb,bigint) from public,anon;
grant execute on function public.neon_game_save_read(text),public.neon_game_save_write(text,jsonb,bigint) to authenticated;
commit;
