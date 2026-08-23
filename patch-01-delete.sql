-- ============================================================================
-- patch-01-delete.sql
--
-- schema.sql 을 이미 실행한 기존 DB에 그대로 덧붙여 실행하는 패치입니다.
-- schema.sql 자체는 수정하지 않습니다. Supabase SQL Editor에 이 파일 전체를
-- 붙여넣고 실행하세요 (CREATE OR REPLACE 이므로 여러 번 실행해도 안전합니다).
--
-- 내용: 일기 삭제, 운동 기록 삭제 RPC 추가
--   - 메모 삭제(daily_delete_note), 확언 삭제(daily_delete_affirmation)는
--     schema.sql에 이미 있으므로 이 패치에서는 다루지 않습니다.
--   - 운동 기록은 랭킹을 저장 시점이 아니라 조회 시점에 계산하므로
--     (daily_list_exercise_records 의 row_number() 윈도우 함수),
--     기록을 삭제하면 랭킹은 다음 조회부터 자동으로 재계산됩니다.
--   - 홈 달력의 운동 X 표시도 daily_get_calendar_month 가 매번
--     daily_exercise_logs 를 직접 조회해서 만들기 때문에, 해당 날짜의
--     마지막 운동 기록을 삭제하면 X 표시도 자동으로 사라집니다.
-- ============================================================================


-- 1. 일기 삭제 (날짜 기준, 일기는 날짜당 1건이므로 날짜로 삭제)
create or replace function daily_delete_diary(p_pin text, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform daily_verify_pin(p_pin);
  delete from daily_diary where entry_date = p_date and user_name = '세훈';
end;
$$;

-- 2. 운동 기록 삭제 (id 기준)
create or replace function daily_delete_exercise_log(p_pin text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform daily_verify_pin(p_pin);
  delete from daily_exercise_logs where id = p_id;
end;
$$;

-- 3. 실행 권한 부여
grant execute on function daily_delete_diary(text, date) to anon;
grant execute on function daily_delete_exercise_log(text, bigint) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
