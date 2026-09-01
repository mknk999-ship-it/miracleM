-- ============================================================================
-- patch-07-exercise-history-month.sql
--
-- schema.sql / patch-01~06 를 이미 실행한 기존 DB에 그대로 덧붙여 실행하는
-- 패치입니다. schema.sql 자체는 수정하지 않아도 되지만(이미 최신 내용으로
-- 갱신되어 있음), 새로 설치하는 경우 이 패치는 필요 없습니다. Supabase
-- SQL Editor에 이 파일 전체를 붙여넣고 실행하세요 (CREATE OR REPLACE 방식이라
-- 여러 번 실행해도 안전합니다).
--
-- 내용: 크로스핏/플랭크 "날짜별 기록" 화면을 리스트 대신 달력 형태로 바꾸기
-- 위한 신규 RPC 추가
--   - daily_list_exercise_logs_month(p_pin, p_year, p_month, p_exercise_type):
--     특정 연/월, 종목의 운동 기록을 전부 반환 (날짜별로 묶어서 그 날의
--     총 세트 수/총 시간을 달력 칸에 표시하는 용도, 앱에서 날짜별로 합산함)
-- ============================================================================


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
    select id, log_date, total_sets, total_seconds, created_at
    from daily_exercise_logs
    where log_date >= v_start and log_date < v_end
      and exercise_type = coalesce(p_exercise_type, 'crossfit')
  ) t;

  return v_result;
end;
$$;

grant execute on function daily_list_exercise_logs_month(text, int, int, text) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
