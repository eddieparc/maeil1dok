# Migration v2 — 매일일독 Nuxt→Next 재출범

> **세션 시작**: 2026-05-28  
> **이전 시도**: Plan A~F (2026-02 ~ 2026-03), Plan F dry-run 95% 데이터 손실로 중단  
> **재출범 동기**: 마이그레이션은 단순 프레임워크 교체가 아니라 **서비스 신뢰도·UX 품질을 끌어올리는 사건**이어야 한다. 직전 시도는 격차 인지 부족 + 면적 폭주로 중단됨.

---

## 0. 본 디렉토리의 SSOT 원칙

이 디렉토리는 **마이그레이션의 단일 진실 공급원(Single Source of Truth)** 이다.
- 모든 의사결정과 인벤토리는 여기로 모인다.
- 코드와 충돌 시 **코드를 의심**한다 (이 디렉토리가 합의된 사양이다).
- 변경은 PR 단위로, AI 자체적 수정 금지. 사용자 승인을 거친다.

---

## 1. 파일 구조

| 파일 | 역할 | 작성 주체 | 합의 단계 |
|---|---|---|---|
| [`README.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/README.md) | 본 문서 — 전체 구조 + 진행 순서 | Sisyphus | 작성 중 |
| [`00-meta-system.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/00-meta-system.md) | AI 실수 방지 시스템 + Definition of Done 표준 | Sisyphus | 작성 중 |
| [`01-nuxt-inventory.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/01-nuxt-inventory.md) | Nuxt 운영 코드 전수 명세 | explore (background) | 진행 중 |
| [`02-next-inventory.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/02-next-inventory.md) | Next 마이그레이션 코드 전수 명세 + 빌드 실측 | explore (background) | 진행 중 |
| [`03-backend-inventory.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/03-backend-inventory.md) | Django 백엔드 전수 명세 (API/모델/로직) | explore (background) | 진행 중 |
| [`04-production-live-audit.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/04-production-live-audit.md) | 라이브 사이트 실측 (Playwright) | explore (background) | 진행 중 |
| `05-feature-matrix.md` | 1~4 교차 매칭 — 누락/회귀/불일치 자동 탐지 | Sisyphus 합성 | 1~4 완료 후 |
| `06-quality-scorecard.md` | 기능별 신뢰도 점수 + 사용자 직감 반영란 | Sisyphus + 사용자 | 5 후 |
| `10-plan-overview.md` | 신규 마이그레이션 마스터 플랜 v2 | Sisyphus | 6 후 |
| `11-plan-{slice}.md` (다수) | 하위 분할 플랜들 | Sisyphus | 10 후 |
| `20-momus-critique-round-{N}.md` | 적대적 크리틱 라운드 N (1~5+) | momus | 10·11 후 반복 |
| `30-oracle-final-review.md` | 고정밀 최종 리뷰 | oracle | 20 통과 후 |
| `40-github-mapping.md` | 확정 플랜 → GitHub Issues/Milestones 매핑 | Sisyphus | 30 통과 후 |

---

## 2. 진행 순서 (gate 기반, 단계 건너뛰기 금지)

```
[Gate A] 인벤토리 4건 모두 산출 + 누락·요약 표현 0건
   ↓
[Gate B] 교차 매트릭스(05) — Nuxt 기능 × Next 상태 × API × 라이브
         "Nuxt에는 있는데 Next에 없는 것" 자동 탐지 통과
   ↓
[Gate C] 품질 스코어카드(06) — 사용자 직감 반영, 신뢰도 점수 합의
   ↓
[Gate D] 마스터 플랜(10) + 하위 플랜들(11) 작성
   ↓
[Gate E] Momus 적대적 크리틱 N회 — 5회 연속 OK까지
   ↓
[Gate F] Oracle 고정밀 리뷰 통과 — REJECT 시 D로 회귀
   ↓
[Gate G] GitHub Issues + Milestones 생성 (40)
   ↓
[Gate H] 실 작업 시작 (별도 세션)
```

각 Gate는 다음 단계 진입 전 **사용자 확인이 필요한 결정 지점**이다. AI가 자율로 다음 Gate를 통과 선언할 수 없다.

---

## 3. AI 실수 방지 (요약 — 상세는 00-meta-system.md)

| 위험 | 방지책 |
|---|---|
| 요약·"기타 등등"으로 누락 | enumeration 규칙 + grep 카운트 어서션 |
| 환각/추측 | 모든 주장에 `file:line` 인용 의무 |
| Phantom completion | DoD에 "재현 명령 + 증거 파일" 필수 |
| 인증 우회 스크린샷 | 모든 Playwright 작업에 인증 주입 강제 |
| 데이터 손실 silent skip | 5% 임계 초과 시 hard fail |
| 스코프 크립 | 플랜 체크섬 + diff 비교 |
| 다중 세션 충돌 | 파일 ownership 표 + WIP 커밋 금지 |
| 빌드 그린 ≠ 정상 | DoD에 런타임 스모크 의무 |

---

## 4. 이번 세션의 책임 범위

본 세션의 출력은 **계획 + 검증 시스템까지만**이다. 실제 코드 변경은 사용자 승인 후 별도 세션에서 시작한다.
