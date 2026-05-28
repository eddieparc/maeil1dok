# 11-CATCHUP · 캐치업 (밀린 일정 재배치)

> **슬라이스 ID**: 11-CATCHUP · **Wave**: 4 · **의존**: 11-FOUND, 11-MIGRATE, 11-PROGRESS · **크기**: M

## 1. 목표
사용자가 일정 며칠 놓쳤을 때 재배치 (catchup session) 생성/표시/완료. Plan F 시기 production data 는 0행이지만 기능 자체는 Nuxt에 존재.

## 2. 자산
- Nuxt: 컴포넌트 [components/catchup](file:///Users/jgp/GitHub/maeil1dok/frontend/app/components/catchup) (01 §2)
- Django: `/api/v1/todos/catchup/*` (preview/create/sessions-active/session-detail/update/schedules/toggle/abandon/complete)
- 모델: `CatchupSession`, `CatchupSchedule`
- Next: src/app/(authenticated)/catchup/ — 02 §8 TS 에러 1건 (`CatchupClient missingCount`)

## 3. 작업
| # | 작업 | DoD |
|---|---|---|
| CA-1 | TS 에러 (CatchupClient missingCount) 해결 — 11-FOUND 와 협업 | tsc clean |
| CA-2 | 밀린 일정 preview — strategy/range 입력 → 재배치 시뮬레이션 결과 | e2e |
| CA-3 | catchup session 생성 | DB insert + 일정 row N개 |
| CA-4 | catchup 일정 완료 토글 | 멱등 |
| CA-5 | 세션 중도 포기/완료 | 상태 전환 검증 |
| CA-6 | 마이그레이션: 0행 → 0행 (스키마만, 데이터 없음) | row count 일치 |

## 4. 결정
- CAD-1: weekend_multiplier, max_daily_chapters 등 알고리즘 파라미터 — Django 와 동일 유지

## 5. DoD
- EVIDENCE: e2e preview→create→toggle→complete 4건
- ASSERTION: TS 0 errors in CatchupClient
