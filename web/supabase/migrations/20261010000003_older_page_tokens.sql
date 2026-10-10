-- "이전 영상 더 보기" (2026-10-10)
-- 채널마다 일반 영상·쇼츠 목록의 다음 쪽 위치(YouTube 페이지 토큰)를 기억해, 버튼을 누를 때 다음 50개를 이어서 받는다.
-- *_done: 더 받을 영상이 없음.
alter table youtube_bookmark.yt_channel_cache add column if not exists older_videos_token text;
alter table youtube_bookmark.yt_channel_cache add column if not exists older_shorts_token text;
alter table youtube_bookmark.yt_channel_cache add column if not exists older_videos_done boolean not null default false;
alter table youtube_bookmark.yt_channel_cache add column if not exists older_shorts_done boolean not null default false;
