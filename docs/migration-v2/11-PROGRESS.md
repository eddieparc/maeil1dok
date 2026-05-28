# 11-PROGRESS · 진도 추적 + 사용자 데이터

> **슬라이스 ID**: 11-PROGRESS  
> **Wave**: 4  
> **의존**: 11-FOUND, 11-MIGRATE, 11-PLAN  
> **추정 크기**: M  
> **중요도**: **CRITICAL** — Plan F의 user_progress 95% 손실이 직접 이 슬라이스 영역

---

## 1. 목표

사용자가 본문을 읽음 표시했을 때 `user_progress` 에 정확히 저장되고, 통계/히스토리/달력에 실시간 반영. 마이그레이션 후 사용자가 자신의 과거 진도 데이터를 그대로 본다.

---

## 2. 기존 자산

### 2.1 Nuxt 측

| 라우트/컴포저블 | 파일 | 비고 |
|---|---|---|
| /bible/history | [pages/bible/history.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/bible/history.vue) | 통독 기록 (447 line) |
| 컴포저블 | [composables/usePersonalRecord.ts](file:///Users/jgp/GitHub/maeil1dok/frontend/app/composables/usePersonalRecord.ts) | personal-records API |
| 컴포저블 | [composables/useScheduleApi.ts](file:///Users/jgp/GitHub/maeil1dok/frontend/app/composables/useScheduleApi.ts) | reading/update API |
| 컴포저블 | [composables/useTongdokMode.ts](file:///Users/jgp/GitHub/maeil1dok/frontend/app/composables/useTongdokMode.ts) | 통독 모드 |

### 2.2 Django 측 (03a)

- `POST /api/v1/todos/reading/update/` — 읽음/취소 토글
- `GET /api/v1/todos/stats/progress/`, `stats/plan/`, `stats/users/`
- `GET /api/v1/todos/schedules/today/`
- `GET /api/v1/todos/bible/personal-records/by-book/`
- `GET /api/v1/todos/bible/personal-records/stats/`
- `POST /api/v1/todos/bible/personal-records/`

### 2.3 Next 측

- `src/app/api/profile/`, `src/app/(authenticated)/reading/`, `src/app/(authenticated)/calendar/`
- 02 도착 후 정확화

---

## 3. 데이터 무결성 원칙

본 슬라이스의 모든 작업은 **사용자 progress 데이터에 영향**을 준다. 따라서:

1. **모든 progress 변경은 audit log** — Supabase의 `audit_logs` 테이블 (없으면 추가) 에 기록
2. **삭제 금지** — soft delete (is_completed=false) 만 허용
3. **마이그레이션 round-trip 의무** — 11-MIGRATE 의 5명 샘플 검증 시 user_progress 가 1순위

---

## 4. 작업 항목

### 4.1 읽음 표시

| # | 작업 | DoD |
|---|---|---|
| PR-1 | 읽음 토글 API (Next route) — `user_progress` upsert | e2e: 토글 → DB 반영 확인 |
| PR-2 | 토글 idempotent — 같은 요청 2회 → 1행 | 검증 |
| PR-3 | 다중 일정 (오늘 + 내일 같이 읽음 표시) | UI/UX 검증 |

### 4.2 통계

| # | 작업 | DoD |
|---|---|---|
| PR-4 | 사용자 통계 — 완독 일수, current/longest streak | profiles 의 stats 컬럼 활용 또는 RPC |
| PR-5 | 플랜 진도율 — 구독 기간 대비 완료율 | 정확성 검증 (Django와 비교) |
| PR-6 | 사용자 잔디밭 (1년 일별 색상) — profile 페이지용 | 11-PROFILE 와 협업 |

### 4.3 히스토리

| # | 작업 | DoD |
|---|---|---|
| PR-7 | 일자별 읽은 본문 조회 | `personal_reading_records` 테이블 + RPC |
| PR-8 | 책별 정복 현황 | `personal_reading_records` |

### 4.4 캘린더 (`/calendar`)

| # | 작업 | DoD |
|---|---|---|
| PR-9 | 월간 캘린더 — 완독 / 부분 완독 / 미완료 색상 | VRT pass |
| PR-10 | 멀티 플랜 색상 (`user_plan_display_settings.color`) | 색상 일치 검증 |

### 4.5 데이터 무결성

| # | 작업 | DoD |
|---|---|---|
| PR-11 | RLS 정책 — user_progress 는 본인만 read/write | 다른 사용자 user_id 로 시도 → 401 |
| PR-12 | 마이그레이션 round-trip 검증 — 5명 샘플의 progress 100% 일치 | round-trip 리포트 |

---

## 5. 결정 사항

| 결정 | 옵션 |
|---|---|
| PRD-1 | 통계 계산 — Postgres view / RPC / 클라이언트 계산 |
| PRD-2 | Streak 계산 시점 — 매 토글 / nightly batch |
| PRD-3 | personal_reading_records 와 user_progress 의 역할 분리 (전자는 개인 자유 읽기, 후자는 플랜 일정 완료) — UX 명확화 |

---

## 6. DoD 통합

- **CHANGE**: src/app/api/profile/, src/app/(authenticated)/calendar/, src/app/(authenticated)/reading/
- **EVIDENCE**: round-trip 5명 + VRT calendar + RLS 위반 시도 4xx
- **REPRODUCE**: `npx playwright test tests/e2e/progress/`
- **ASSERTION**:
  - user_progress row count Django==Supabase (5% hard fail)
  - RLS bypass 시도: 4xx 응답
  - streak 정확도: 5명 샘플 일치

<!-- plan-checksum: PENDING -->
