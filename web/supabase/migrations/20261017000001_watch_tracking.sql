-- 시청 기록·시간 관리 (2026-10-17)
-- 채널담 안에서 기록한 값이다(YouTube 수치 아님). 날짜는 한국 시간 기준.
--   watch_plays : 재생 시작 1회 = 1행(많이 본 영상·채널 집계용)
--   watch_daily : 아이별 하루 시청 초(재생 중 30초마다 누적)
--   watch_limits: 아이별 하루 한도(평일·주말, 분). null = 제한 없음
--   watch_bonus : 아이별 특정 날짜의 보너스 시간(분). 그날 한도에 더한다

create table if not exists youtube_bookmark.watch_plays (
  id bigint generated always as identity primary key,
  profile_id uuid not null references youtube_bookmark.child_profiles (id) on delete cascade,
  video_id text not null,
  channel_id text not null,
  played_at timestamptz not null default now()
);
create index if not exists watch_plays_profile_time_idx on youtube_bookmark.watch_plays (profile_id, played_at desc);

create table if not exists youtube_bookmark.watch_daily (
  profile_id uuid not null references youtube_bookmark.child_profiles (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, day)
);

create table if not exists youtube_bookmark.watch_limits (
  profile_id uuid primary key references youtube_bookmark.child_profiles (id) on delete cascade,
  weekday_minutes integer check (weekday_minutes is null or weekday_minutes between 0 and 1440),
  weekend_minutes integer check (weekend_minutes is null or weekend_minutes between 0 and 1440),
  updated_by uuid references youtube_bookmark.members (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists youtube_bookmark.watch_bonus (
  profile_id uuid not null references youtube_bookmark.child_profiles (id) on delete cascade,
  day date not null,
  minutes integer not null default 0 check (minutes between 0 and 1440),
  granted_by uuid references youtube_bookmark.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, day)
);

-- 가족 아이 프로필인지(부모 권한 확인용)
create or replace function youtube_bookmark.is_family_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select youtube_bookmark.is_parent() and exists (
    select 1 from youtube_bookmark.child_profiles p
     where p.id = p_profile_id and p.family_id = youtube_bookmark.my_family_id())
$$;

-- 한국 시간 오늘
create or replace function youtube_bookmark.kst_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- 그날 한도(초). 한도 없음이면 null. 토·일은 주말 한도, 그날 보너스는 더한다. 본인(아이)·가족 부모만 조회할 수 있다.
create or replace function youtube_bookmark.watch_limit_seconds(p_profile_id uuid, p_day date) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base integer;
  v_bonus integer;
begin
  if not (p_profile_id = youtube_bookmark.my_profile_id() or youtube_bookmark.is_family_profile(p_profile_id)) then
    return null;
  end if;
  select case when extract(isodow from p_day) in (6, 7) then l.weekend_minutes else l.weekday_minutes end
    into v_base
    from youtube_bookmark.watch_limits l
   where l.profile_id = p_profile_id;
  if v_base is null then
    return null;
  end if;
  select b.minutes into v_bonus from youtube_bookmark.watch_bonus b where b.profile_id = p_profile_id and b.day = p_day;
  return (v_base + coalesce(v_bonus, 0)) * 60;
end;
$$;

-- 아이: 오늘 시청 초를 더하고(한 번에 최대 90초) 오늘 사용·한도를 돌려준다. p_seconds = 0이면 조회만.
create or replace function youtube_bookmark.add_watch_seconds(p_seconds integer)
returns table (used_seconds integer, limit_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid := youtube_bookmark.my_profile_id();
  v_day date := youtube_bookmark.kst_today();
  v_add integer := greatest(0, least(coalesce(p_seconds, 0), 90));
begin
  if v_profile is null then
    raise exception 'NOT_CHILD';
  end if;
  if v_add > 0 then
    insert into youtube_bookmark.watch_daily as d (profile_id, day, seconds)
    values (v_profile, v_day, v_add)
    on conflict (profile_id, day) do update set seconds = d.seconds + excluded.seconds, updated_at = now();
  end if;
  return query
    select coalesce((select d.seconds from youtube_bookmark.watch_daily d where d.profile_id = v_profile and d.day = v_day), 0),
           youtube_bookmark.watch_limit_seconds(v_profile, v_day);
end;
$$;

alter table youtube_bookmark.watch_plays enable row level security;
alter table youtube_bookmark.watch_daily enable row level security;
alter table youtube_bookmark.watch_limits enable row level security;
alter table youtube_bookmark.watch_bonus enable row level security;

grant select, insert, update, delete on youtube_bookmark.watch_plays, youtube_bookmark.watch_daily,
  youtube_bookmark.watch_limits, youtube_bookmark.watch_bonus to service_role;
grant select on youtube_bookmark.watch_plays, youtube_bookmark.watch_daily,
  youtube_bookmark.watch_limits, youtube_bookmark.watch_bonus to authenticated;
grant insert (profile_id, video_id, channel_id) on youtube_bookmark.watch_plays to authenticated;
grant insert (profile_id, weekday_minutes, weekend_minutes, updated_by, updated_at),
  update (weekday_minutes, weekend_minutes, updated_by, updated_at) on youtube_bookmark.watch_limits to authenticated;
grant insert (profile_id, day, minutes, granted_by, updated_at),
  update (minutes, granted_by, updated_at) on youtube_bookmark.watch_bonus to authenticated;
grant usage on sequence youtube_bookmark.watch_plays_id_seq to authenticated;

revoke all on function youtube_bookmark.is_family_profile(uuid), youtube_bookmark.kst_today(),
  youtube_bookmark.watch_limit_seconds(uuid, date), youtube_bookmark.add_watch_seconds(integer) from public, anon;
grant execute on function youtube_bookmark.is_family_profile(uuid), youtube_bookmark.kst_today(),
  youtube_bookmark.watch_limit_seconds(uuid, date), youtube_bookmark.add_watch_seconds(integer) to authenticated, service_role;

-- 읽기: 아이는 자기 것, 부모는 가족 아이 것
create policy watch_plays_select on youtube_bookmark.watch_plays for select to authenticated
  using (profile_id = youtube_bookmark.my_profile_id() or youtube_bookmark.is_family_profile(profile_id));
create policy watch_daily_select on youtube_bookmark.watch_daily for select to authenticated
  using (profile_id = youtube_bookmark.my_profile_id() or youtube_bookmark.is_family_profile(profile_id));
create policy watch_limits_select on youtube_bookmark.watch_limits for select to authenticated
  using (profile_id = youtube_bookmark.my_profile_id() or youtube_bookmark.is_family_profile(profile_id));
create policy watch_bonus_select on youtube_bookmark.watch_bonus for select to authenticated
  using (profile_id = youtube_bookmark.my_profile_id() or youtube_bookmark.is_family_profile(profile_id));

-- 쓰기: 재생 기록은 아이 자신, 한도·보너스는 가족 부모(엄마·아빠 모두). 시청 초는 add_watch_seconds로만.
create policy watch_plays_insert on youtube_bookmark.watch_plays for insert to authenticated
  with check (profile_id = youtube_bookmark.my_profile_id());
create policy watch_limits_insert on youtube_bookmark.watch_limits for insert to authenticated
  with check (youtube_bookmark.is_family_profile(profile_id));
create policy watch_limits_update on youtube_bookmark.watch_limits for update to authenticated
  using (youtube_bookmark.is_family_profile(profile_id)) with check (youtube_bookmark.is_family_profile(profile_id));
create policy watch_bonus_insert on youtube_bookmark.watch_bonus for insert to authenticated
  with check (youtube_bookmark.is_family_profile(profile_id));
create policy watch_bonus_update on youtube_bookmark.watch_bonus for update to authenticated
  using (youtube_bookmark.is_family_profile(profile_id)) with check (youtube_bookmark.is_family_profile(profile_id));
