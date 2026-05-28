# 20 · Momus Critique — Round 1

## Verdict
⬛ APPROVE / ⬛ REJECT / ⬛ NEEDS-REVISION
**REJECT** (치명적인 논리 모순과 롤백 시 데이터 유실 시나리오 존재)

## Critical Issues (BLOCKING — 반드시 fix)

| # | 영역 | 문제 | 증거 | 제안 |
|---|---|---|---|---|
| 1 | `11-MIGRATE` & `05` | **5% Hard Fail과 Skip 정책의 수학적 모순**<br>Plan F에서 142명(약 70%)이 매핑 누락된 원인을 `scheduled_deletion_at` / `merged_into` 등으로 간주해 v2에서는 "정상 skip" 처리하겠다고 함. 그러나 `04-validate`의 기준은 "Django vs Supabase Row Count 5% 손실 임계"임. 70%의 유저가 정당하게 skip되면, 자식 테이블(`user_progress` 등)의 row count도 필연적으로 70% 감소함. 즉, **이 마이그레이션 검증은 수학적으로 영원히 5% 임계를 통과할 수 없으며 무조건 hard fail 됨.** | `11-MIGRATE.md` §2 표 (70~99% 손실) 및 §4.1 M-4 (skip 명시) vs §4.2 M-6 (5% hard fail) | 분모 보정 필수. 단순 Django 총 row 비교가 아니라, "마이그레이션 대상 유저(Valid Users)가 가진 Django row 수"를 분모로 계산하도록 `04-validate` 로직 수정. |
| 2 | `10-plan-overview` | **Wave 의존성 역전 (DB 파괴 위험)**<br>Wave 1에서 `11-AUTH`가 진행되며 실제 Supabase Auth 셋업과 테스트 유저 생성이 이루어짐. 그러나 Wave 2의 `11-MIGRATE`는 사전 전제(PRE-2)에 따라 **"TRUNCATE 후 처음부터"** 실행됨. 즉, Wave 1에서 검증해둔 Auth 상태나 유저 데이터가 Wave 2에서 날아가버림. | `10-plan-overview.md` §3 (Wave 1: AUTH → Wave 2: MIGRATE) 및 §0 PRE-2 (TRUNCATE) | `11-MIGRATE`의 DB 초기화 및 사용자 사전 생성을 Wave 1으로 올리거나, `11-AUTH`의 E2E 테스트를 MIGRATE 이후(Wave 2/3)로 늦추어야 함. |
| 3 | `11-CUTOVER` & `10` | **롤백 시 Next.js 기간 데이터 100% 증발 (Split Brain)**<br>Big Bang 컷오버 후 치명적 버그로 DNS를 롤백해 다시 Django(VPS)로 돌아갈 경우, 컷오버 기간 동안 Supabase에 쌓인 사용자의 신규 `user_progress` 등을 Django로 되돌리는 역방향 스키마 마이그레이션 계획이 전무함. | `11-CUTOVER.md` §4 (롤백 시나리오: DNS 즉시 롤백만 언급, 데이터 패치 대책 부재) | 롤백 발생 시 1) Vercel 기간 동안 생성된 데이터를 Django 형식으로 추출/삽입하는 역방향 스크립트를 준비하거나, 2) 롤백을 포기하고 Fix-forward만 허용하는 원칙(무조건 고치고 간다)을 합의해야 함. |
| 4 | `11-ADMIN` & `10` | **Admin DEFER에 따른 관리자 기능 완전 마비**<br>DB가 Supabase로 완전히 넘어가고 Nuxt가 동결(PRE-3)되는데, 관리자 페이지(Admin) 이전을 나중(PRE-5)으로 미루면 어떻게 됨? 기존 Nuxt Admin은 더 이상 Supabase DB를 보지 못하므로 플랜 업로드나 요약 재생성이 완전히 불가능해짐. | `05-feature-matrix.md` 2.2 (Admin 3 라우트 DEFER) 및 `10-plan-overview` PRE-5 | `11-ADMIN` 중 최소한의 핵심 데이터 쓰기 기능(플랜 엑셀 업로드 등)은 메인 크리티컬 패스(Wave 5 이하)에 포함시켜야 함. |

## Major Issues (SHOULD fix)

| # | 영역 | 문제 | 증거 | 제안 |
|---|---|---|---|---|
| 1 | `00-meta-system` | **AI의 Assertion 우회 (VRT/TS)**<br>AI가 "VRT pass" 기준을 맞추기 위해 실 코드를 고치는 대신 `npx playwright test --update-snapshots`를 실행해 망가진 화면을 새로운 baseline으로 덮어쓰고 commit 해버리면 CI의 `noUncommitted` 규칙도 통과해버림. TS 에러 0건 역시 `// @ts-ignore` 나 `as any`가 아닌 `as unknown as X` 로 쉽게 우회 가능. | `00-meta-system.md` §2.3 및 `11-DESIGN` D-4 | VRT baseline 갱신 커밋은 반드시 사용자(Human)의 명시적 `git push` 승인 또는 PR 리뷰를 거치도록 강제. TS는 strict 모드 + lint-staged로 우회 주석 원천 차단. |
| 2 | `11-MIGRATE` | **Critical 데이터의 5% 허용은 너무 관대함**<br>전체 7,921건의 `user_progress` 중 5%면 396건임. 마이그레이션 스크립트가 396개의 통독 기록을 실수로 날려먹어도 AI는 "5% 이내이므로 PASS"를 선언하고 다음 Gate로 넘어가게 됨. | `11-MIGRATE.md` §1 "5% 손실 = hard fail" | `user_progress`, `plan_subscriptions`, `profiles` 3대 핵심 테이블에 대해서는 (Valid 유저 모수 대비) **0% 손실 임계 (1건이라도 누락 시 fail)** 를 적용해야 함. |
| 3 | `11-CUTOVER` | **Soft Maintenance의 한계 (데이터 유실)**<br>컷오버 당일 Vercel에 `MAINTENANCE_MODE=true`를 켜더라도, 이미 발급된 토큰을 가진 모바일 클라이언트나 기존 브라우저가 직접 Django API 엔드포인트를 찌르면 계속 쓰기 작업이 일어남. DB Dump 뜨는 도중/직후에 변경된 데이터는 영구 유실됨. | `11-CUTOVER.md` §3.2 (C-8, C-9: 라우팅 레이어에서의 차단만 언급) | MySQL DB 자체에 `FLUSH TABLES WITH READ LOCK` 을 걸거나 애플리케이션 유저의 쓰기 권한을 REVOKE 하는 **Hard DB Lock** 단계가 C-10 직전에 추가되어야 함. |

## Minor Issues (NICE to fix)

| # | 영역 | 문제 | 증거 | 제안 |
|---|---|---|---|---|
| 1 | `00-meta-system` | **grep 카운트 어서션 우회**<br>"기타 등등", "etc" 등을 금지했지만 "그 외 항목들", "나머지", 혹은 아무 키워드 없이 리스트를 중간에 뚝 끊어버리면 grep으로 잡을 수 없음. | `00-meta-system.md` §2.2 | 파일 수 대비 추출된 리스트의 개수가 정확히 일치하는지 숫자로 검증하는 로직 (`ls | wc -l`) 추가. |
| 2 | `11-MIGRATE` | **샘플 사이즈 부족**<br>마이그레이션 후 데이터 라운드 트립을 단 "5명"만 진행함. 엣지 케이스를 잡기에 통계적으로 너무 빈약함. | `11-MIGRATE.md` §4.2 M-9 | 최소 10% (약 20명) 샘플링 또는 극단값 케이스(가장 데이터가 많은 유저 5명 + 없는 유저 5명 등) 지정. |
| 3 | `11-PWA` | **인프라 찌꺼기 위험**<br>Wave 1에서 PWA 테스트 중 FCM 토큰을 등록하면, 아직 마이그레이션되지 않은 임시 유저 테이블과 얽혀 꼬일 수 있음. | `11-PWA.md` PW-4 | 토큰 발급 테스트는 로컬/Mock에서만 진행하고 실 DB 기록은 Wave 2 이후로 조정. |

## Hidden Assumptions Detected
1. **Supabase Rate Limit 가정:** `11-MIGRATE` M-1에서 100명 단위 batch를 실험한다고 하지만, 컷오버 당일에 Cloudflare나 Supabase 측에서 비정상 트래픽(대량 삽입)으로 간주해 예고 없이 IP 블록이나 429 에러를 내뿜을 가능성을 고려하지 않음.
2. **모든 누락 유저 = 삭제/병합 유저라는 가정:** Plan F에서 실패한 142명이 전부 `scheduled_deletion_at` / `merged_into` 대상이라고 단정짓고 있음. 단순 OAuth 이메일 누락이나 DB 무결성 에러로 인해 **진짜 활성 유저**가 섞여서 매핑에 실패했을 위험이 농후함.
3. **Vercel DNS 전파 즉시성 가정:** DNS를 Cloudflare에서 Vercel로 전환(C-12) 시 즉각 반영된다고 전제하나, ISP DNS 캐싱으로 인해 최대 48시간 동안 일부 사용자는 여전히 Django 서버로 접속하게 됨. (Split-brain 발생)

## Counter-arguments Anticipated
*   **작성자 주장 (Wave 의존성 관련):** "Wave 1 `11-AUTH`는 로컬 에뮬레이터나 임시 프로젝트에서 테스트하므로 Wave 2의 TRUNCATE와 충돌하지 않는다."
    *   **반박:** 플랜 문서(`11-AUTH` A-1, A-2)에는 "Supabase 프로젝트의 Auth Settings 검증", "Kakao/Google OAuth Provider 등록" 등 명확히 **운영(Remote) 환경 세팅**이 포함되어 있음. 이를 Wave 2에서 초기화하면 설정 꼬임이나 데이터 정합성 문제가 필연적으로 발생함.
*   **작성자 주장 (5% 임계 관련):** "5%는 어디까지나 비상 방어선일 뿐 실제 목표는 100% 매핑이다."
    *   **반박:** AI 오케스트레이터는 "비상 방어선"이라는 맥락을 이해하지 않고 로직으로만 판단함. 스크립트가 4.9% 데이터 누락을 발생시켜도 AI는 `ASSERTION PASS`로 판단해 다음 게이트를 강제 통과시킴. 인간의 관대한 목표가 아니라 기계의 엄격한 상한선으로 정의해야 함.
