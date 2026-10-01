-- Run after social.sql. Existing playlists stay private until their owner shares them.
begin;
alter table public.neon_playlists add column if not exists share_token uuid;
create unique index if not exists neon_playlist_share_token on public.neon_playlists(share_token) where share_token is not null;

create or replace function public.neon_playlists_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.neon_social_access();
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'tracks',tracks,'revision',revision,'share_token',share_token) order by updated_at desc),'[]') into result from public.neon_playlists where owner=auth.uid();return result;
end; $$;

create or replace function public.neon_playlist_share(playlist_id uuid,enabled boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform public.neon_social_access();
 if enabled is null then raise exception 'Choose whether to share this playlist'; end if;
 update public.neon_playlists set share_token=case when enabled then coalesce(share_token,gen_random_uuid()) else null end where id=playlist_id and owner=auth.uid() returning share_token into result;
 if not found then raise exception 'Playlist unavailable'; end if;
 return result;
end; $$;

create or replace function public.neon_playlist_shared(link_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.neon_social_access();
 select jsonb_build_object('id',l.id,'name',l.name,'tracks',l.tracks,'owner_name',p.username)
 into result from public.neon_playlists l join public.neon_profiles p on p.id=l.owner
 where link_token is not null and l.share_token=link_token and not p.chat_banned;
 if result is null then raise exception 'This playlist link is unavailable or sharing has been turned off'; end if;
 return result;
end; $$;
revoke all on function public.neon_playlists_list(),public.neon_playlist_share(uuid,boolean),public.neon_playlist_shared(uuid) from public,anon;
grant execute on function public.neon_playlists_list(),public.neon_playlist_share(uuid,boolean),public.neon_playlist_shared(uuid) to authenticated;
commit;
