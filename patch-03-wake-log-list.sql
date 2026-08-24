-- ============================================================================
-- patch-03-wake-log-list.sql
--
-- schema.sql / patch-01-delete.sql / patch-02-notes-complete-diary-month.sql 를
-- 이미 실행한 기존 DB에 그대로 덧붙여 실행하는 패치입니다. schema.sql 자체는
-- 수정하지 않습니다 (schema.sql은 이미 최신 내용으로 갱신되어 있으므로, 새로
-- 설치하는 경우 이 패치는 필요 없습니다). Supabase SQL Editor에 이 파일 전체를
-- 붙여넣고 실행하세요 (CREATE OR REPLACE 방식이라 여러 번 실행해도 안전합니다).
--
-- 내용: 아침 루틴의 "기상 기록" 리스트 화면용 RPC 2개 추가
--   - daily_list_wake_logs: 날짜별 기상 시각 목록 (최신순)
--   - daily_delete_wake_log: 기상 기록 삭제
-- ============================================================================


create or replace function daily_list_wake_logs(p_pin text, p_limit int default 90, p_offset int default 0)
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
    select id, wake_date, wake_time
    from daily_wake_logs
    order by wake_date desc
    limit p_limit offset p_offset
  ) t;

  return v_result;
end;
$$;

create or replace function daily_delete_wake_log(p_pin text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform daily_verify_pin(p_pin);
  delete from daily_wake_logs where id = p_id;
end;
$$;

grant execute on function daily_list_wake_logs(text, int, int) to anon;
grant execute on function daily_delete_wake_log(text, bigint) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
