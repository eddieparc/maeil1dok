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

## 1. 파일 구조 (현재 32개 파일, 3,800+ 줄)

| 파일 | 역할 | 상태 |
|---|---|---|
| [`README.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/README.md) | 본 문서 | ✅ |
| [`00-meta-system.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/00-meta-system.md) | AI 실수 방지 + DoD 4중 + 우회 패턴 차단 | ✅ |
| [`01-nuxt-inventory.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/01-nuxt-inventory.md) | Nuxt 41p/128c/11s/38co 전수 | ✅ |
| [`02-next-inventory.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/02-next-inventory.md) | Next 35p/33API/111c + TS 5 에러 실측 | ✅ |
| [`03a-backend-api.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/03a-backend-api.md) | Django 129 endpoint | ✅ |
| [`03b-backend-domain.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/03b-backend-domain.md) | Django 28 모델 + signals + admin | ✅ |
| [`04-production-live-audit.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/04-production-live-audit.md) | maeil1dok.app Webfetch 실측 | ✅ (Playwright 보강 잔존) |
| [`05-feature-matrix.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/05-feature-matrix.md) | PARITY 27 / MISSING 17 / OBSOLETE 9 / DEFER 6 / NEW 11 | ✅ |
| [`06-quality-scorecard.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/06-quality-scorecard.md) | 신뢰도 점수 + 우선순위 P0~P3 (auto) | ✅ |
| [`10-plan-overview.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/10-plan-overview.md) | 마스터 플랜 + PRE-1~7 + Wave (R1 fix 반영) | ✅ |
| [`11-FOUND.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-FOUND.md) ~ [`11-CUTOVER.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-CUTOVER.md) | 15 슬라이스 (R1 fix 반영) | ✅ |
| [`20~24-momus-critique-round-N.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/) | R1 REJECT → R2~R5 OKAY (4/5) | 🟡 R6 진행 중 |
| [`30-oracle-final-review.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/30-oracle-final-review.md) | Oracle 최종 (호출 대기) | ⬜ Gate F |
| [`40-github-mapping.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/40-github-mapping.md) | GH Issues/Milestones 매핑 + 라벨 + 템플릿 | ✅ |

---

## 2. Gate 진행 현황

```
[Gate A] 인벤토리 4건 + 누락 0건 + 메타 검증           ✅ PASS
[Gate B] 05 feature matrix 교차 합성                   ✅ PASS  (PARITY 27 / MISSING 17 / OBSOLETE 9 / DEFER 6 / NEW 11)
[Gate C] 06 quality scorecard 자동 합성                ✅ PASS  (사용자 직감 슬롯 "전부 추천대로" 승인)
[Gate D] 10 마스터 플랜 + 15 슬라이스 작성             ✅ PASS
[Gate E] Momus 5회 연속 OKAY                           ✅ PASS (R2~R6)
[Gate F] Oracle 고정밀 최종 리뷰                       🟡 진행 중
[Gate G] GitHub Issues + Milestones 생성 (179 issues)  ⬜
[Gate H] 실 코드 작업 시작 (별도 세션)                 ⬜
```

각 Gate 는 사용자 확인 또는 자동 검증 통과 후 다음 단계 진입.

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
