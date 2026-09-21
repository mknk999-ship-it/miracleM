-- ============================================================================
-- patch-10-scripture-sync-by-date.sql
--
-- 기존 daily_sync_scripture_from_mizpah()는 "총량이 늘었으면 오늘(앱을 연 날)
-- 에 표시"하는 방식이었다. 그래서 미스바에서 읽은 날과 미라클M을 실제로 연
-- 날이 다르면(예: 20일 아침에 미스바에서 읽고 며칠 뒤에야 미라클M을 열면)
-- 표시가 읽은 날이 아니라 앱을 연 날로 잘못 찍히는 문제가 있었다.
--
-- 이 패치는 mizpah_readers.updated_at(실제로 미스바에서 기록한 시각)의
-- 날짜(KST 기준)를 사용해서 실제로 읽은 날짜에 표시가 남도록 고친다.
-- updated_at을 알 수 없는 예외적인 경우에만 기존처럼 앱을 연 날짜로 대체한다.
--
-- Supabase SQL Editor에 이 파일 전체를 붙여넣고 실행하세요
-- (CREATE OR REPLACE 방식이라 여러 번 실행해도 안전합니다).
-- ============================================================================

create or replace function daily_sync_scripture_from_mizpah(p_pin text, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_total numeric;
  v_current_updated timestamptz;
  v_last_total numeric;
  v_last_updated timestamptz;
  v_marked boolean := false;
  v_mark_date date;
begin
  perform daily_verify_pin(p_pin);

  select total, updated_at into v_current_total, v_current_updated
    from mizpah_readers where name = '이명세훈';
  v_current_total := coalesce(v_current_total, 0);

  select value::numeric into v_last_total from daily_settings where key = 'mizpah_scripture_last_total';
  v_last_total := coalesce(v_last_total, 0);

  select value::timestamptz into v_last_updated from daily_settings where key = 'mizpah_scripture_last_updated_at';

  if v_current_total > v_last_total
     and v_current_updated is not null
     and (v_last_updated is null or v_current_updated > v_last_updated) then
    v_mark_date := (v_current_updated at time zone 'Asia/Seoul')::date;
    insert into daily_scripture_marks (mark_date, user_name) values (v_mark_date, '세훈')
    on conflict (mark_date, user_name) do nothing;
    v_marked := true;
  elsif v_current_total > v_last_total then
    v_mark_date := p_date;
    insert into daily_scripture_marks (mark_date, user_name) values (v_mark_date, '세훈')
    on conflict (mark_date, user_name) do nothing;
    v_marked := true;
  end if;

  insert into daily_settings (key, value)
  values ('mizpah_scripture_last_total', v_current_total::text)
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if v_current_updated is not null then
    insert into daily_settings (key, value)
    values ('mizpah_scripture_last_updated_at', v_current_updated::text)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  return jsonb_build_object(
    'marked', v_marked,
    'marked_date', v_mark_date,
    'current_total', v_current_total,
    'previous_total', v_last_total
  );
end;
$$;

grant execute on function daily_sync_scripture_from_mizpah(text, date) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
