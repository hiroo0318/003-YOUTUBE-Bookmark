-- 채널담 초기 스키마 (youtube_bookmark)
-- 같은 Supabase 프로젝트의 다른 앱 스키마와 분리한다. anon에는 권한을 주지 않는다.

grant usage on schema youtube_bookmark to authenticated, service_role;

-- ───────────────────────── 테이블 ─────────────────────────

create table youtube_bookmark.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 가족',
  created_at timestamptz not null default now()
);

create table youtube_bookmark.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references youtube_bookmark.families(id) on delete cascade,
  email text not null,
  role text not null check (role in ('parent', 'child')),
  display_name text not null,
  is_owner boolean not null default false,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index members_email_key on youtube_bookmark.members (lower(email));
create index members_family_idx on youtube_bookmark.members (family_id);

create table youtube_bookmark.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references youtube_bookmark.families(id) on delete cascade,
  member_id uuid not null unique references youtube_bookmark.members(id) on delete cascade,
  display_name text not null,
  approval_mode boolean not null default true,
  created_at timestamptz not null default now()
);
create index child_profiles_family_idx on youtube_bookmark.child_profiles (family_id);

-- 'none'은 행이 없는 상태다.
create table youtube_bookmark.channel_states (
  profile_id uuid not null references youtube_bookmark.child_profiles(id) on delete cascade,
  channel_id text not null,
  status text not null check (status in ('approved', 'rejected')),
  decided_by uuid references youtube_bookmark.members(id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (profile_id, channel_id)
);
create index channel_states_channel_idx on youtube_bookmark.channel_states (channel_id) where status = 'approved';

create table youtube_bookmark.channel_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references youtube_bookmark.families(id) on delete cascade,
  profile_id uuid not null references youtube_bookmark.child_profiles(id) on delete cascade,
  channel_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  trigger_video_ids text[] not null default '{}',
  last_trigger_video_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references youtube_bookmark.members(id) on delete set null,
  seen_by_child boolean not null default true
);
create unique index channel_requests_one_pending on youtube_bookmark.channel_requests (profile_id, channel_id) where status = 'pending';
create index channel_requests_family_idx on youtube_bookmark.channel_requests (family_id, status, updated_at desc);

-- YouTube 데이터 캐시: 채널 단위로 가족이 공유한다. 30일 안에 갱신하거나 삭제한다.
create table youtube_bookmark.yt_channel_cache (
  channel_id text primary key,
  title text not null,
  thumbnail_url text,
  uploads_playlist_id text,
  fetched_at timestamptz not null default now(),
  videos_fetched_at timestamptz
);

create table youtube_bookmark.yt_video_cache (
  video_id text primary key,
  channel_id text not null,
  title text not null,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds integer,
  made_for_kids boolean,
  embeddable boolean,
  playable boolean not null default true,
  fetched_at timestamptz not null default now()
);
create index yt_video_cache_channel_idx on youtube_bookmark.yt_video_cache (channel_id, published_at desc);

create table youtube_bookmark.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references youtube_bookmark.members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- 가족 전체 search.list 사용 횟수(태평양 시간 기준 날짜)
create table youtube_bookmark.search_usage (
  day date primary key,
  count integer not null default 0
);

-- ───────────────────────── 도우미 함수 ─────────────────────────

create or replace function youtube_bookmark.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from youtube_bookmark.members where auth_user_id = auth.uid()
$$;

create or replace function youtube_bookmark.my_family_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from youtube_bookmark.members where auth_user_id = auth.uid()
$$;

create or replace function youtube_bookmark.is_parent() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from youtube_bookmark.members where auth_user_id = auth.uid() and role = 'parent')
$$;

create or replace function youtube_bookmark.my_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from youtube_bookmark.child_profiles p
  join youtube_bookmark.members m on m.id = p.member_id
  where m.auth_user_id = auth.uid()
$$;

-- 아이 구성원을 등록하면 프로필을 함께 만든다.
create or replace function youtube_bookmark.tg_member_child_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'child' then
    insert into youtube_bookmark.child_profiles (family_id, member_id, display_name)
    values (new.family_id, new.id, new.display_name)
    on conflict (member_id) do update set display_name = excluded.display_name;
  end if;
  return new;
end $$;
create trigger member_child_profile after insert or update of role, display_name on youtube_bookmark.members
for each row execute function youtube_bookmark.tg_member_child_profile();

-- 마지막 부모는 삭제하거나 아이로 바꿀 수 없다.
create or replace function youtube_bookmark.tg_keep_last_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'parent' and (tg_op = 'DELETE' or new.role <> 'parent') then
    if not exists (
      select 1 from youtube_bookmark.members
      where family_id = old.family_id and role = 'parent' and id <> old.id
    ) then
      raise exception 'LAST_PARENT' using hint = '마지막 부모는 삭제하거나 권한을 바꿀 수 없어요.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger keep_last_parent before update of role or delete on youtube_bookmark.members
for each row execute function youtube_bookmark.tg_keep_last_parent();

-- ───────────────────────── RPC ─────────────────────────

-- 로그인한 Google 이메일과 등록된 구성원을 연결한다.
create or replace function youtube_bookmark.link_my_member()
returns table (member_id uuid, role text, profile_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_email = '' then
    return;
  end if;
  update youtube_bookmark.members m
     set auth_user_id = auth.uid()
   where lower(m.email) = v_email and m.auth_user_id is null;

  return query
    select m.id, m.role, p.id
      from youtube_bookmark.members m
      left join youtube_bookmark.child_profiles p on p.member_id = m.id
     where m.auth_user_id = auth.uid();
end $$;

-- 아이: 채널 추가 요청. 대기 중이면 계기 영상만 더한다.
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

-- 부모: 대기 요청 승인·거절
create or replace function youtube_bookmark.decide_request(p_request_id uuid, p_decision text)
returns youtube_bookmark.channel_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_me youtube_bookmark.members;
  v_req youtube_bookmark.channel_requests;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'BAD_DECISION';
  end if;
  select * into v_me from youtube_bookmark.members where auth_user_id = auth.uid() and role = 'parent';
  if v_me.id is null then
    raise exception 'NOT_PARENT';
  end if;
  select * into v_req from youtube_bookmark.channel_requests
   where id = p_request_id and family_id = v_me.family_id for update;
  if v_req.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_DECIDED';
  end if;

  update youtube_bookmark.channel_requests
     set status = p_decision, decided_at = now(), decided_by = v_me.id, updated_at = now(), seen_by_child = false
   where id = p_request_id
   returning * into v_req;

  insert into youtube_bookmark.channel_states (profile_id, channel_id, status, decided_by, decided_at)
  values (v_req.profile_id, v_req.channel_id, p_decision, v_me.id, now())
  on conflict (profile_id, channel_id) do update
    set status = excluded.status, decided_by = excluded.decided_by, decided_at = excluded.decided_at;

  return v_req;
end $$;

-- 부모: 채널 상태 직접 변경 (승인 / 거절 / 'none' = 승인 취소·거절 해제)
create or replace function youtube_bookmark.set_channel_state(p_profile_id uuid, p_channel_id text, p_status text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me youtube_bookmark.members;
begin
  if p_status not in ('approved', 'rejected', 'none') then
    raise exception 'BAD_STATUS';
  end if;
  select * into v_me from youtube_bookmark.members where auth_user_id = auth.uid() and role = 'parent';
  if v_me.id is null then
    raise exception 'NOT_PARENT';
  end if;
  if not exists (select 1 from youtube_bookmark.child_profiles where id = p_profile_id and family_id = v_me.family_id) then
    raise exception 'NOT_FOUND';
  end if;

  if p_status = 'none' then
    delete from youtube_bookmark.channel_states where profile_id = p_profile_id and channel_id = p_channel_id;
    return;
  end if;

  insert into youtube_bookmark.channel_states (profile_id, channel_id, status, decided_by, decided_at)
  values (p_profile_id, p_channel_id, p_status, v_me.id, now())
  on conflict (profile_id, channel_id) do update
    set status = excluded.status, decided_by = excluded.decided_by, decided_at = excluded.decided_at;

  -- 대기 중인 요청이 있으면 같은 결과로 닫는다.
  update youtube_bookmark.channel_requests
     set status = p_status, decided_at = now(), decided_by = v_me.id, updated_at = now(), seen_by_child = false
   where profile_id = p_profile_id and channel_id = p_channel_id and status = 'pending';
end $$;

-- 아이: 결과 확인 표시
create or replace function youtube_bookmark.mark_requests_seen()
returns void
language sql security definer set search_path = '' as $$
  update youtube_bookmark.channel_requests r
     set seen_by_child = true
   where r.profile_id = youtube_bookmark.my_profile_id() and r.seen_by_child = false;
$$;

-- ───────────────────────── 권한 · RLS ─────────────────────────

alter table youtube_bookmark.families enable row level security;
alter table youtube_bookmark.members enable row level security;
alter table youtube_bookmark.child_profiles enable row level security;
alter table youtube_bookmark.channel_states enable row level security;
alter table youtube_bookmark.channel_requests enable row level security;
alter table youtube_bookmark.yt_channel_cache enable row level security;
alter table youtube_bookmark.yt_video_cache enable row level security;
alter table youtube_bookmark.push_subscriptions enable row level security;
alter table youtube_bookmark.search_usage enable row level security;

grant select, insert, update, delete on all tables in schema youtube_bookmark to service_role;
grant select on all tables in schema youtube_bookmark to authenticated;
grant insert (family_id, email, role, display_name) on youtube_bookmark.members to authenticated;
grant update (role, display_name) on youtube_bookmark.members to authenticated;
grant delete on youtube_bookmark.members to authenticated;
grant update (display_name, approval_mode) on youtube_bookmark.child_profiles to authenticated;
grant insert, delete on youtube_bookmark.push_subscriptions to authenticated;

revoke all on all functions in schema youtube_bookmark from public, anon;
grant execute on all functions in schema youtube_bookmark to authenticated, service_role;

-- families
create policy families_select on youtube_bookmark.families for select to authenticated
  using (id = youtube_bookmark.my_family_id());

-- members: 부모는 가족 전체, 아이는 자기 행만
create policy members_select on youtube_bookmark.members for select to authenticated
  using (
    auth_user_id = auth.uid()
    or (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id())
  );
create policy members_insert on youtube_bookmark.members for insert to authenticated
  with check (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id() and is_owner = false);
create policy members_update on youtube_bookmark.members for update to authenticated
  using (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id())
  with check (family_id = youtube_bookmark.my_family_id());
create policy members_delete on youtube_bookmark.members for delete to authenticated
  using (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id() and is_owner = false);

-- child_profiles
create policy profiles_select on youtube_bookmark.child_profiles for select to authenticated
  using (
    id = youtube_bookmark.my_profile_id()
    or (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id())
  );
create policy profiles_update on youtube_bookmark.child_profiles for update to authenticated
  using (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id())
  with check (family_id = youtube_bookmark.my_family_id());

-- channel_states: 읽기만. 변경은 RPC로
create policy states_select on youtube_bookmark.channel_states for select to authenticated
  using (
    profile_id = youtube_bookmark.my_profile_id()
    or (youtube_bookmark.is_parent() and profile_id in (
      select id from youtube_bookmark.child_profiles where family_id = youtube_bookmark.my_family_id()))
  );

-- channel_requests: 읽기만. 변경은 RPC로
create policy requests_select on youtube_bookmark.channel_requests for select to authenticated
  using (
    profile_id = youtube_bookmark.my_profile_id()
    or (youtube_bookmark.is_parent() and family_id = youtube_bookmark.my_family_id())
  );

-- 캐시: 등록된 가족 구성원만 읽기. 쓰기는 서버(service role)만
create policy channel_cache_select on youtube_bookmark.yt_channel_cache for select to authenticated
  using (youtube_bookmark.my_family_id() is not null);
create policy video_cache_select on youtube_bookmark.yt_video_cache for select to authenticated
  using (youtube_bookmark.my_family_id() is not null);

-- 푸시 구독: 본인 것만
create policy push_select on youtube_bookmark.push_subscriptions for select to authenticated
  using (member_id = youtube_bookmark.my_member_id());
create policy push_insert on youtube_bookmark.push_subscriptions for insert to authenticated
  with check (member_id = youtube_bookmark.my_member_id());
create policy push_delete on youtube_bookmark.push_subscriptions for delete to authenticated
  using (member_id = youtube_bookmark.my_member_id());

-- 검색 사용량: 부모만 읽기
create policy usage_select on youtube_bookmark.search_usage for select to authenticated
  using (youtube_bookmark.is_parent());
