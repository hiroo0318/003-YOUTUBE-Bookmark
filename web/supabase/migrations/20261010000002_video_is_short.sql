-- 영상/쇼츠 구분 (2026-10-10)
-- is_short: 채널의 쇼츠 재생목록(UUSH…)에 있으면 true, 일반 영상 재생목록(UULF…)에 있으면 false.
-- 재생목록으로 판정하지 못하면 길이(3분 이하)·세로 비율로 추정한다. null은 아직 판정 전.
alter table youtube_bookmark.yt_video_cache add column if not exists is_short boolean;
alter table youtube_bookmark.yt_video_cache add column if not exists is_vertical boolean;
