# 데일리 (miracleM)

개인용 데일리 관리 웹앱. 정적 HTML/JS/CSS로 만들어졌고, Supabase REST API(PostgREST)를
`fetch`로 직접 호출합니다. 별도 프레임워크나 빌드 과정이 없습니다.

- 잠금: 앱 진입 시 숫자 패드로 PIN 입력 (세션 동안 유지)
- 홈: 월 달력에 일기 / 말씀 / 운동 3트랙 X 표시
- 아침 루틴: 기상 완료 버튼 + 확언 카드
- 운동: 스톱워치 + 세트 기록 + 역대 랭킹(1위 컨페티)
- 일기: 날짜별 작성/수정, 지난 일기 목록
- 중요 메모: 작성/수정/삭제, 고정핀

이 앱은 미스바(mizpah2608) 앱과 **같은 Supabase 프로젝트**를 공유합니다.
이 저장소의 모든 테이블/함수는 `daily_` 접두어를 사용하며, 기존 `mizpah_` 객체는
전혀 건드리지 않습니다.

## 배포 순서

### 1. Supabase에 스키마 적용

1. Supabase 대시보드 → 해당 프로젝트 → **SQL Editor** 로 이동합니다.
2. 이 저장소의 [`schema.sql`](./schema.sql) 파일을 엽니다.
3. **3번 항목**에서 `CHANGE_ME_TO_YOUR_PIN` 부분을 원하는 PIN(숫자 4자리 이상 권장,
   예: `2608`)으로 바꿉니다.
   ```sql
   insert into daily_settings (key, value)
   values ('app_pin_hash', crypt('CHANGE_ME_TO_YOUR_PIN', gen_salt('bf')))
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```
4. `schema.sql` 전체 내용을 SQL Editor에 붙여넣고 실행합니다. (파일 안에 실행 순서가
   주석으로 정리되어 있으며, 위에서 아래로 한 번에 실행하면 됩니다.)
5. PIN을 나중에 바꾸고 싶다면 3번 블록만 다시 실행하면 됩니다 (같은 값을 다시
   `crypt()`로 해시해서 덮어씁니다).

### 1-1. 패치 적용 (일기 / 운동 기록 삭제 기능)

`schema.sql`을 이미 실행한 DB라면, [`patch-01-delete.sql`](./patch-01-delete.sql) 파일
전체를 SQL Editor에 붙여넣고 실행하세요. `daily_delete_diary`, `daily_delete_exercise_log`
RPC가 추가됩니다 (`CREATE OR REPLACE` 방식이라 여러 번 실행해도 안전합니다). 메모/확언
삭제 RPC는 `schema.sql`에 이미 포함되어 있습니다.

### 2. 정적 파일 배포

이 저장소 자체가 완성된 정적 사이트입니다. 아래 중 편한 방법으로 배포하세요.

- **GitHub Pages (권장, 자동 배포 워크플로 포함)**:
  1. GitHub 저장소 → **Settings → Pages** 로 이동합니다.
  2. **Build and deployment → Source** 를 `GitHub Actions` 로 선택합니다 (이 저장소에
     이미 `.github/workflows/deploy-pages.yml` 워크플로가 포함되어 있어서, Source만
     한 번 지정해두면 이후 `main` 브랜치에 푸시할 때마다 자동으로 배포됩니다).
  3. Actions 탭에서 `Deploy to GitHub Pages` 워크플로가 실행되는 것을 확인하고,
     완료되면 Settings → Pages 상단에 표시되는 주소로 접속합니다.
- **Vercel / Netlify / Cloudflare Pages**: 저장소를 연결하고 빌드 명령 없이
  (Static / "no build") 루트 디렉터리를 그대로 배포합니다.
- **로컬 확인**: `python3 -m http.server 8080` 실행 후 `http://localhost:8080` 접속.

정적 파일이므로 별도 빌드 과정(`npm install`, `npm run build` 등)이 필요 없습니다.

### 3. 접속 및 홈 화면 추가

1. 배포된 주소로 접속하면 PIN 입력 화면이 먼저 나옵니다. 1단계에서 설정한 PIN을
   입력하면 앱에 진입합니다.
2. 모바일 브라우저에서 "홈 화면에 추가"(PWA 설치)를 하면 아이콘으로 바로 실행할 수
   있습니다.

## 보안 구조 요약

- `daily_` 로 시작하는 모든 테이블은 RLS가 켜져 있고, `anon`/`authenticated` 롤에는
  테이블 권한이 전혀 부여되지 않습니다 (직접 select/insert/update/delete 전부 차단).
- 클라이언트는 오직 `SECURITY DEFINER` RPC 함수(`daily_login`, `daily_upsert_diary`
  등)를 통해서만 데이터에 접근합니다. 모든 RPC는 첫 인자로 `p_pin`을 받아 내부에서
  `daily_verify_pin()`으로 검증하고, 실패 시 즉시 예외를 던집니다.
- PIN은 코드에 하드코딩되지 않고 `daily_settings` 테이블에 `pgcrypto`의 bcrypt
  해시로 저장됩니다.
- 클라이언트는 로그인 성공 시 입력한 PIN을 `sessionStorage`에 저장해 두고, 화면을
  이동할 때마다 재입력을 요구하지 않습니다. 탭/브라우저를 닫으면 세션이 사라집니다.

## 확장 대비

모든 기록 테이블에는 `user_name` 칼럼이 있고 현재는 `'세훈'` 고정값이 들어갑니다.
추후 여러 사람이 각자 로그인해서 쓰는 구조로 바꿀 때, RPC 내부의 `'세훈'` 하드코딩
부분을 실제 로그인한 사용자 이름으로 바꾸기만 하면 되도록 스키마를 설계했습니다.

## 폴더 구조

```
index.html            앱 셸 (잠금 화면 + 화면 컨테이너 + 하단 네비게이션)
manifest.json          PWA 매니페스트
sw.js                  서비스워커 (정적 자산 캐싱)
schema.sql             Supabase 테이블 / RLS / RPC 전체
patch-01-delete.sql     일기 / 운동기록 삭제 RPC 패치 (schema.sql 실행 후 추가로 실행)
css/style.css          전체 스타일 (딥네이비 + 앰버 테마)
js/config.js           Supabase URL / anon key 설정
js/api.js              RPC 호출 래퍼 + PIN 세션 관리
js/util.js             날짜/시간 포맷, 토스트 등 공통 유틸
js/icons.js             라인(스트로크) SVG 아이콘 세트
js/router.js           해시 기반 라우터 + 하단 네비게이션
js/lock.js             PIN 잠금 화면 로직
js/confetti.js         최고기록 축하 컨페티 이펙트
js/main.js             앱 부트스트랩, 서비스워커 등록
js/screens/            화면별 로직 (home, morning, exercise, diary, notes, admin)
icons/                 PWA 아이콘 (Node 스크립트로 생성)
scripts/generate-icons.js  아이콘 재생성 스크립트
```
