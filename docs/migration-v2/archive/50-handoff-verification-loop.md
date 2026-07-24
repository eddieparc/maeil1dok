# 50 · Handoff — Verification + Adversarial Critique Loop

> **목적**: 새 세션에서 본 마이그레이션 v2 plan 전체를 **처음부터 검증 + 적대적 크리틱** 으로 재검토.  
> **기준 시점**: 2026-05-28 (본 핸드오프 작성 시점).  
> **트리거 예시 prompt**: 본 문서 §6 참조.

---

## 1. 현재 자산 (검증 대상)

### 1.1 plan 문서 (37 파일 / 4,169+ 줄)

| 경로 | 내용 |
|---|---|
| [`docs/migration-v2/README.md`](../README.md) | 전체 구조 + 게이트 진행 현황 |
| [`docs/migration-v2/00-meta-system.md`](../00-meta-system.md) | AI 실수 방지 시스템 — F1~F8 직전 실패 패턴 + 8개 규칙 카테고리 |
| [`docs/migration-v2/01-nuxt-inventory.md`](../01-nuxt-inventory.md) | Nuxt 41p/128c/11s/38co 전수 |
| [`docs/migration-v2/02-next-inventory.md`](../02-next-inventory.md) | Next 35p/33API/111c + TS 5 에러 실측 |
| [`docs/migration-v2/03a-backend-api.md`](../03a-backend-api.md) | Django 129 endpoint |
| [`docs/migration-v2/03b-backend-domain.md`](../03b-backend-domain.md) | Django 28 모델 + signals + admin + settings |
| [`docs/migration-v2/04-production-live-audit.md`](../04-production-live-audit.md) | maeil1dok.app Webfetch 실측 |
| [`docs/migration-v2/05-feature-matrix.md`](../05-feature-matrix.md) | 4 인벤토리 교차 합성 (PARITY/MISSING/OBSOLETE/DEFER/NEW) |
| [`docs/migration-v2/06-quality-scorecard.md`](../06-quality-scorecard.md) | 신뢰도 점수 + P0~P3 우선순위 (자동 합성) |
| [`docs/migration-v2/10-plan-overview.md`](../10-plan-overview.md) | 마스터 플랜 + PRE-1~7 + Wave 구조 (R1 fix 반영) |
| [`docs/migration-v2/11-FOUND.md`](../11-FOUND.md) ~ [`11-CUTOVER.md`](../11-CUTOVER.md) | 15 슬라이스 |
| [`docs/migration-v2/archive/20-momus-critique-round-1.md`](20-momus-critique-round-1.md) ~ [`25-round-6.md`](25-momus-critique-round-6.md) | Momus 6 라운드 (R1 REJECT → R2~R6 OKAY) |
| [`docs/migration-v2/archive/26-sisyphus-self-critique.md`](26-sisyphus-self-critique.md) | Sisyphus 자가 종합 critique (Claude Opus 4.7) |
| [`docs/migration-v2/archive/30-oracle-final-review.md`](30-oracle-final-review.md) | Oracle R1 (Critical 2 + Major 3 REJECT) |
| [`docs/migration-v2/archive/31-oracle-final-review-r2.md`](31-oracle-final-review-r2.md) | Oracle R2 (Critical 2 + Major 3 REJECT) |
| [`docs/migration-v2/archive/32-oracle-final-review-r3.md`](32-oracle-final-review-r3.md) | Oracle R3 자가 (credits 차단 대체) |
| [`docs/migration-v2/40-github-mapping.md`](../40-github-mapping.md) | GH Milestone + 라벨 + Issue 템플릿 + Kanban Project 정책 |

### 1.2 자동화 스크립트 (10개)

| 경로 | 역할 |
|---|---|
| [`scripts/migrate-v2/validate-plan.sh`](../../../scripts/migrate-v2/validate-plan.sh) | plan 자가 검증 47개 항목 (현재 47 PASS / 0 FAIL) |
| [`scripts/migrate-v2/extract-tasks.py`](../../../scripts/migrate-v2/extract-tasks.py) | 11-*.md → catalog.json 추출 (190 issue) |
| [`scripts/migrate-v2/01-create-labels.sh`](../../../scripts/migrate-v2/01-create-labels.sh) | 49 라벨 idempotent 생성 |
| [`scripts/migrate-v2/02-create-milestones.sh`](../../../scripts/migrate-v2/02-create-milestones.sh) | 16 마일스톤 idempotent 생성 |
| [`scripts/migrate-v2/03-create-issues.sh`](../../../scripts/migrate-v2/03-create-issues.sh) | catalog 기반 이슈 일괄 생성 |
| [`scripts/migrate-v2/sync-issues.sh`](../../../scripts/migrate-v2/sync-issues.sh) | catalog ↔ GH title + body diff 양방향 sync |
| [`scripts/migrate-v2/verify-issues.sh`](../../../scripts/migrate-v2/verify-issues.sh) | catalog 190 ↔ GH 190 1:1 검증 |
| [`scripts/migrate-v2/catalog.json`](../../../scripts/migrate-v2/catalog.json) | 190 issue + 15 milestone 메타 |
| [`scripts/migrate-v2/lib/common.sh`](../../../scripts/migrate-v2/lib/common.sh) | 공유 유틸 (dry-run / log / idempotent) |
| [`scripts/migrate-v2/RUNBOOK.md`](../../../scripts/migrate-v2/RUNBOOK.md) | Gate G 실행 절차 |

### 1.3 GitHub 라이브 상태 (`eddieparc/maeil1dok` PUBLIC)

| 자원 | 수 | URL |
|---|---|---|
| Labels | 49 | https://github.com/eddieparc/maeil1dok/labels |
| Milestones | 16 | https://github.com/eddieparc/maeil1dok/milestones |
| Issues (open) | 190 | https://github.com/eddieparc/maeil1dok/issues |

### 1.4 적용된 patch 누적 (48건)

| 출처 | 수 | 위치 |
|---|---|---|
| Momus R1 | 13 (BLOCKING 4 + MAJOR 3 + MINOR 3 + HIDDEN 3) | 20-momus-critique-round-1.md |
| Oracle R1 | 5 (Critical 2 + Major 3) | 30-oracle-final-review.md |
| Oracle R2 | 5 (Critical 2 + Major 3) | 31-oracle-final-review-r2.md |
| Sisyphus 자가 R3 | 8 | 32-oracle-final-review-r3.md |
| Sisyphus 자가 종합 | 17 (BLOCKING 4 + MAJOR 5 + MINOR 8) | 26-sisyphus-self-critique.md |

---

## 2. 신뢰성 우려 사항 (재검증 동기)

### 2.1 모델 매칭 의심
- 설정: `oracle` + `momus` 둘 다 `github-copilot/gpt-5.5` (확인: `jq '.agents.oracle.model' ~/.config/opencode/oh-my-openagent.json`)
- 실 실행 시 일부 라운드: `antigravity/gemini-3.1-pro-high` 로 동작 → credits 차단 → fallback `opencode/gemini-3.1-pro` → 차단
- 의미: **Momus R2~R6 의 5 OKAY 가 정상 모델에서 나온 결과인지 불명확**

### 2.2 외부 검증의 일시적 차단
- workspace `wrk_01KR0A04YKS70D1Y076CX7HEQF` credits = 0
- antigravity 3 계정 401 (jgplabs@gmail.com / jgplabs.01@gmail.com / urbanblanks567@gmail.com)
- 자가 critique 로 우회 (17 patches) — but 외부 시각 보강 권장

### 2.3 라이브 검증 부족 (04-production-live-audit.md)
- Webfetch 만 사용 — JS/console/network 추적 불가
- BUG-001 (성경 본문 미표시), BUG-004 (URL undefined) 의 라이브 재현 여부 **단정 불가**
- Playwright 인증 주입 검증 미수행

---

## 3. 핸드오프 받는 세션이 해야 할 일

### Phase 1: 자가 검증 (Read-only 시작)
1. 본 핸드오프 파일 (50-...) Read
2. README + 00-meta + 10-plan-overview + 26-self-critique Read 로 전체 흐름 파악
3. 자가 검증 명령 실행:
   ```bash
   bash scripts/migrate-v2/validate-plan.sh       # 47 PASS / 0 FAIL 기대
   bash scripts/migrate-v2/verify-issues.sh        # 190 ↔ 190 1:1 기대
   ```
4. 결과가 다르면 즉시 사용자 보고 + Phase 2 진행 보류.

### Phase 2: 외부 검증 루프 재실행
1. Credits 상태 확인:
   ```bash
   # Antigravity quota 도구 사용
   # 또는 gh api 등으로 OpenCode workspace credits 잔액 확인
   ```
2. Credits 가용 시 다음 순서로 fire:
   - **Momus R2~R6 모델 매칭 재검증** — `.omo/plans/migration-v2.md` 를 sole prompt 로 5 라운드 연속 OKAY 까지 fire. 응답 시간이 < 30s 면 lenient 의심 → 더 깊은 prompt 로 재시도.
   - **Oracle R-final** — `[ROLE]` 본문 + 본 핸드오프의 §1 자산 목록을 함께 전달. Verdict 가 REJECT 면 fix 적용 후 재호출.
3. Credits 불가 시:
   - 본 세션 (Claude Opus 4.7) 가 자가 적대적 critique 수행 — 단, 자가 R3 + 자가 종합 critique 이미 적용됨. 추가 가치 제한적.
   - 사용자에게 명시 보고 후 대기.

### Phase 3: 라이브 검증 보강
1. Playwright 인증 주입 e2e (사용자 토큰 또는 test 계정):
   - `/bible` 본문 텍스트 iframe 안 verses 실재 검증 (BUG-001)
   - 책장 선택 → URL `?book=jhn&chapter=3` 정상 (BUG-004)
   - 콘솔 error / 4xx / 5xx 수집 (BUG-003)
   - `/bible/highlights` placeholder 노출 여부 (BUG-005)
   - 다크모드 토글 + 모바일 (375px) vs 데스크탑 (1280px)
2. 결과를 `04-production-live-audit.md` §5 (L-1~L-7) 채우기.

### Phase 4: 격차 동기화
1. 검증 루프에서 새 BLOCKING/MAJOR 발견 시:
   - 슬라이스 plan 본문 fix 적용
   - `python3 scripts/migrate-v2/extract-tasks.py` 재추출
   - `APPLY=1 bash scripts/migrate-v2/sync-issues.sh` 로 GH 동기화
   - `bash scripts/migrate-v2/verify-issues.sh` 로 1:1 재검증
2. 변경분을 **신규 파일** `docs/migration-v2/archive/27-handoff-rerun-critique.md` 에 기록 (본 핸드오프 시점에는 미존재 — 새 세션의 산출물).

### Phase 5: 최종 사용자 보고
- Verdict (APPROVE / CONDITIONAL / REJECT)
- 적용 patch 수 (신규)
- 라이브 검증 결과 (BUG-001 등 재현 여부)
- 사용자 결정 필요 항목

---

## 4. 메타 시스템 규칙 (반드시 준수)

[`00-meta-system.md`](../00-meta-system.md) 의 8개 카테고리 + 본 핸드오프에서 강조:

1. **추측 금지** — file:line 또는 명령 실행 결과만 근거.
2. **요약 표현 금지** — "기타", "etc.", "나머지", "그 외 항목들" 모두 grep 0 hits.
3. **인증 우회 스크린샷 무효** — Playwright `(authenticated)` 라우트는 인증 주입 의무.
4. **TS 우회 패턴 금지** — `@ts-ignore` / `@ts-expect-error` / `as any` / `as unknown as X` 4종 grep 차단.
5. **service_role 유출 grep** — `NEXT_PUBLIC_.*SERVICE_ROLE_KEY` 검출 시 fail.
6. **Critical 3 테이블 (profiles/plan_subscriptions/user_progress) 0% hard fail** — Valid Users 분모 기준.
7. **Fix-Forward Only** — DNS 역행 영구 금지.
8. **VRT baseline 갱신 인간 승인** — `--update-snapshots` AI 자율 머지 금지.

---

## 5. 결정된 사항 (재논의 금지)

| ID | 결정 | 비고 |
|---|---|---|
| PRE-1 | 컷오버 방식: **Big Bang** | 점검 두고 한 번에 |
| PRE-2 | 3월 Supabase 잔재: **TRUNCATE** | 처음부터 |
| PRE-3 | 옛 Nuxt 시스템: **동결** | 긴급 보안만 |
| PRE-4 | 그룹 기능: **백로그** | v2 제외 |
| PRE-5 | Admin: **CORE 메인 + EXTENDED 별도** | 컷오버 후 |
| PRE-6 | UserAchievement: **재계산** | streak 기반 |
| PRE-7 | 일정: **장인정신 무제한** | 단 Mn4: 매월 drift 체크 |

각 슬라이스 결정 (AD-1~4, MD-1~6, RD-1~4 등) 은 슬라이스 plan 본문 참조.

---

## 6. 검증 루프 trigger prompt (새 세션에서 사용)

다음 prompt 를 새 세션에 복붙해 시작:

```
매일일독 마이그레이션 v2 plan 의 검증 + 적대적 크리틱 루프 재실행.

핸드오프 문서: docs/migration-v2/archive/50-handoff-verification-loop.md
이 파일을 먼저 Read 한 뒤, §3 의 Phase 1 ~ Phase 5 순서로 진행.

핵심 신뢰성 우려:
1. Momus R2~R6 가 잘못된 모델 (antigravity/gemini-3.1-pro-high) 로 돌았을 가능성 → 정확한 모델 (github-copilot/gpt-5.5) 로 재검증 필요.
2. Oracle R3 가 credits 차단으로 자가 critique 로 대체됨 → 외부 Oracle 다시 fire 필요.
3. 라이브 사이트 BUG-001/003/004/005 가 Webfetch 한계로 미검증 → Playwright 인증 주입으로 보강 필요.

성공 기준:
- 자가 검증 (validate-plan.sh + verify-issues.sh) 변함없이 통과
- 외부 Momus 5회 연속 OKAY (재검증)
- 외부 Oracle APPROVE 또는 CONDITIONAL APPROVE
- 라이브 BUG 재현 여부 단정
- 새 발견 사항을 docs/migration-v2/27-rerun-critique.md 에 기록

규칙:
- docs/migration-v2/00-meta-system.md 의 8 카테고리 준수
- 외부 자원 (credits, 사용자 결정) 차단 시 사용자에게 즉시 보고
- 자율 진행은 read-only + 자가 검증 + 외부 agent 호출까지. 결정적 변경은 사용자 명시 승인 후.
- "전부 추천대로" 기조 유지 (사용자가 다른 결정 시 contest 가능)

진행 시작.
```

---

## 7. 핸드오프 받는 세션을 위한 안전장치

### 7.1 신뢰 못 할 정보 명시

다음은 본 핸드오프 작성자 (Claude Opus 4.7) 의 시각 — 새 세션이 검증 의무:
- "외부 Momus R2~R6 OKAY 의 lenient 의심" — 실제로 lenient 였는지 새 모델로 재현 후 판정
- "Sisyphus 자가 종합 critique 17 patch 가 충분" — 새 시각이 더 발견 가능
- "현재 자료 모두 정합" — validator/verify 명령으로 재실측 의무

### 7.2 새 세션이 발견 시 우선순위

| 발견 종류 | 처리 |
|---|---|
| 본 핸드오프의 사실 오류 | 본 파일 직접 수정 + 사용자 알림 |
| plan 본문의 모순 | 슬라이스 plan fix → catalog 재추출 → GH sync |
| 외부 검증 새 BLOCKING | 적용 → 재검증 loop |
| 외부 검증 MAJOR | 사용자 결정 후 적용 |
| 외부 검증 MINOR | backlog 가능 |

### 7.3 자율 진행 금지 영역

- `APPLY=1` 환경변수로 destructive 작업 (라벨/마일스톤/이슈 생성·삭제)
- git commit / push / PR
- 외부 OAuth provider 설정 변경
- Supabase Dashboard 조작
- `.env*` 파일 수정

위 모두 사용자 명시 요청 후만.

---

## 8. 완료 신호

새 세션이 다음 모두 충족 시 "검증 루프 완료" 선언 가능:

- [ ] validate-plan.sh 통과 (47+ PASS / 0 FAIL)
- [ ] verify-issues.sh 통과 (catalog ↔ GH 1:1)
- [ ] 외부 Momus 5 라운드 연속 OKAY (재검증) — credits 가용 시
- [ ] 외부 Oracle APPROVE 또는 CONDITIONAL APPROVE (재검증) — credits 가용 시
- [ ] 라이브 BUG-001/003/004/005 재현 여부 단정 — Playwright 인증 주입
- [ ] **신규 파일 `27-handoff-rerun-critique.md` 작성** (verdict + 신 patch + 라이브 결과)
- [ ] 신규 발견 patch 의 GH 동기화 (sync-issues.sh APPLY=1)
- [ ] 사용자에게 verdict 보고 후 다음 단계 결정 받음

> 외부 검증이 credits 차단으로 불가하면 그 사실을 27-rerun-critique.md 에 명시하고 자가 critique 로 대체. 단정 금지.

<!-- handoff-version: 1 -->
<!-- handoff-date: 2026-05-28 -->
<!-- target-session: 검증 + 적대적 크리틱 루프 재실행 -->
