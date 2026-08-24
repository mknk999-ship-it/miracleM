-- ============================================================================
-- patch-02-notes-complete-diary-month.sql
--
-- schema.sql / patch-01-delete.sql 을 이미 실행한 기존 DB에 그대로 덧붙여
-- 실행하는 패치입니다. schema.sql 자체는 수정하지 않습니다 (schema.sql은
-- 이미 최신 내용으로 갱신되어 있으므로, 새로 설치하는 경우 이 패치는
-- 필요 없습니다). Supabase SQL Editor에 이 파일 전체를 붙여넣고 실행하세요
-- (모두 IF NOT EXISTS / CREATE OR REPLACE 패턴이라 여러 번 실행해도 안전합니다).
--
-- 내용:
--   1. daily_notes 에 is_completed 컬럼 추가 (메모 완료 처리 기능)
--   2. daily_list_notes 갱신 (완료된 메모는 목록 맨 아래로)
--   3. daily_upsert_note 갱신 (p_is_completed 파라미터 추가)
--   4. daily_list_diary_month 신규 (일기 큰 달력 뷰: 날짜별 내용 미리보기용)
-- ============================================================================


-- 1. daily_notes 에 is_completed 컬럼 추가
alter table daily_notes add column if not exists is_completed boolean not null default false;

drop index if exists idx_daily_notes_pinned;
create index if not exists idx_daily_notes_pinned on daily_notes (is_completed, is_pinned, updated_at desc);


-- 2. 메모 목록: 미완료 먼저(그 안에서 고정핀 먼저, 최신순), 완료된 메모는 맨 아래로
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


-- 3. 메모 등록/수정: p_is_completed 파라미터 추가 (null이면 기존 값 유지)
--    기존 4개 인자 버전은 더 이상 쓰지 않으므로 정리 차원에서 제거합니다.
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

grant execute on function daily_upsert_note(text, bigint, text, boolean, boolean) to anon;


-- 4. 일기 큰 달력 뷰용: 특정 연/월의 일기 목록 (날짜 + 내용)
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

grant execute on function daily_list_diary_month(text, int, int) to anon;

-- ============================================================================
-- 끝.
-- ============================================================================
