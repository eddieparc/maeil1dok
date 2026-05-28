# 11-MIGRATE · 데이터 마이그레이션 v2

> **슬라이스 ID**: 11-MIGRATE  
> **Wave**: 2  
> **의존**: 11-FOUND, 11-AUTH (사용자 생성 흐름)  
> **추정 크기**: L  
> **상태**: 스켈레톤 — Plan F의 실패 (95% 데이터 손실) 직접 대응

---

## 1. 목표

Django/MySQL → Supabase/PostgreSQL 데이터 마이그레이션을 **5% 손실 = hard fail** 기준으로 통과시킨다.
직전 Plan F dry-run 의 user_progress 95% 손실, profiles 68% 손실 등 모든 손실 영역의 root cause를 진단/해결.

---

## 2. 직전 실패 분석 (validation_report.json 2026-03-02)

| 테이블 | Django | Supabase | 손실률 | 추정 원인 |
|---|---|---|---|---|
| profiles | 203 | 64 | -68.5% | 사용자 사전 생성 단계에서 142명 누락 |
| plan_subscriptions | 463 | 88 | -81.0% | 사용자 UUID 매핑 실패 → cascade silent skip |
| user_progress | 7,921 | 381 | -95.2% | subscription UUID 매핑 실패 + cascade |
| hasena_records | 383 | 4 | -99.0% | 사용자 매핑 실패 |
| user_video_intro_progress | 121 | 4 | -96.7% | 사용자 매핑 실패 |
| user_reading_settings | 96 | 49 | -49.0% | 사용자 매핑 실패 |
| user_plan_display_settings | 463 | 88 | -81.0% | subscription cascade |
| user_highlights | 205 | 153 | -25.4% | 부분 매핑 실패 |
| bible_bookmarks | 3 | 1 | -66.7% | 데이터셋 작아 진단 어려움 |
| **daily_schedules** | 1106 | 1113 | **+7행** | **멱등성 위반 — 재실행 시 중복 삽입** |

**근본 원인**: `02-create-supabase-users.ts` 가 203명 중 63명만 생성한 시점에서 user_mapping이 망가졌고, 03b가 fail-soft로 142명의 모든 자식 row를 warn만 남기고 skip 처리. 이 silent skip이 통과로 분류됨.

---

## 3. v2 변경점 (Plan F 대비, Momus R1 반영 후)

| 측면 | Plan F | v2 |
|---|---|---|
| 매핑 실패 정책 | warn + skip (fail-soft) | **hard fail** (이름 + 사유 list 출력 후 exit 1) |
| 손실 임계 — 일반 테이블 | 5% warn 표시 | **5% hard fail (Valid Users 분모 기준)** |
| **손실 임계 — Critical 3 테이블** (profiles, plan_subscriptions, user_progress) | — | **0% hard fail (1건이라도 누락 → exit 1)** — Momus R1 Major #2 |
| **검증 분모 보정** (Momus R1 BLOCKING #1) | Django 전체 row | **Valid Users 모수 (Django total - 정당 skip 대상)** — 정당 skip 사용자의 자식 row 는 분모에서 제외 |
| 멱등성 검증 | 없음 | 두 번 돌려도 row count 동일 확인 의무 |
| 사용자 사전 생성 검증 | 생성 카운트만 | **샘플 20명 라운드 트립 — 가장 데이터 많은 5명 + 없는 5명 + 무작위 10명** (Momus R1 Minor #2) |
| 사용자 매핑 실패 진단 | 없음 | **누락 사유 분류 + 사용자 ID 전수 출력**. `data/skipped_users.json` 에 `{user_id, email, reason}` 으로 저장. Momus R1 Hidden #2: "전부 정당 skip" 가정 금지 — 무작위 5명을 사용자 검증으로 spot check 의무 |
| Rate limit 대응 (Momus R1 Hidden #1) | 100ms delay | **Supabase Admin API throttle 사전 측정 + Cloudflare 우회 (직접 supabase.co)**. 4xx/5xx 시 exponential backoff + 본인 IP block 가능성 사전 경고 |
| RUNBOOK | 있음, 재활용 | v2 적합화 |

---

## 4. 작업 항목

### 4.0 사용자/identity/profile 마이그레이션 순서 (자가 R3 Self-5)

**엄격 순서 — race condition 방지**:
```
1. 트리거 DISABLE (M-5d)
2. auth.users 사전 생성 (M-5, password_verification_hook 등록)
3. auth.identities 추가 (M-5b, identity_data JSONB 완비)
4. profiles INSERT (M-2~M-4 사용자 매핑 + skip 사유 분류)
5. 트리거 RE-ENABLE (M-5d)
6. 나머지 자식 테이블 (user_progress 등) 로딩
```

각 단계는 직렬. 병렬 금지 (race 위험).

### 4.1 사용자 사전 생성 강화 (Plan F의 02-* 재작성)

| # | 작업 | DoD |
|---|---|---|
| M-1 | Supabase Admin API rate limit 정확한 한계 측정 — 100명 batch 실험 | 한계치 / 추천 delay 기록 |
| M-2 | 사용자 skip 사유 enum 정의 + 사유별 카운트 출력 (Self-critique B3) — Plan F 의 142 하드코딩 폐기. 동적 검증: `Django 활성 사용자 수 == Supabase auth.users 매핑 수 + skip 사유별 합계`. v2 실행 시점의 실 누락 수에 자동 적응 | 검증식 통과 + skip 사유별 카운트 보고서 (`scheduled_deletion_at` N1 / `merged_into` N2 / 중복 이메일 N3 / 기타 N4) |
| M-3 | 중복 이메일 (이메일 + 소셜 같은 이메일) 케이스 정책 — **자동 병합 (이메일 unique 가정, 동일 이메일이면 같은 사용자로 통합)** (Self-critique MAJOR M1). 단, 두 Django 계정에 다른 progress 가 있으면 더 활성 계정 우선 + 다른 계정의 progress merge | 정책 + 코드 + 테스트 + merge 우선순위 명시 |
| M-4 | `scheduled_deletion_at` / `merged_into` 사용자 처리 — skip but log to separate file | `data/deleted_users.json` + `data/merged_users.json` |
| M-5 | `02-create-supabase-users.ts` v2 — 위 4개 반영 | 실행 시 user_mapping.json 의 entries 수 = 활성 사용자 수 (203 - 의도적 skip) |
| **M-5b-pre** | **`auth.identities` 쓰기 메커니즘 사전 검증** (Self-critique B1) — 빈 Supabase 프로젝트에 1건 sample 로 (a) `service_role` 로 `auth.identities` 직접 INSERT 시도, (b) 실패 시 `supabase.auth.admin.linkIdentity()` API 시도, (c) 둘 다 실패 시 `supabase.auth.admin.createUser({...identities})` 통합 생성 시도. 동작하는 경로 1개 입증 후 M-5b 진입. | 1건 sample 로 `auth.identities` 에 row 존재 입증 + 사용한 method 보고서 |
| **M-5b** | **SocialAccount → auth.identities 명시적 마이그레이션** (Oracle Critical #1, Mn8) — M-5b-pre 에서 입증된 경로로 Django `accounts_socialaccount` 의 모든 row 를 마이그레이션. `provider` + `provider_id` + `user_id (mapped UUID)` + `identity_data` (M-5e). **Mn8: auth.identities 의 PK (UUID `id`) 정책 — Supabase 자동 생성. Django SocialAccount.id 는 보존 안 함 (Supabase 의 UUID 로 대체). FK 참조 없으므로 무방.** | Django SocialAccount count == Supabase auth.identities count + 5명 spot check |
| **M-5c** | **PBKDF2 → `password_verification_hook` 방식** (Oracle R2 Critical #1, 자가 R3 Self-1, Self-critique MAJOR M3) — Supabase `password_verification_hook` (Auth Hooks 카테고리) 으로 외부 검증. **선행 의무: F-17 (Supabase tier 사전 확인) 통과 후 진입.** F-17 결과 Pro tier 필요 + 사용자 비용 승인 시 (a) 경로, 불가 시 (b) 강제 reset 경로 자동 회귀. | (a): 5명 sample 로 첫 로그인 통과. (b): 강제 reset 발송 후 응답률 추적 |
| **M-5d** | **Trigger 충돌 우회 — ON CONFLICT 방식** (Oracle R2 Critical #2, 자가 R3 Self-2, Self-critique B2) — `on_auth_user_created` 트리거가 `profiles` 자동 생성. **Supabase managed 환경에서 service_role 은 `auth.users` 의 trigger 제어 권한 없음 (table owner: `supabase_auth_admin`)**. 트리거 DISABLE 시도 대신 **`profiles INSERT ... ON CONFLICT (user_id) DO UPDATE SET ...`** 사용. 트리거가 빈 profiles row 를 먼저 만들어도 우리 데이터로 덮어쓰기. + maintenance mode 로 신규 가입은 별도 차단. | profiles INSERT 시 충돌 0건 (ON CONFLICT 의 DO UPDATE 가 처리) + profiles 의 모든 컬럼이 Django UserProfile 값으로 셋팅됨 |
| **M-5e** | **`auth.identities` identity_data JSONB 완비** (Oracle R2 Major #3, 자가 R3 Self-3) — GoTrue schema 정확히: `{"sub": provider_id, "email": email, "email_verified": true, "phone_verified": false, "provider_id": provider_id, ...optional provider-specific}`. `sub` 와 `provider_id` 모두 명시 (둘 다 GoTrue 가 참조). | 5명 spot check: identity_data.sub == identity_data.provider_id == auth.identities.provider_id |

### 4.2 5% Hard Fail 검증 강화 (Plan F의 04-validate 재작성)

| # | 작업 | DoD |
|---|---|---|
| M-6 | `04-validate.ts` v2 — **분모 보정**: Valid Users (=Django total - 정당 skip) 기준. 일반 테이블 5% / **Critical 3 테이블 (profiles/plan_subscriptions/user_progress) 0% exhaustive count match (sample 아닌 전수)** hard fail. **Mn6: Critical 3 는 SQL count diff 로 전수 비교 — M-9 의 20명 round-trip 은 추가 sample 검증 layer** | 의도적 1건 누락 주입 → user_progress 검증 시 exit 1 + 전수 count 일치 확인 |
| M-7 | FK 무결성 → 0 orphan 확인 (이미 통과 중이지만 강화) | 위반 시 hard fail |
| M-8 | 멱등성 검증 — 동일 마이그레이션 2회 → row count 변화 0 | 검증 통과 |
| M-9 | 라운드 트립 샘플 — **20명** (max-data 5 + zero-data 5 + 무작위 10) × 모든 자식 테이블 row count 일치 + 필드 spot check | 통과 |
| M-9b | **Skip 사용자 spot check** (Momus R1 Hidden #2) — `data/skipped_users.json` 의 무작위 5명을 Django 측에서 직접 SELECT 해 `scheduled_deletion_at` / `merged_into` / 중복 이메일 여부 확인 | 5/5 모두 정당 skip 입증 |
| M-10 | daily_schedules +7행 원인 추적 + 멱등성 fix | 원인 보고서 + fix 적용 후 재현 시 +0 |

### 4.3 새 테이블 / 마이그레이션 검토

| # | 작업 | DoD |
|---|---|---|
| M-11 | [supabase/migrations/20260301000001_plan_f_new_tables.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260301000001_plan_f_new_tables.sql) 검증 — bible_bookmarks/reflection_notes/personal_reading_records/migration_user_mapping | 적용 + 스키마 검증 |
| M-12 | 그룹 기능 (`ReadingGroup`, `GroupMembership`, `GroupInvitation`) — v2 포함 여부 결정 | 결정 + 포함 시 SQL 작성 |
| M-13 | `BibleContentCache` — Supabase로 옮길지 / 재생성할지 결정 | 결정 + 실행 |

### 4.4 스크립트 인프라

| # | 작업 | DoD |
|---|---|---|
| M-14 | `01-extract-mysql.ts` 의 `main().catch(console.error)` → `process.exit(1)` 적용 (00-meta-system F5 대응) | 실패 시 정확한 exit code |
| M-15 | `data/` 디렉토리 .gitignore 확실히 들어 있는지 검증 + 검증 명령 자동화 | gitignore 확인 + CI 검증 |
| M-16 | `run-migration.ts` 의 step 4 fail 시 정확한 에러 메시지 + log path 출력 | dry-run + 에러 시뮬레이션 |

### 4.5 도메인 모델 매핑 합의 (03b 기반)

03b-backend-domain.md 의 28개 Django 모델 × Supabase 테이블 매핑 표 합의:

| Django 모델 | Supabase 테이블 | v2 정책 |
|---|---|---|
| User | auth.users + profiles | MIGRATE (사전 생성) |
| **SocialAccount** | **auth.identities** | **MIGRATE (Oracle Critical #1 — 명시적)** — Apple Private Relay / Kakao 이메일 미제공 사용자는 자동 매칭 불가. `provider` + `provider_id` 를 service_role 로 `auth.identities` 에 직접 insert. M-5b 참조 |
| UserProfile | profiles | MIGRATE |
| Follow | user_follows | MIGRATE |
| UserAchievement | — | **SKIP** (Plan F 정책 유지) |
| UserReadingSettings | user_reading_settings | MIGRATE |
| EmailVerificationToken | — | SKIP (Supabase Auth) |
| PasswordResetToken | — | SKIP (Supabase Auth) |
| BibleReadingPlan | bible_reading_plans | MIGRATE |
| PlanSubscription | plan_subscriptions | MIGRATE |
| DailyBibleSchedule | daily_schedules | MIGRATE (멱등성 fix 후) |
| UserBibleProgress | user_progress | MIGRATE (가장 중요) |
| VideoBibleIntro | video_bible_intros | MIGRATE |
| UserVideoIntroProgress | user_video_intro_progress | MIGRATE |
| HasenaRecord | hasena_records | MIGRATE |
| HasenaSummary | hasena_summaries | MIGRATE |
| VisitorCount | — | SKIP (Vercel Analytics) |
| CatchupSession | catchup_sessions | MIGRATE |
| CatchupSchedule | catchup_schedules | MIGRATE |
| UserPlanDisplaySettings | user_plan_display_settings | MIGRATE |
| UserReadingPosition | user_reading_positions | MIGRATE |
| BibleBookmark | bible_bookmarks (NEW) | MIGRATE |
| ReflectionNote | reflection_notes (NEW) | MIGRATE |
| BibleHighlight | user_highlights | MIGRATE (memo 제외 — Plan F 정책 재확인 필요) |
| PersonalReadingRecord | personal_reading_records (NEW) | MIGRATE |
| ReadingGroup | reading_groups (?) | **결정 필요** (MD-1) |
| GroupMembership | group_memberships (?) | **결정 필요** |
| GroupInvitation | group_invitations (?) | **결정 필요** |
| BibleContentCache | bible_content_cache | **결정 필요** (재생성 vs 이전) |

---

## 5. 결정 사항

| 결정 | 옵션 |
|---|---|
| MD-1 | 그룹 3개 모델 마이그레이션 | 포함 / 백로그 (Nuxt UI 일부 존재 — 영향도 사용자 결정) |
| MD-2 | UserAchievement 처리 | 폐기 (Plan F) / 재계산 (v2 신규 로직) |
| MD-3 | BibleHighlight.memo | 제외 (Plan F) / 포함 |
| MD-4 | BibleContentCache | 재생성 / DB 이전 |
| MD-5 | 중복 이메일 사용자 | 자동 병합 / 명시 알림 |
| MD-6 | 컷오버 전 dry-run 횟수 | 최소 N회 통과 후만 실 컷오버 |

---

## 6. DoD 통합

- **CHANGE**: scripts/migrate/* v2 + supabase/migrations/* 추가
- **EVIDENCE**: 
  - `.sisyphus/evidence/11-MIGRATE-dry-run-report.json` — overall=pass
  - `.sisyphus/evidence/11-MIGRATE-idempotency.txt` — 2회 실행 row count 동일
  - `.sisyphus/evidence/11-MIGRATE-round-trip.txt` — 5명 샘플 일치
- **REPRODUCE**: `cd maeil1dok-next/scripts/migrate && npx tsx run-migration.ts --dry-run`
- **ASSERTION**:
  - row count delta: 0% for all critical tables (profiles, user_progress, plan_subscriptions, daily_schedules)
  - FK orphan count: 0
  - 멱등성: 2회 run row count delta = 0
  - 사용자 매핑: 활성 사용자 100%

<!-- plan-checksum: PENDING -->
