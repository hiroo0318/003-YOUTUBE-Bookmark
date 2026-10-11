-- 좋아요 (2026-10-11)
-- 아이가 승인 채널 영상에 누른 좋아요. 채널담 안에서만 쓰며 YouTube 계정의 좋아요와는 연결하지 않는다.
-- 영상 정보는 공유 캐시(yt_video_cache)에서 읽으므로, 승인이 취소된 채널의 영상은 캐시 읽기 정책에 따라 자동으로 보이지 않는다.
create table if not exists youtube_bookmark.video_likes (
  profile_id uuid not null references youtube_bookmark.child_profiles (id) on delete cascade,
  video_id text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, video_id)
);
create index if not exists video_likes_video_idx on youtube_bookmark.video_likes (video_id);

alter table youtube_bookmark.video_likes enable row level security;

grant select, insert, update, delete on youtube_bookmark.video_likes to service_role;
grant select on youtube_bookmark.video_likes to authenticated;
grant insert (profile_id, video_id), delete on youtube_bookmark.video_likes to authenticated;

-- 아이는 자기 것만 읽고 쓴다. 부모는 가족 아이의 좋아요를 읽기만 한다(1차 화면에는 쓰지 않음).
create policy likes_select on youtube_bookmark.video_likes for select to authenticated
  using (
    profile_id = youtube_bookmark.my_profile_id()
    or (youtube_bookmark.is_parent() and profile_id in (
      select p.id from youtube_bookmark.child_profiles p where p.family_id = youtube_bookmark.my_family_id()))
  );
create policy likes_insert on youtube_bookmark.video_likes for insert to authenticated
  with check (profile_id = youtube_bookmark.my_profile_id());
create policy likes_delete on youtube_bookmark.video_likes for delete to authenticated
  using (profile_id = youtube_bookmark.my_profile_id());
