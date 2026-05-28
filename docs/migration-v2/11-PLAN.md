# 11-PLAN · 통독 플랜 / 일정

> **슬라이스 ID**: 11-PLAN  
> **Wave**: 3 (병렬)  
> **의존**: 11-FOUND, 11-MIGRATE  
> **추정 크기**: M

---

## 1. 목표

`/plan`, `/plans`, `/intro/[id]` 라우트에서 플랜 구독/해지/표시 + 일정 캘린더가 정확히 동작. Plan F 의 plan_subscriptions 81% 손실이 v2 에서 0% 가 되어야 함.

---

## 2. 기존 자산

### 2.1 Nuxt 측 (01 §1)

| 라우트 | 파일 | 라인 |
|---|---|---|
| /plan | [pages/plan/index.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/plan/index.vue) | 158 |
| /plans | [pages/plans/index.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/plans/index.vue) | 496 |
| /intro | [pages/intro.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/intro.vue) | 652 |
| /intro/:id | [pages/intro/[id].vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/intro/[id].vue) | 17 |

### 2.2 Django 측 (03a §A 발췌)

- `GET /api/v1/todos/plan/` — 내 플랜 목록
- `POST /api/v1/todos/plan/` — 구독 생성
- `DELETE /api/v1/todos/plan/<sub>/` — 구독 해지
- `POST /api/v1/todos/plan/<sub>/toggle-active/`
- `GET /api/v1/todos/plans/user/`
- `GET /api/v1/todos/schedules/today/`, `tomorrow/`, `month/`
- `GET /api/v1/todos/detail/`
- `POST /api/v1/todos/reading/update/`

### 2.3 Next 측 (02 도착 후 정확화)

- `src/app/(authenticated)/plan/`, `plans/`
- `src/repositories/planRepo.ts` (verify 필요 — 02 정밀화 단계에서 확인)
- TS 에러 잔존: `PlanPageClient.tsx` (02 §8)

---

## 3. 작업 항목

### 3.1 핵심 흐름

| # | 작업 | DoD |
|---|---|---|
| P-1 | 플랜 목록 fetch — Supabase `bible_reading_plans` | e2e: 플랜 6개 표시 |
| P-2 | 플랜 구독 — `plan_subscriptions` insert | RLS 정책 통과 + insert 동작 |
| P-3 | 플랜 해지 — soft (is_active=false) vs hard delete | 정책 결정 + 구현 |
| P-4 | 플랜 일정 캘린더 (`daily_schedules`) — 월간 뷰 | 데스크탑 + 모바일 VRT |
| P-5 | 일정 상세 (today / tomorrow / arbitrary date) | e2e 통과 |
| P-6 | 비디오 인트로 (`video_bible_intros`) — 책별 영상 | 표시 + 재생 |

### 3.2 Plan F 데이터 손실 회복 (Oracle R-final Minor #3 — 하드코딩 제거)

| # | 작업 | DoD |
|---|---|---|
| P-7 | 11-MIGRATE 통과 후 plan_subscriptions row count = **Django live snapshot 기준 expected count** (M-2 `valid_users.sql` JOIN `plan_subscriptions` 의 row 수, 매월 drift 체크와 동기). 직전 plan F 시기 463 은 참고치이며 v2 실행 시점에 재측정 | `.sisyphus/evidence/11-PLAN-expected-count.sql.out` (Django) == Supabase row count |
| P-8 | UserPlanDisplaySettings — 사용자별 색상/순서 설정 마이그레이션 | Django snapshot count == Supabase count (P-7 과 동일 분모) |

### 3.3 결정 사항

| 결정 | 옵션 |
|---|---|
| PD-1 | 플랜 해지 시 progress 데이터: cascade delete / 보존 |
| PD-2 | 여러 플랜 동시 구독 정책 — Django는 다중 구독 가능 |
| PD-3 | Admin의 엑셀 업로드 (`admin/plans/upload-excel/`) — 11-ADMIN 으로 분리 |

---

## 4. DoD 통합

- **CHANGE**: src/app/(authenticated)/plan*, src/components/schedule*
- **EVIDENCE**: e2e 7건 (구독/해지/캘린더/오늘/내일/임의일자/인트로)
- **REPRODUCE**: `npx playwright test tests/e2e/plan/`
- **ASSERTION**: row count Django==Supabase, FK 무결성, VRT pass

<!-- plan-checksum: PENDING -->
