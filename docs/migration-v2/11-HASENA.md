# 11-HASENA · 하세나 (하루세장)

> **슬라이스 ID**: 11-HASENA · **Wave**: 4 · **의존**: 11-FOUND, 11-MIGRATE, 11-PROGRESS · **크기**: M

## 1. 목표
`/hasena` (Nuxt 1416 lines) 의 일정/요약 표시·완료 토글·과거 묵상 조회를 Next 에서 동작.

## 2. 자산
- Nuxt: [pages/hasena.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/hasena.vue), [stores/hasena](file:///Users/jgp/GitHub/maeil1dok/frontend/app/stores/) 
- Django: `/api/v1/todos/hasena/summary/`, `summaries/`, `summaries/regenerate/`, `status/`, `record/*`
- 모델: `HasenaRecord`, `HasenaSummary`
- Next: src/app/(authenticated)/hasena/, src/app/api/hasena/ (02 도착 후 정확화)

## 3. 작업
| # | 작업 | DoD |
|---|---|---|
| H-1 | 오늘 하세나 요약 + 본문 표시 | e2e 통과 |
| H-2 | 완료 토글 (`hasena_records`) | DB upsert + 멱등 |
| H-3 | 과거 일자 조회 | 캘린더 모달 통과 |
| H-4 | 요약 regenerate (관리자만) — Admin 슬라이스로 이관 결정 가능 | 결정 |
| H-5 | 마이그레이션: HasenaRecord 383 / HasenaSummary 6 row count Django==Supabase | 5% hard fail 통과 |

## 4. 결정
- HD-1: 하세나 나눔(댓글/좋아요) v2 포함 여부 (Nuxt에 일부 UI 존재)
- HD-2: 요약 생성 모델 (Gemini API 키 의존) 의 v2 운영 정책

## 5. DoD (Oracle R-final Major #6 + Momus #3 4-tuple 보강)
- **CHANGE**: src/app/(authenticated)/hasena/, src/app/api/hasena/, src/repositories/hasenaRepo.ts, src/components/hasena/*
- **EVIDENCE**: `.sisyphus/evidence/11-HASENA-e2e/` — 오늘 요약 + 완료 토글 + 과거 조회 + (관리자) regenerate = 4 케이스. row count 비교 (`hasena_records-count.txt`, `hasena_summaries-count.txt`)
- **REPRODUCE**: `npx playwright test tests/e2e/hasena/*.spec.ts`
- **ASSERTION**:
  - HasenaRecord row count Django (live snapshot 기준) == Supabase
  - HasenaSummary row count Django == Supabase
  - completion toggle 멱등 (2회 호출 시 동일 row state)
  - e2e 4/4 pass
