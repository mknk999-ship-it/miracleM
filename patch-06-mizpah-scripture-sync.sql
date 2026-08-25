-- ============================================================================
-- patch-06-mizpah-scripture-sync.sql
--
-- schema.sql / patch-01~05 를 이미 실행한 기존 DB에 그대로 덧붙여 실행하는
-- 패치입니다. schema.sql 자체는 수정하지 않아도 되지만(이미 최신 내용으로
-- 갱신되어 있음), 새로 설치하는 경우 이 패치는 필요 없습니다. Supabase
-- SQL Editor에 이 파일 전체를 붙여넣고 실행하세요 (CREATE OR REPLACE 방식이라
-- 여러 번 실행해도 안전합니다).
--
-- 내용: 홈 달력의 "말씀" X 표시를 날짜 터치가 아니라, 같은 프로젝트에 있는
-- 미스바(mizpah2608) 앱의 mizpah_readers 테이블에서 '이명세훈'의 누적
-- 말씀 카운팅(total)이 지난 확인 시점보다 1 이상 올랐는지로 자동 판정합니다.
--
--   - daily_sync_scripture_from_mizpah(p_pin, p_date): 홈 화면 진입/새로고침
--     때마다 호출. mizpah_readers.total(이명세훈) 을 daily_settings 에 저장해둔
--     마지막 값과 비교해서, 늘었으면 p_date(기본 오늘)에 daily_scripture_marks
--     행을 추가합니다.
--   - 기존 daily_toggle_scripture RPC는 그대로 두되(터치 UI만 제거), 더 이상
--     앱에서 호출하지 않습니다.
--
-- ⚠️ 주의: 이 함수는 SECURITY DEFINER 로 mizpah_readers 테이블을 직접 조회합니다.
-- 같은 Supabase 프로젝트, 같은 public 스키마를 공유하고 있어야 하며, 이 함수를
-- 만드는 역할(보통 postgres)이 mizpah_readers 를 조회할 수 있어야 합니다
-- (SQL Editor에서 실행하면 보통 문제 없습니다). 실행 후 에러가 나면
-- mizpah_readers 테이블/컬럼명이 실제와 다른지 확인해주세요.
-- ============================================================================


create or replace function daily_sync_scripture_from_mizpah(p_pin text, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_total numeric;
  v_last_total numeric;
  v_marked boolean := false;
begin
  perform daily_verify_pin(p_pin);

  select total into v_current_total from mizpah_readers where name = '이명세훈';
  v_current_total := coalesce(v_current_total, 0);

  select value::numeric into v_last_total from daily_settings where key = 'mizpah_scripture_last_total';
  v_last_total := coalesce(v_last_total, 0);

  if v_current_total > v_last_total then
    insert into daily_scripture_marks (mark_date, user_name) values (p_date, '세훈')
    on conflict (mark_date, user_name) do nothing;
    v_marked := true;
  end if;

  insert into daily_settings (key, value)
  values ('mizpah_scripture_last_total', v_current_total::text)
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return jsonb_build_object(
    'marked_today', v_marked,
    'current_total', v_current_total,
    'previous_total', v_last_total
  );
end;
$$;

grant execute on function daily_sync_scripture_from_mizpah(text, date) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
