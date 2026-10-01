-- Fix saving currently playing provider tracks. Preserves all existing playlists and permissions.
begin;
create or replace function public.neon_playlist_save(playlist_id uuid,playlist_name text,songs jsonb,expected_revision bigint default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare item jsonb;clean jsonb='[]';result uuid;count_songs int;
begin
 perform public.neon_social_access();
 perform 1 from public.neon_profiles where id=auth.uid() for update;
 if playlist_name is null or char_length(btrim(playlist_name)) not between 1 and 50 or songs is null or jsonb_typeof(songs)<>'array' then raise exception 'Choose a playlist name and valid songs'; end if;
 count_songs=jsonb_array_length(songs);if count_songs>100 then raise exception 'A playlist holds up to 100 songs'; end if;
 for item in select value from jsonb_array_elements(songs) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'id','')!~'^[a-zA-Z0-9:_-]{1,160}$' or char_length(coalesce(item->>'title','')) not between 1 and 200 or char_length(coalesce(item->>'artist',''))>200
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
commit;
