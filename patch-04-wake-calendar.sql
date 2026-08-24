-- ============================================================================
-- patch-04-wake-calendar.sql
--
-- 기존 DB에 그대로 덧붙여 실행하는 패치입니다. schema.sql 자체는 수정하지
-- 않습니다 (schema.sql은 이미 최신 내용으로 갱신되어 있으므로, 새로 설치하는
-- 경우 이 패치는 필요 없습니다). Supabase SQL Editor에 이 파일 전체를
-- 붙여넣고 실행하세요 (CREATE OR REPLACE 방식이라 여러 번 실행해도 안전합니다).
--
-- 내용: 아침 루틴 화면에 인라인으로 들어간 "기상 기록" 달력용 RPC 2개 추가
--   - daily_list_wake_month: 특정 연/월의 날짜별 기상 시각 목록
--   - daily_set_wake_time: 기상 시각을 직접 지정/수정/삭제 (달력에서 날짜를
--     눌러 보정할 때 사용, p_wake_time 이 null 이면 해당 날짜 기록 삭제)
--
-- 참고: patch-03-wake-log-list.sql 에서 추가했던 daily_list_wake_logs /
-- daily_delete_wake_log 함수는 더 이상 앱에서 쓰지 않지만(별도 리스트
-- 화면을 인라인 달력으로 대체함), DB에 남아있어도 무해하므로 굳이
-- 지우지 않아도 됩니다.
-- ============================================================================


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

grant execute on function daily_list_wake_month(text, int, int) to anon;
grant execute on function daily_set_wake_time(text, date, timestamptz) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
