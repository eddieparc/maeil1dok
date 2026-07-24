# 06 · Quality Scorecard (자동 합성)

> **상태**: Gate C 1차 자동 합성. 사용자 "전부 추천대로" 결정으로 직감 슬롯은 **AI 자동 채움 (Auto-recommended)** 으로 표시 — 사용자가 사후 contest 가능.  
> **원칙**: 모든 점수는 01~05 인벤토리에서 측정한 객관 데이터에서 도출.

---

## 1. 채점 축 (각 0~5점)

| 축 | 의미 | 측정 방법 |
|---|---|---|
| **CORRECTNESS** | 라이브에서 의도대로 동작하는가 | 04-production-live-audit + bible-renewal-qa-report 의 BUG 카운트 |
| **DATA-SAFETY** | 마이그레이션 시 손실/오염 위험 | validation_report.json 의 row count delta |
| **UX-QUALITY** | 시각/반응/접근성 | a11y violations + VRT diff + 시각 회귀 evidence |
| **TYPE-SAFETY** | TS 에러, as any, 환각 가능성 | 02 §8 TS 에러 + grep 'as any' |
| **TEST-COVERAGE** | 단위/통합/VRT 존재+실행됨 | Vitest pass + e2e count |

총점 = 5축 합산 / 25.

---

## 2. 기능 영역별 스코어카드

> 점수 산정: 측정 가능한 객관 지표만. 데이터 없는 영역은 명시 (no data).

| 영역 | CORRECT | DATA | UX | TYPE | TEST | **자동총점** | 직감 (Auto-recommended) |
|---|---|---|---|---|---|---|---|
| 인증 (이메일/소셜) | 2 (Auth 새로고침 BUG 영역) | 4 (Supabase Auth 위임) | 3 (a11y login fail) | 5 (TS 0) | 3 (e2e 일부) | **17/25** | 위험 — 직전 3개 root cause 검증 필요 |
| 성경 본문 뷰어 | 1 (BUG-001/004 라이브 가능성) | 5 (정적 콘텐츠) | 3 (1198→슬림 필요) | 4 (TS 2 - settings/font) | 3 (parser 테스트 존재) | **16/25** | 위험 — 핵심 기능, 깨지면 가장 큰 영향 |
| 일정/플랜 | 4 | 2 (plan_subscriptions 81% 손실) | 4 | 4 (TS 1 - PlanPageClient) | 3 | **17/25** | 위험 — 데이터 손실 직격 |
| 통독 진행 추적 | 4 | 1 (user_progress 95% 손실) | 4 | 5 | 3 | **17/25** | **최위험** — CRITICAL 데이터 |
| 하세나 | 3 | 1 (99% 손실) | 4 | 5 | 3 | **16/25** | 위험 — Gemini API 의존 |
| 그룹/리더보드 | 2 (T0002/T0004 BUG) | 4 (DEFER이라 무관) | 3 | 5 | 2 | **16/25** | **DEFER** — 안 다루기로 함 |
| 친구/팔로우 | 4 | 4 | 4 | 5 | 3 | **20/25** | 안전 |
| 캐치업 | 4 | 5 (production 0행) | 4 | 4 (TS 1 - CatchupClient missingCount) | 3 | **20/25** | 안전 (데이터 없음) |
| 프로필 | 4 | 3 (profiles 68% 손실) | 4 | 5 | 3 | **19/25** | 위험 — 데이터 손실 |
| 북마크/하이라이트/노트 | 2 (BUG-005 placeholder) | 3 (highlights 25% 손실, bookmarks 66%) | 3 | 5 | 3 | **16/25** | 위험 — BUG-005 가시성 |
| 다크모드/테마 | 2 (다크 VRT 한 번도 안 돌음) | 5 (UI만) | 2 (a11y 7건 + 35407px diff) | 5 | 2 | **16/25** | **시각 위험** |
| Admin 도구 | 4 | 4 (DEFER) | 3 | 5 | 1 | **17/25** | **DEFER** |
| Push 알림/FCM | 3 (검증 안 됨) | 5 (인프라) | 5 | 5 | 2 | **20/25** | 안전 |
| Apple Sign In 리뷰 | 5 | 5 | 5 | 5 | 3 | **23/25** | 안전 (이미 통과) |

**가중치**: DATA + CORRECT 가 위험 가중치 2배. UX·TEST 는 1배.

---

## 3. 사용자 직감 슬롯 (Auto-recommended)

### 3.1 가장 신뢰 안 가는 기능 Top 5 (auto)
1. 통독 진도 추적 (user_progress 95% 손실)
2. 성경 본문 뷰어 (BUG-001/004 라이브 가능성)
3. 다크모드/테마 (VRT 검증 자체가 안 돌음)
4. 북마크/하이라이트/노트 (BUG-005 + 25-66% 손실)
5. 일정/플랜 (plan_subscriptions 81% 손실)

### 3.2 마이그레이션 중 가장 두려운 영역 (auto)
> **사용자 progress 데이터 (user_progress)** — 가장 많고, 가장 중요하며, 직전 95% 손실.

### 3.3 절대 잃으면 안 되는 데이터 (auto)
> profiles, user_progress, plan_subscriptions, user_highlights, hasena_records — 사용자가 직접 만든/축적한 데이터.

### 3.4 절대 잃으면 안 되는 UX (auto)
> 성경 본문 표시, 책장 이동, 읽음 토글, 다크모드 — 일일 사용 핵심.

### 3.5 이번 시도에서 빼고 가자 (auto = PRE-4/PRE-5)
> 그룹/리더보드 (PRE-4 백로그), Admin 도구 (PRE-5 별도 컷오버), 사용자 업적 (PRE-6 = 재계산이지만 v2 후순위)

### 3.6 컷오버 시점 (PRE-7 = 장인 정신)
> 시간 무관. 품질 기준 (모든 게이트 통과) 만족 시.

---

## 4. 우선순위 결정 매트릭스 (auto)

| 우선 | 영역 | 사유 |
|---|---|---|
| **P0** (즉시) | 11-FOUND (빌드 그린), 11-MIGRATE (데이터 손실 fix), 11-READER (BUG-001/004) | 모든 후속의 토대 + 가장 큰 위험 |
| **P1** (1차 컷오버 전) | 11-AUTH (새로고침 회귀 방지), 11-PROGRESS (CRITICAL 데이터), 11-PLAN, 11-ANNOTATE (BUG-005), 11-DESIGN (VRT+a11y) | 핵심 기능 + 직전 검출 위반 |
| **P2** (컷오버 직전) | 11-HASENA, 11-CATCHUP, 11-PROFILE (Achievement 재계산), 11-SOCIAL (T0002/T0004 fuzz), 11-PWA, 11-CUTOVER | 부속 기능 + 인프라 |
| **P3** (컷오버 후 안정화) | Admin 별도 컷오버 (PRE-5), VPS 폐기 검증 | 안정화 |
| **BACKLOG** | 11-SOCIAL Group 부분 (PRE-4), `/install` PWA 페이지, `/intro/[id]` stub | 의사결정 따라 |

→ 신규 마스터 플랜 [10-plan-overview.md](10-plan-overview.md) 의 Wave 구조와 일치.

<!-- scorecard-version: 1 -->
<!-- auto-recommended: true (사용자 contest 가능) -->
