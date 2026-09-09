-- patch-09-disable-pin.sql
-- 비밀번호 입력 기능을 당분간 비활성화합니다.
-- daily_verify_pin 을 항상 통과시키는 no-op 으로 바꿉니다 (p_pin 값은 무시됨).
-- 다른 모든 RPC 함수는 그대로 이 함수를 호출하지만 더 이상 예외를 던지지 않습니다.

create or replace function daily_verify_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;
