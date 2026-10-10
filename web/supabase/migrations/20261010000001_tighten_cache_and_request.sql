-- 검토 반영 (2026-10-10)
-- 1) 아이는 자기 프로필에 승인된 채널(및 자기가 요청한 채널 정보)만 캐시에서 읽는다. 부모는 가족 범위로 전체를 읽는다.
-- 2) 채널 추가 요청의 계기 영상은 실제로 그 채널의 영상이어야 한다.

drop policy if exists channel_cache_select on youtube_bookmark.yt_channel_cache;
drop policy if exists video_cache_select on youtube_bookmark.yt_video_cache;

create policy channel_cache_select on youtube_bookmark.yt_channel_cache for select to authenticated
  using (
    youtube_bookmark.is_parent()
    or channel_id in (
      select s.channel_id from youtube_bookmark.channel_states s
       where s.profile_id = youtube_bookmark.my_profile_id() and s.status = 'approved')
    or channel_id in (
      select r.channel_id from youtube_bookmark.channel_requests r
       where r.profile_id = youtube_bookmark.my_profile_id())
  );

create policy video_cache_select on youtube_bookmark.yt_video_cache for select to authenticated
  using (
    youtube_bookmark.is_parent()
    or channel_id in (
      select s.channel_id from youtube_bookmark.channel_states s
       where s.profile_id = youtube_bookmark.my_profile_id() and s.status = 'approved')
  );

create or replace function youtube_bookmark.request_channel(p_channel_id text, p_video_id text)
returns table (request_id uuid, result text)
language plpgsql security definer set search_path = '' as $$
declare
  v_profile youtube_bookmark.child_profiles;
  v_state text;
  v_id uuid;
begin
  select p.* into v_profile from youtube_bookmark.child_profiles p
    join youtube_bookmark.members m on m.id = p.member_id
   where m.auth_user_id = auth.uid();
  if v_profile.id is null then
    raise exception 'NOT_CHILD';
  end if;

  -- 계기 영상은 서버가 YouTube에서 확인해 캐시에 넣은 영상이어야 하고, 요청 채널의 영상이어야 한다.
  if not exists (
    select 1 from youtube_bookmark.yt_video_cache v
     where v.video_id = p_video_id and v.channel_id = p_channel_id
  ) then
    raise exception 'VIDEO_MISMATCH';
  end if;

  select s.status into v_state from youtube_bookmark.channel_states s
   where s.profile_id = v_profile.id and s.channel_id = p_channel_id;
  if v_state = 'approved' then
    return query select null::uuid, 'approved'::text; return;
  elsif v_state = 'rejected' then
    return query select null::uuid, 'rejected'::text; return;
  end if;

  select r.id into v_id from youtube_bookmark.channel_requests r
   where r.profile_id = v_profile.id and r.channel_id = p_channel_id and r.status = 'pending';

  if v_id is not null then
    update youtube_bookmark.channel_requests r
       set trigger_video_ids = case when p_video_id = any (r.trigger_video_ids) then r.trigger_video_ids
                                    else array_append(r.trigger_video_ids, p_video_id) end,
           last_trigger_video_id = p_video_id,
           updated_at = now()
     where r.id = v_id;
    return query select v_id, 'merged'::text; return;
  end if;

  insert into youtube_bookmark.channel_requests (family_id, profile_id, channel_id, trigger_video_ids, last_trigger_video_id)
  values (v_profile.family_id, v_profile.id, p_channel_id, array[p_video_id], p_video_id)
  returning id into v_id;
  return query select v_id, 'created'::text;
end $$;
