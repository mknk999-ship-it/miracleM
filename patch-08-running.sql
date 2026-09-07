-- ============================================================================
-- patch-08-running.sql
--
-- schema.sql / patch-01~07 를 이미 실행한 기존 DB에 그대로 덧붙여 실행하는
-- 패치입니다. schema.sql 자체는 수정하지 않아도 되지만(이미 최신 내용으로
-- 갱신되어 있음), 새로 설치하는 경우 이 패치는 필요 없습니다. Supabase
-- SQL Editor에 이 파일 전체를 붙여넣고 실행하세요 (전부 IF NOT EXISTS /
-- CREATE OR REPLACE 패턴이라 여러 번 실행해도 안전합니다).
--
-- 내용: 달리기(러닝) 운동 기록 지원
--   1. daily_exercise_logs 에 distance_km 컬럼 추가 (달리기 전용, 그 외는 null)
--   2. daily_save_exercise 에 p_distance_km 파라미터 추가
--   3. daily_list_exercise_logs_by_date / daily_list_exercise_logs_month 에서
--      distance_km 도 함께 반환하도록 갱신
--   4. 홈 달력의 운동 X 표시(daily_get_calendar_month)는 종목 구분 없이
--      daily_exercise_logs 존재 여부만 보므로, 달리기를 저장해도 별도 수정
--      없이 자동으로 X 표시가 붙습니다.
-- ============================================================================


-- 1. distance_km 컬럼 추가
alter table daily_exercise_logs add column if not exists distance_km numeric;


-- 2. 운동 기록 저장 (p_distance_km 파라미터 추가)
create or replace function daily_save_exercise(
  p_pin text,
  p_date date,
  p_total_sets int,
  p_total_seconds numeric,
  p_laps jsonb default '[]'::jsonb,
  p_exercise_type text default 'crossfit',
  p_distance_km numeric default null
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

  insert into daily_exercise_logs (log_date, total_sets, total_seconds, laps, user_name, exercise_type, distance_km)
  values (p_date, p_total_sets, p_total_seconds, coalesce(p_laps, '[]'::jsonb), '세훈', coalesce(p_exercise_type, 'crossfit'), p_distance_km)
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


-- 3. 특정 날짜의 운동 기록 목록 (distance_km 포함)
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
    select id, log_date, total_sets, total_seconds, distance_km, laps, created_at
    from daily_exercise_logs
    where log_date = p_date
      and exercise_type = coalesce(p_exercise_type, 'crossfit')
  ) t;

  return v_result;
end;
$$;


-- 4. 특정 연/월의 운동 기록 목록 (distance_km 포함)
create or replace function daily_list_exercise_logs_month(p_pin text, p_year int, p_month int, p_exercise_type text default 'crossfit')
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

  select coalesce(jsonb_agg(t order by log_date asc, created_at asc), '[]'::jsonb) into v_result
  from (
    select id, log_date, total_sets, total_seconds, distance_km, created_at
    from daily_exercise_logs
    where log_date >= v_start and log_date < v_end
      and exercise_type = coalesce(p_exercise_type, 'crossfit')
  ) t;

  return v_result;
end;
$$;


-- 5. 실행 권한 부여
grant execute on function daily_save_exercise(text, date, int, numeric, jsonb, text, numeric) to anon;
grant execute on function daily_list_exercise_logs_by_date(text, date, text) to anon;
grant execute on function daily_list_exercise_logs_month(text, int, int, text) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
