-- 채널 상태 변경 이력 (2026-10-17)
-- 승인·거절(요청 처리·직접), 승인 취소, 거절 풀기를 누가 언제 했는지 남긴다. channel_states의 변경을 트리거로 기록해 빠짐이 없다.
create table if not exists youtube_bookmark.channel_state_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references youtube_bookmark.families (id) on delete cascade,
  profile_id uuid not null references youtube_bookmark.child_profiles (id) on delete cascade,
  channel_id text not null,
  action text not null check (action in ('approved', 'rejected', 'approval_cancelled', 'rejection_cleared')),
  actor_member_id uuid references youtube_bookmark.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists channel_state_log_family_time_idx on youtube_bookmark.channel_state_log (family_id, created_at desc);
create index if not exists channel_state_log_profile_channel_idx on youtube_bookmark.channel_state_log (profile_id, channel_id, created_at desc);

create or replace function youtube_bookmark.tg_channel_state_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid;
begin
  if tg_op = 'DELETE' then
    select p.family_id into v_family from youtube_bookmark.child_profiles p where p.id = old.profile_id;
    if v_family is not null then
      insert into youtube_bookmark.channel_state_log (family_id, profile_id, channel_id, action, actor_member_id)
      values (v_family, old.profile_id, old.channel_id,
              case when old.status = 'approved' then 'approval_cancelled' else 'rejection_cleared' end,
              youtube_bookmark.my_member_id());
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select p.family_id into v_family from youtube_bookmark.child_profiles p where p.id = new.profile_id;
  insert into youtube_bookmark.channel_state_log (family_id, profile_id, channel_id, action, actor_member_id)
  values (v_family, new.profile_id, new.channel_id, new.status, coalesce(new.decided_by, youtube_bookmark.my_member_id()));
  return new;
end;
$$;

drop trigger if exists channel_state_log_trg on youtube_bookmark.channel_states;
create trigger channel_state_log_trg
  after insert or update or delete on youtube_bookmark.channel_states
  for each row execute function youtube_bookmark.tg_channel_state_log();

-- 지금 상태를 이력의 시작점으로 넣는다(이전의 승인 취소 등은 기록이 없어 되살릴 수 없다).
insert into youtube_bookmark.channel_state_log (family_id, profile_id, channel_id, action, actor_member_id, created_at)
select p.family_id, s.profile_id, s.channel_id, s.status, s.decided_by, s.decided_at
  from youtube_bookmark.channel_states s
  join youtube_bookmark.child_profiles p on p.id = s.profile_id
 where not exists (select 1 from youtube_bookmark.channel_state_log l
                    where l.profile_id = s.profile_id and l.channel_id = s.channel_id);

alter table youtube_bookmark.channel_state_log enable row level security;
grant select, insert, update, delete on youtube_bookmark.channel_state_log to service_role;
grant select on youtube_bookmark.channel_state_log to authenticated;
revoke all on function youtube_bookmark.tg_channel_state_log() from public, anon;

-- 부모만 가족 아이 이력을 읽는다. 쓰기는 트리거로만.
create policy channel_state_log_select on youtube_bookmark.channel_state_log for select to authenticated
  using (youtube_bookmark.is_family_profile(profile_id));
