-- ============================================================================
-- 개인용 데일리 관리 웹앱 — schema.sql
--
-- 이 파일은 위에서 아래로 순서대로, Supabase SQL Editor에서 한 번에 실행하세요.
-- (미스바 mizpah_ 테이블과 같은 프로젝트를 공유합니다. 이 파일은 daily_ 로
--  시작하는 객체만 생성/수정하며, 기존 mizpah_ 객체는 전혀 건드리지 않습니다.)
--
-- 실행 순서
--   0. 확장 기능
--   1. 테이블 생성 (daily_*)
--   2. Row Level Security 활성화 + anon/authenticated 권한 원천 차단
--   3. ⚠️ 앱 비밀번호(PIN) 설정  ← 반드시 값을 바꾸고 실행하세요
--   4. 확언(daily_affirmations) 예시 시드 데이터 (선택, 원치 않으면 건너뛰어도 됨)
--   5. RPC 함수 (SECURITY DEFINER) — 클라이언트는 오직 이 함수들로만 접근
--   6. 함수 실행 권한(GRANT) 부여
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. 확장 기능 (비밀번호 해시에 사용)
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 1. 테이블 생성
-- ----------------------------------------------------------------------------

-- 1-1. 앱 설정 (PIN 해시 등 키/값 저장)
create table if not exists daily_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- 1-2. 일기 (날짜별로 1인당 1건, 저장하면 홈 달력에 자동 X)
create table if not exists daily_diary (
  id          bigserial primary key,
  entry_date  date not null,
  content     text not null default '',
  user_name   text not null default '세훈',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (entry_date, user_name)
);

-- 1-3. 말씀 체크 (홈 달력에서 수동 터치로 X 표시)
create table if not exists daily_scripture_marks (
  mark_date   date not null,
  user_name   text not null default '세훈',
  created_at  timestamptz not null default now(),
  primary key (mark_date, user_name)
);

-- 1-4. 아침 기상 로그
create table if not exists daily_wake_logs (
  id          bigserial primary key,
  wake_date   date not null,
  wake_time   timestamptz not null default now(),
  user_name   text not null default '세훈',
  created_at  timestamptz not null default now(),
  unique (wake_date, user_name)
);

-- 1-5. 아침 확언 카드 (앱 내 관리 화면에서 등록/수정/삭제)
create table if not exists daily_affirmations (
  id          bigserial primary key,
  content     text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  user_name   text not null default '세훈',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1-6. 운동 기록 (세트 수, 총 시간, 랩타임 배열, 저장 시점에 자동 X)
--      크로스핏: 1세트 = 푸쉬업 10 / 풀업 5 / 스쿼트 15
--      플랭크: 1세트 = 플랭크 (첫 세트 1분10초, 이후 1분) + 휴식 1분 반복
create table if not exists daily_exercise_logs (
  id             bigserial primary key,
  log_date       date not null,
  exercise_type  text not null default 'crossfit', -- 'crossfit' | 'plank'
  total_sets     integer not null,
  total_seconds  numeric not null,
  laps           jsonb not null default '[]'::jsonb, -- [{set_no, lap_seconds, elapsed_seconds}, ...]
  user_name      text not null default '세훈',
  created_at     timestamptz not null default now()
);

-- 1-7. 중요 메모 (고정핀, 완료 처리 기능 포함)
create table if not exists daily_notes (
  id            bigserial primary key,
  content       text not null,
  is_pinned     boolean not null default false,
  is_completed  boolean not null default false,
  user_name     text not null default '세훈',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_daily_diary_date on daily_diary (entry_date);
create index if not exists idx_daily_scripture_marks_date on daily_scripture_marks (mark_date);
create index if not exists idx_daily_wake_logs_date on daily_wake_logs (wake_date);
create index if not exists idx_daily_exercise_logs_date on daily_exercise_logs (log_date);
create index if not exists idx_daily_exercise_logs_sets on daily_exercise_logs (exercise_type, total_sets, total_seconds);
create index if not exists idx_daily_notes_pinned on daily_notes (is_completed, is_pinned, updated_at desc);
create index if not exists idx_daily_affirmations_active on daily_affirmations (is_active, sort_order);


-- ----------------------------------------------------------------------------
-- 2. Row Level Security 활성화 + anon/authenticated 직접 접근 전면 차단
--    (정책을 하나도 만들지 않으므로 select/insert/update/delete 전부 기본 거부됩니다.
--     클라이언트는 아래 5번의 SECURITY DEFINER RPC 함수를 통해서만 데이터에 접근합니다.)
-- ----------------------------------------------------------------------------
alter table daily_settings         enable row level security;
alter table daily_diary            enable row level security;
alter table daily_scripture_marks  enable row level security;
alter table daily_wake_logs        enable row level security;
alter table daily_affirmations     enable row level security;
alter table daily_exercise_logs    enable row level security;
alter table daily_notes            enable row level security;

revoke all on daily_settings         from anon, authenticated;
revoke all on daily_diary            from anon, authenticated;
revoke all on daily_scripture_marks  from anon, authenticated;
revoke all on daily_wake_logs        from anon, authenticated;
revoke all on daily_affirmations     from anon, authenticated;
revoke all on daily_exercise_logs    from anon, authenticated;
revoke all on daily_notes            from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. ⚠️ 앱 비밀번호(PIN) 설정 — 반드시 아래 'CHANGE_ME_TO_YOUR_PIN' 을
--    원하는 숫자 PIN(예: '2608')으로 바꾼 뒤 이 블록을 실행하세요.
--    평문이 아니라 bcrypt 해시로 저장되며, 나중에 값을 바꾸고 싶으면
--    이 INSERT 문을 다시 실행하면 됩니다 (on conflict 로 갱신됩니다).
-- ----------------------------------------------------------------------------
insert into daily_settings (key, value)
values ('app_pin_hash', crypt('CHANGE_ME_TO_YOUR_PIN', gen_salt('bf')))
on conflict (key) do update set value = excluded.value, updated_at = now();


-- ----------------------------------------------------------------------------
-- 4. 확언 예시 시드 데이터 (선택 사항 — 필요 없으면 이 블록은 건너뛰어도 됩니다)
-- ----------------------------------------------------------------------------
insert into daily_affirmations (content, sort_order)
select * from (values
  ('나는 오늘도 성실하게 하루를 시작한다.', 1),
  ('나는 흔들리지 않는 중심을 가지고 있다.', 2),
  ('나는 매일 조금씩 더 나아지고 있다.', 3)
) as seed(content, sort_order)
where not exists (select 1 from daily_affirmations);


-- ----------------------------------------------------------------------------
-- 5. RPC 함수 (전부 SECURITY DEFINER, 첫 인자는 p_pin)
--    내부에서 daily_verify_pin() 으로 비밀번호를 검증하고, 실패 시 즉시 예외를 던집니다.
-- ----------------------------------------------------------------------------

-- 5-0. 내부 전용 PIN 검증 함수 (클라이언트에는 직접 GRANT 하지 않음)
create or replace function daily_verify_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select value into v_hash from daily_settings where key = 'app_pin_hash';

  if v_hash is null then
    raise exception 'PIN이 설정되지 않았습니다. schema.sql 3번 항목을 실행하세요.';
  end if;

  if p_pin is null or crypt(p_pin, v_hash) <> v_hash then
    raise exception '비밀번호가 올바르지 않습니다.';
  end if;
end;
$$;

-- 5-1. 로그인 (PIN 확인용, 성공하면 true 반환)
create or replace function daily_login(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform daily_verify_pin(p_pin);
  return true;
end;
$$;

-- 5-2. 홈 달력: 특정 연/월의 일기·운동·말씀 X 날짜와 개수를 한 번에 반환
create or replace function daily_get_calendar_month(p_pin text, p_year int, p_month int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := make_date(p_year, p_month, 1);
  v_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_diary_dates jsonb;
  v_exercise_dates jsonb;
  v_scripture_dates jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(dt order by dt), '[]'::jsonb) into v_diary_dates
  from (select distinct entry_date as dt from daily_diary
        where entry_date >= v_start and entry_date < v_end) s;

  select coalesce(jsonb_agg(dt order by dt), '[]'::jsonb) into v_exercise_dates
  from (select distinct log_date as dt from daily_exercise_logs
        where log_date >= v_start and log_date < v_end) s;

  select coalesce(jsonb_agg(dt order by dt), '[]'::jsonb) into v_scripture_dates
  from (select distinct mark_date as dt from daily_scripture_marks
        where mark_date >= v_start and mark_date < v_end) s;

  return jsonb_build_object(
    'diary_dates', v_diary_dates,
    'exercise_dates', v_exercise_dates,
    'scripture_dates', v_scripture_dates,
    'diary_count', jsonb_array_length(v_diary_dates),
    'exercise_count', jsonb_array_length(v_exercise_dates),
    'scripture_count', jsonb_array_length(v_scripture_dates)
  );
end;
$$;

-- 5-3. 말씀 X 토글 (홈 달력에서 날짜 터치) — 결과로 새 상태(true=체크됨)를 반환
create or replace function daily_toggle_scripture(p_pin text, p_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  perform daily_verify_pin(p_pin);

  select exists(select 1 from daily_scripture_marks where mark_date = p_date and user_name = '세훈')
  into v_exists;

  if v_exists then
    delete from daily_scripture_marks where mark_date = p_date and user_name = '세훈';
    return false;
  else
    insert into daily_scripture_marks (mark_date, user_name) values (p_date, '세훈');
    return true;
  end if;
end;
$$;

-- 5-4. 일기 저장/수정 (같은 날짜면 덮어쓰기)
create or replace function daily_upsert_diary(p_pin text, p_date date, p_content text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_diary;
begin
  perform daily_verify_pin(p_pin);

  insert into daily_diary (entry_date, content, user_name)
  values (p_date, coalesce(p_content, ''), '세훈')
  on conflict (entry_date, user_name)
  do update set content = excluded.content, updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- 5-5. 특정 날짜 일기 조회
create or replace function daily_get_diary(p_pin text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_diary;
begin
  perform daily_verify_pin(p_pin);

  select * into v_row from daily_diary where entry_date = p_date and user_name = '세훈';

  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- 5-6. 과거 일기 목록 (최신순, 페이지네이션)
create or replace function daily_list_diary(p_pin text, p_limit int default 30, p_offset int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select id, entry_date, content, updated_at
    from daily_diary
    order by entry_date desc
    limit p_limit offset p_offset
  ) t;

  return v_result;
end;
$$;

-- 5-6b. 특정 연/월의 일기 목록 (달력 뷰: 날짜 + 내용, 미리보기 표시용)
create or replace function daily_list_diary_month(p_pin text, p_year int, p_month int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := make_date(p_year, p_month, 1);
  v_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select entry_date, content
    from daily_diary
    where entry_date >= v_start and entry_date < v_end
    order by entry_date asc
  ) t;

  return v_result;
end;
$$;

-- 5-7. 오늘 기상 기록 저장 (다시 누르면 시각 갱신)
create or replace function daily_log_wake(p_pin text, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_wake_logs;
begin
  perform daily_verify_pin(p_pin);

  insert into daily_wake_logs (wake_date, wake_time, user_name)
  values (p_date, now(), '세훈')
  on conflict (wake_date, user_name)
  do update set wake_time = excluded.wake_time
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- 5-8. 특정 날짜 기상 기록 조회
create or replace function daily_get_wake(p_pin text, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_wake_logs;
begin
  perform daily_verify_pin(p_pin);

  select * into v_row from daily_wake_logs where wake_date = p_date and user_name = '세훈';

  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- 5-8b. 특정 연/월의 기상 기록 목록 — 아침 루틴 화면의 인라인 달력용
create or replace function daily_list_wake_month(p_pin text, p_year int, p_month int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := make_date(p_year, p_month, 1);
  v_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select wake_date, wake_time
    from daily_wake_logs
    where wake_date >= v_start and wake_date < v_end
    order by wake_date asc
  ) t;

  return v_result;
end;
$$;

-- 5-8c. 기상 시각을 직접 지정/수정/삭제 (달력에서 날짜를 눌러 보정할 때 사용,
--       p_wake_time 이 null 이면 해당 날짜 기록을 삭제)
create or replace function daily_set_wake_time(p_pin text, p_date date, p_wake_time timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_wake_logs;
begin
  perform daily_verify_pin(p_pin);

  if p_wake_time is null then
    delete from daily_wake_logs where wake_date = p_date and user_name = '세훈';
    return null;
  end if;

  insert into daily_wake_logs (wake_date, wake_time, user_name)
  values (p_date, p_wake_time, '세훈')
  on conflict (wake_date, user_name)
  do update set wake_time = excluded.wake_time
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- 5-9. 확언 카드 목록 (아침 루틴 화면, 활성인 것만 순서대로)
create or replace function daily_get_affirmations(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select id, content, sort_order
    from daily_affirmations
    where is_active = true
    order by sort_order asc, id asc
  ) t;

  return v_result;
end;
$$;

-- 5-10. 확언 관리 목록 (관리 화면, 비활성 포함 전체)
create or replace function daily_admin_list_affirmations(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select id, content, sort_order, is_active
    from daily_affirmations
    order by sort_order asc, id asc
  ) t;

  return v_result;
end;
$$;

-- 5-11. 확언 등록/수정 (p_id 가 null 이면 신규 등록)
create or replace function daily_upsert_affirmation(
  p_pin text,
  p_id bigint,
  p_content text,
  p_sort_order int default 0,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_affirmations;
begin
  perform daily_verify_pin(p_pin);

  if p_id is null then
    insert into daily_affirmations (content, sort_order, is_active, user_name)
    values (p_content, coalesce(p_sort_order, 0), coalesce(p_is_active, true), '세훈')
    returning * into v_row;
  else
    update daily_affirmations
    set content = p_content,
        sort_order = coalesce(p_sort_order, sort_order),
        is_active = coalesce(p_is_active, is_active),
        updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

-- 5-12. 확언 삭제
create or replace function daily_delete_affirmation(p_pin text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform daily_verify_pin(p_pin);
  delete from daily_affirmations where id = p_id;
end;
$$;

-- 5-13. 운동 기록 저장 + 같은 종목/세트 수 부문 내 순위 계산해서 반환
--       (크로스핏 1세트 = 푸쉬업 10 / 풀업 5 / 스쿼트 15, 플랭크는 p_exercise_type='plank')
create or replace function daily_save_exercise(
  p_pin text,
  p_date date,
  p_total_sets int,
  p_total_seconds numeric,
  p_laps jsonb default '[]'::jsonb,
  p_exercise_type text default 'crossfit'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_rank int;
  v_total_in_group int;
begin
  perform daily_verify_pin(p_pin);

  insert into daily_exercise_logs (log_date, total_sets, total_seconds, laps, user_name, exercise_type)
  values (p_date, p_total_sets, p_total_seconds, coalesce(p_laps, '[]'::jsonb), '세훈', coalesce(p_exercise_type, 'crossfit'))
  returning id into v_id;

  select count(*) + 1 into v_rank
  from daily_exercise_logs
  where exercise_type = coalesce(p_exercise_type, 'crossfit')
    and total_sets = p_total_sets
    and total_seconds < p_total_seconds
    and id <> v_id;

  select count(*) into v_total_in_group
  from daily_exercise_logs
  where exercise_type = coalesce(p_exercise_type, 'crossfit')
    and total_sets = p_total_sets;

  return jsonb_build_object(
    'id', v_id,
    'rank', v_rank,
    'total_in_group', v_total_in_group,
    'is_best', v_rank = 1
  );
end;
$$;

-- 5-14. 운동 기록 랭킹 목록 (p_set_count 를 지정하면 해당 세트 수 부문만, 종목은 p_exercise_type 기준)
create or replace function daily_list_exercise_records(p_pin text, p_set_count int default null, p_exercise_type text default 'crossfit')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select id, log_date, total_sets, total_seconds, laps,
           row_number() over (partition by total_sets order by total_seconds asc, id asc) as rank
    from daily_exercise_logs
    where exercise_type = coalesce(p_exercise_type, 'crossfit')
      and (p_set_count is null or total_sets = p_set_count)
    order by total_sets asc, rank asc
  ) t;

  return v_result;
end;
$$;

-- 5-15. 존재하는 세트 수 부문 목록 (랭킹 화면 필터용, 종목은 p_exercise_type 기준)
create or replace function daily_list_exercise_set_counts(p_pin text, p_exercise_type text default 'crossfit')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select total_sets, count(*) as record_count
    from daily_exercise_logs
    where exercise_type = coalesce(p_exercise_type, 'crossfit')
    group by total_sets
    order by total_sets asc
  ) t;

  return v_result;
end;
$$;

-- 5-15b. 특정 날짜의 운동 기록 목록 (종목별, 오늘 기록 표시 + 삭제 용도)
create or replace function daily_list_exercise_logs_by_date(p_pin text, p_date date, p_exercise_type text default 'crossfit')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t order by created_at desc), '[]'::jsonb) into v_result
  from (
    select id, log_date, total_sets, total_seconds, laps, created_at
    from daily_exercise_logs
    where log_date = p_date
      and exercise_type = coalesce(p_exercise_type, 'crossfit')
  ) t;

  return v_result;
end;
$$;

-- 5-16. 중요 메모 목록 (미완료 먼저, 그 안에서 고정핀 먼저, 그 다음 최신순 / 완료된 메모는 맨 아래로)
create or replace function daily_list_notes(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform daily_verify_pin(p_pin);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_result
  from (
    select id, content, is_pinned, is_completed, created_at, updated_at
    from daily_notes
    order by is_completed asc, is_pinned desc, updated_at desc
  ) t;

  return v_result;
end;
$$;

-- 5-17. 메모 등록/수정 (p_id 가 null 이면 신규 등록, p_is_completed 를 null로 주면 기존 값 유지)
drop function if exists daily_upsert_note(text, bigint, text, boolean);

create or replace function daily_upsert_note(
  p_pin text,
  p_id bigint,
  p_content text,
  p_is_pinned boolean default false,
  p_is_completed boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row daily_notes;
begin
  perform daily_verify_pin(p_pin);

  if p_id is null then
    insert into daily_notes (content, is_pinned, is_completed, user_name)
    values (p_content, coalesce(p_is_pinned, false), coalesce(p_is_completed, false), '세훈')
    returning * into v_row;
  else
    update daily_notes
    set content = p_content,
        is_pinned = coalesce(p_is_pinned, is_pinned),
        is_completed = coalesce(p_is_completed, is_completed),
        updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

-- 5-18. 메모 삭제
create or replace function daily_delete_note(p_pin text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform daily_verify_pin(p_pin);
  delete from daily_notes where id = p_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. 함수 실행 권한 부여
--    (daily_verify_pin 은 클라이언트에서 직접 호출할 필요가 없으므로 GRANT 하지 않습니다.
--     다른 SECURITY DEFINER 함수 내부에서 호출될 때는 함수 소유자 권한으로 실행되므로
--     별도 GRANT 없이도 정상 동작합니다.)
-- ----------------------------------------------------------------------------
revoke execute on function daily_verify_pin(text) from public, anon, authenticated;

grant execute on function daily_login(text) to anon;
grant execute on function daily_get_calendar_month(text, int, int) to anon;
grant execute on function daily_toggle_scripture(text, date) to anon;
grant execute on function daily_upsert_diary(text, date, text) to anon;
grant execute on function daily_get_diary(text, date) to anon;
grant execute on function daily_list_diary(text, int, int) to anon;
grant execute on function daily_list_diary_month(text, int, int) to anon;
grant execute on function daily_log_wake(text, date) to anon;
grant execute on function daily_get_wake(text, date) to anon;
grant execute on function daily_list_wake_month(text, int, int) to anon;
grant execute on function daily_set_wake_time(text, date, timestamptz) to anon;
grant execute on function daily_get_affirmations(text) to anon;
grant execute on function daily_admin_list_affirmations(text) to anon;
grant execute on function daily_upsert_affirmation(text, bigint, text, int, boolean) to anon;
grant execute on function daily_delete_affirmation(text, bigint) to anon;
grant execute on function daily_save_exercise(text, date, int, numeric, jsonb, text) to anon;
grant execute on function daily_list_exercise_records(text, int, text) to anon;
grant execute on function daily_list_exercise_set_counts(text, text) to anon;
grant execute on function daily_list_exercise_logs_by_date(text, date, text) to anon;
grant execute on function daily_list_notes(text) to anon;
grant execute on function daily_upsert_note(text, bigint, text, boolean, boolean) to anon;
grant execute on function daily_delete_note(text, bigint) to anon;

-- ============================================================================
-- 끝. 여기까지 실행하면 앱을 바로 사용할 수 있습니다.
-- PIN을 나중에 바꾸고 싶다면 3번 블록만 다시 실행하세요.
-- ============================================================================
