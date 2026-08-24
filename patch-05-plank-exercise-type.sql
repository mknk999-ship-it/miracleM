-- ============================================================================
-- patch-05-plank-exercise-type.sql
--
-- schema.sql / patch-01~04 를 이미 실행한 기존 DB에 그대로 덧붙여 실행하는
-- 패치입니다. schema.sql 자체는 수정하지 않아도 되지만(이미 최신 내용으로
-- 갱신되어 있음), 새로 설치하는 경우 이 패치는 필요 없습니다. Supabase
-- SQL Editor에 이 파일 전체를 붙여넣고 실행하세요 (전부 IF NOT EXISTS /
-- CREATE OR REPLACE 패턴이라 여러 번 실행해도 안전합니다).
--
-- 내용: 플랭크 운동 기록 지원
--   1. daily_exercise_logs 에 exercise_type 컬럼 추가 (기존 행은 전부 'crossfit')
--   2. daily_save_exercise / daily_list_exercise_records /
--      daily_list_exercise_set_counts 에 p_exercise_type 파라미터 추가
--      (기본값 'crossfit' 이므로 기존 크로스핏 랭킹 동작은 그대로 유지됩니다)
--   3. daily_list_exercise_logs_by_date 신규 (오늘 기록 조회 + 삭제용,
--      삭제 자체는 기존 daily_delete_exercise_log 를 그대로 재사용합니다)
--   4. 홈 달력의 운동 X 표시(daily_get_calendar_month)는 종목 구분 없이
--      daily_exercise_logs 존재 여부만 보므로, 플랭크를 저장해도 별도 수정
--      없이 자동으로 X 표시가 붙습니다.
-- ============================================================================


-- 1. exercise_type 컬럼 추가
alter table daily_exercise_logs add column if not exists exercise_type text not null default 'crossfit';

drop index if exists idx_daily_exercise_logs_sets;
create index if not exists idx_daily_exercise_logs_sets on daily_exercise_logs (exercise_type, total_sets, total_seconds);


-- 2. 운동 기록 저장 (p_exercise_type 파라미터 추가, 순위도 종목별로 계산)
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


-- 3. 운동 기록 랭킹 목록 (p_exercise_type 파라미터 추가, 기본값 'crossfit')
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


-- 4. 존재하는 세트 수 부문 목록 (p_exercise_type 파라미터 추가, 기본값 'crossfit')
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


-- 5. 특정 날짜의 운동 기록 목록 (종목별, "오늘 기록" 표시 + 삭제 용도)
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


-- 6. 실행 권한 부여
grant execute on function daily_save_exercise(text, date, int, numeric, jsonb, text) to anon;
grant execute on function daily_list_exercise_records(text, int, text) to anon;
grant execute on function daily_list_exercise_set_counts(text, text) to anon;
grant execute on function daily_list_exercise_logs_by_date(text, date, text) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
