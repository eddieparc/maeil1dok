# 27 · Handoff Rerun — 검증 + 적대적 크리틱 루프 재실행 결과

> **세션 시작**: 2026-05-28 (50-handoff-verification-loop.md trigger 후)
> **목적**: 핸드오프 §3 Phase 1~5 재실행 + Oracle/Momus 모델 매칭 의심 해소 + 라이브 BUG 단정 + GH 동기화.
> **운영 모델**: anthropic/claude-opus-4-7 (오케스트레이터), openai/gpt-5.5 (oracle/momus, 모두 실 모델 매칭 확인).
> **참조**: [50-handoff-verification-loop.md](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/50-handoff-verification-loop.md)

---

## 0. 최종 Verdict (잠정 — 본 세션 종료 직전 최종 갱신)

> **상태**: IN-PROGRESS. Momus 5/5 OKAY 게이트 + Oracle R-rerun-final-2 결과 도착 시 최종 갱신.

**현재까지 객관 사실**:
- 자가 검증 (read-only): validate-plan.sh **122 PASS / 0 FAIL** (직전 47 → +75 신 검사), verify-issues.sh 강화판 **0 mismatch (title/body sha256/milestone/labels 4중)**, verify-milestones.sh **15 PASS / 0 FAIL** (GH milestone description Wave 메타 SSOT 일치).
- 외부 검증 1차 (REJECT → fix): Momus R-rerun-1 + Oracle R-final 각각 동일 Critical (Wave 헤더 불일치) 독립 발견 → 13 fix 적용 (Critical 3 + Major 7 + Minor 3).
- 외부 검증 2차 (Momus 5/5 통과 → Oracle REJECT → fix): Momus R-rerun-2~6 5 연속 OKAY → Oracle R-rerun-final REJECT (M-5c parser truncation + GH milestone stale + Major 4 + Minor 1 발견) → 9 신 fix 적용.
- 외부 검증 3차 (진행 중): Momus 카운터 0 리셋 → R-rerun-7 OKAY (1/5) → R-rerun-8 백그라운드 진행 중. 5/5 통과 시 Oracle R-rerun-final-2 fire 예정.
- 라이브 검증 (진행 중): BUG-001 NOT reproduced (Webfetch false positive 판명), BUG-003 REPRODUCED (Nuxt SSR hydration mismatch), BUG-004 REPRODUCED (책장 선택 후 URL param 없음 — deep linking/refresh 깨짐), BUG-005 비로그인 깨끗 (사용자 로그인 후 데이터 조회 시 재확인 필요).
- GH 라이브 동기화: catalog 190 → 191 issues (+C-9d 신설), 13 issue body/title update (C-9d 1 create + 12 update + M-5c body 깨짐 fix 후 재동기화), ADMIN milestone CORE/EXTENDED 분리 + AD-1~5 P3→P1 + AD-6~8 milestone 이동 + track:extended 라벨 부여, 17개 milestone description PATCH (Wave 메타 SSOT 일치).

---

## 1. Phase 1 — 자가 검증 결과 (read-only)

### 1.1 직전 핸드오프 시점 validator (47 PASS / 0 FAIL)

```bash
$ bash scripts/migrate-v2/validate-plan.sh
TOTAL: 47 PASS / 0 FAIL
```

직전 검증 통과 그대로 재확인.

### 1.2 본 세션 종료 시점 강화판 validator (122 PASS / 0 FAIL)

신 검사 추가 (Oracle R-final + R-rerun-final false-clean 약점 보강):

| 섹션 | 검사 내용 | 출처 |
|---|---|---|
| §4b | Critical/Major/Minor 신 fix 박힘 (14건) | Oracle R-final |
| §7 | Wave 헤더 3중 일관성 (10-overview / 11-*.md / 40-mapping) | Oracle R-final Critical #1 |
| §8 | DISABLE TRIGGER / RE-ENABLE 비-금지 라인 0건 | Oracle R-final Critical #2 |
| §9 | 11-*.md 파일별 DoD 4-tuple (CHANGE/EVIDENCE/REPRODUCE/ASSERTION 모두) | Oracle R-final Major #6 |
| §10 | Hard-coded row count (snapshot/expected 미명시) 0건 | Oracle R-final Minor #3 |
| §11 | 핵심 신규 fix 본문 키워드 (7건) | R-final + R-rerun-final |
| §12 | 11-AUTH / PWA / MIGRATE / DESIGN Wave 헤더 디테일 | R-final Critical #1 디테일 |
| §13 | R-rerun-final 신규 fix 박힘 (8건) | R-rerun-final Critical/Major/Minor |
| §14 | catalog M-5c body 무결성 (9 마커 + 길이 ≥3000) | R-rerun-final Critical #1 회귀 차단 |
| §15 | Code fence balance (catalog body 안 triple-backtick 짝수) | R-rerun-final Critical #1 부수 |

### 1.3 verify-issues.sh 강화판 결과

직전 핸드오프 시점 (title 비교만): catalog 190 ↔ GH 190 1:1.
본 세션 종료 시점 (title + body sha256 + milestone + labels 4중 비교): **catalog 191 ↔ GH 191, 0 mismatch**.

```bash
TITLE: missing_in_gh=0 extra_in_gh=0
DEEP : unmatched=0 body_mismatch=0 milestone_mismatch=0 labels_mismatch=0
✅ 완벽 1:1 매핑 + 깊은 무결성 통과
```

### 1.4 verify-milestones.sh (신설)

GH 16+1 milestone 의 description 의 Wave 메타가 10-plan-overview.md §3 SSOT 와 일치하는지 검증. **15 PASS / 0 FAIL** (INFRA + ADMIN-EXTENDED 는 Wave 무관 SKIP).

---

## 2. Phase 2 — 외부 검증 루프 (Momus + Oracle)

### 2.1 모델 매칭 의심 해소 (핸드오프 §2.1 fact-check)

| 항목 | 핸드오프 주장 | 실제 확인 |
|---|---|---|
| `oracle` 모델 | `github-copilot/gpt-5.5` | **`openai/gpt-5.5`** (`~/.config/opencode/oh-my-openagent.json` `.agents.oracle.model` 실 측) |
| `momus` 모델 | `github-copilot/gpt-5.5` | **`openai/gpt-5.5`** |
| antigravity gemini-3.1-pro-high fallback 의심 | R2~R6 의심됨 | 본 세션 R-rerun 모든 라운드 응답시간 1m46s ~ 4m20s — antigravity quota 영향 없음. 동일 결과 lenient 아님. **핸드오프 §2.1 의 모델 매칭 의심은 핸드오프 자체의 모델명 오기재가 원인.** 직전 세션 R2~R6 OKAY 도 정상 모델일 가능성 ↑. |

### 2.2 외부 검증 1차 — Momus R-rerun-1 + Oracle R-final (둘 다 REJECT, 동일 Critical 독립 발견 = 신뢰 신호)

#### Momus R-rerun-1 (REJECT, 2m 52s)
1. BLOCKING: Wave 순서 충돌 (10-overview vs 11-MIGRATE/AUTH vs 40-mapping)
2. BLOCKING: PRE-4 (그룹 백로그) + PRE-5 (Admin CORE 메인 컷오버) 미전파
3. BLOCKING: DoD QA 부실 (11-CATCHUP/SOCIAL/PROFILE/ANNOTATE/PWA/ADMIN)

#### Oracle R-final (REJECT, 4m 20s, confidence 88%)
- **Critical**:
  1. Wave 메타데이터 불일치 (= Momus #1, 독립 식별 → 진짜 결함)
  2. M-5d 트리거 DISABLE/RE-ENABLE §4.0 순서 모순 (M-5d 본문은 ON CONFLICT 인데 §4.0 은 옛 안)
  3. "Valid Users" 분모가 `data/skipped_users.json` 조작에 취약 (95% 손실 위장 경로)
- **Major**: idempotency digest hash 누락 / M-5b OAuth UUID 매핑 미검증 / M-5c password hook 스키마 누락 / service_role 차단 env 이름 grep 만 / Hard Block 503 cache/SW 우회 / DoD 4-tuple 불완전 / Fix-Forward Only incident ladder 없음
- **Minor**: M-9 5명/20명 불일치 / read-only 잔존 / hard-coded 463

#### 1차 적용 patch (13건)
| ID | 위치 | 변경 |
|---|---|---|
| C #1 | 11-MIGRATE/AUTH/PWA/DESIGN 헤더 + 10-overview + 40-mapping | Wave 일관화 (MIGRATE=1, AUTH/DESIGN/PWA=2) |
| C #2 | 11-MIGRATE.md §4.0 + M-5d | DISABLE/RE-ENABLE 절대 금지 + maintenance hard block + ON CONFLICT |
| C #3 | 11-MIGRATE.md M-2 / M-9b | `valid_users.sql` SSOT + skip 사용자 |skip|>20 전수 게이트 |
| M #1 | 11-MIGRATE.md M-8 | digest hash (Critical 3 + auth.users + auth.identities) |
| M #2 | 11-MIGRATE.md M-5b DoD | 실 OAuth/token exchange + provider unique |
| M #3 | 11-MIGRATE.md M-5c | legacy_password_hashes 테이블 + hook req/resp schema + Edge fn 로직 + 30일 cron |
| M #4 | 00-meta §2.5 + 11-FOUND F-13 | service_role 5중 차단 (env / server-only / sourcemap / log / issue body) |
| M #5 | 11-CUTOVER C-9d | Cache invalidation 5중 (Cloudflare purge + SW + Cache-Control + meta refresh + staging) |
| M #7 | 11-CUTOVER §4.1 | Incident Ladder L1~L4 + Write Freeze + Comms Cadence |
| Minor #1 | 11-MIGRATE.md §6 | M-9 evidence 5명→20명 통일 |
| Minor #2 | 11-CUTOVER.md | read-only 표현 → Hard Block 503 통일 |
| Minor #3 | 11-PLAN.md P-7 | 463 하드코딩 → snapshot 기반 |
| Momus #2 | 11-SOCIAL/MIGRATE/40-mapping | PRE-4 그룹 백로그 + PRE-5 ADMIN CORE/EXTENDED 분리 |

### 2.3 외부 검증 2차 — Momus R-rerun-2~6 (5/5 OKAY 게이트 통과) + Oracle R-rerun-final (REJECT)

#### Momus 5/5 OKAY
| Round | Verdict | Duration | 검증 깊이 |
|---|---|---|---|
| R-rerun-2 | OKAY (1/5) | 3m 13s | SSOT 문서 + 15 슬라이스 + Wave 구조 + DoD/REPRODUCE 검증 |
| R-rerun-3 | OKAY (2/5) | 2m 48s | validate-plan.sh 직접 실행 (104 PASS / 0 FAIL 확인) |
| R-rerun-4 | OKAY (3/5) | 3m 48s | file://link/라인앵커 실 검증 + python script 로 broken link 확인 |
| R-rerun-5 | OKAY (4/5) | 2m 6s | 참조 파일 + 라인 앵커 + QA 4-tuple 검증 |
| R-rerun-6 | OKAY (5/5) | 1m 46s | 11-ADMIN-CORE/EXTENDED 트랙 인정 + validate-plan.sh 재실행 |

평균 응답시간 2m 44s — lenient 의심 해소.

#### Oracle R-rerun-final (REJECT, 4m 27s, confidence 84%)

**Critical #1 — M-5c GitHub Issue body 깨짐 (오케스트레이터 sync 가 만든 결함)**:
`extract-tasks.py:86-89` 의 `rest.split("|")` 가 M-5c 본문 안 `"continue" | "reject"` (markdown code block 내) 의 `|` 를 컬럼 구분자로 오인 → catalog M-5c body 가 2049 chars 에서 truncated → sync APPLY=1 이 깨진 body 를 #45 에 push. **이는 오케스트레이터가 직접 만든 결함.**

**Critical #2 — GH milestone description Wave 메타 stale**:
`02-create-milestones.sh:21-28` 이 옛 Wave (AUTH=1, MIGRATE=2) 하드코딩 + `ensure_milestone` 이 기존 시 update 안 함 → milestone description 만 보면 작업자가 AUTH 를 MIGRATE 보다 먼저 시작 가능. R-final Critical #1 회귀가 GH 실행 레이어에서 다시 깨진 상태.

**Major (4건)**: L4 unbounded escape hatch / M-5c 30일 grace dormant soft-lock / M-8 digest deterministic SQL serialization / verify-issues.sh body sha256 누락.

**Minor (1건)**: 11-DESIGN.md groups historical-only caveat.

### 2.4 2차 적용 patch (9 신 fix)

| ID | 위치 | 변경 |
|---|---|---|
| R-rerun-final C #1 | extract-tasks.py | `split_row_pipe_safe()` 추가 — triple/single backtick span 보호 후 split. M-5c body 2049 → **3411 chars** (+67%), 9 마커 모두 보존 (`reject`/`updateUserById`/`수명주기`/`30일`/`soft-deactivate`/`migrated_at`/`pbkdf2Verify`/`(b) 경로`) |
| R-rerun-final C #2 | 02-create-milestones.sh + 02b-update-milestones.sh (신설) + verify-milestones.sh (신설) | Wave 메타 갱신 + 기존 milestone PATCH 스크립트 + 일관성 검증 스크립트 |
| R-rerun-final M #1 | 11-CUTOVER.md §4.1 | L4-Gate T+96h Mandatory Decision (Plan G 승인 / Emergency Degraded Service / Migration Pause) |
| R-rerun-final M #2 | 11-MIGRATE.md M-5c 수명주기 | 30일 grace dormant soft-lock 차단 — 30/60/90일 단계 reset + 사용자 명시 승인 gate + 180일 hard ceiling |
| R-rerun-final M #3 | 11-MIGRATE.md M-8 | Deterministic Serialization (SET TIME ZONE UTC + datestyle ISO + jsonb_build_object + natural_key uniqueness assertion) |
| R-rerun-final M #4 | verify-issues.sh (강화) | title + body sha256 + milestone + labels 4중 비교 |
| R-rerun-final Minor | 11-DESIGN.md | groups historical-only (PRE-4 backlog, do NOT implement/VRT) caveat |
| validator 강화 | validate-plan.sh §13/14/15 | 신규 fix 박힘 + catalog M-5c marker + code fence balance |

### 2.5 외부 검증 3차 — Momus 카운터 0 리셋 → 진행 중

- R-rerun-7: **OKAY (1/5)**, 2m 16s. M-5c body 무결성 + Wave 일관성 + 12 patch 모두 인정.
- R-rerun-8: 백그라운드 진행 중 (`bg_70feecf4`)
- R-rerun-9~11: 5/5 게이트 통과 까지 순차 fire 예정.
- Oracle R-rerun-final-2: Momus 5/5 통과 후 fire 예정.

> **본 섹션은 5/5 통과 + Oracle 결과 도착 시 갱신**.

---

## 3. Phase 3 — 라이브 검증 (Playwright headed Chrome, persistent profile)

### 3.1 환경

- Browser: chrome (headed), session `maeil1dok-qa`, profile `/Users/jgp/Library/Caches/ms-playwright/daemon/13531abfcc04282a/ud-maeil1dok-qa-chrome`
- Target: https://maeil1dok.app (production)
- 사용자 결정 (직전 질문 답변): "그럼 네가 브라우저 띄워주면 내 계정 로그인해줄게" — 본인 계정 직접 로그인. production User 테이블 신 row 생성 회피.

### 3.2 비로그인 검증 결과

| BUG ID | 핸드오프 §1 04-audit 주장 | Playwright 재현 결과 | 단정 |
|---|---|---|---|
| BUG-001 | 성경 본문 미표시 (Webfetch 결과) | `/bible` 창세기 1장 31절 모두 native text 정상 렌더링 (snapshot e25~e116) | **NOT reproduced — Webfetch JS 미실행 한계로 인한 false positive 판명.** 04-production-live-audit.md §1 의 이 BUG 항목은 무효 처리 권장. |
| BUG-003 | 콘솔 에러 다수 | 1 REAL (Nuxt SSR hydration mismatch on `https://maeil1dok.app/_nuxt/BhhimqVo.js:1`) + 2 NOT-OURS (401 비로그인 정상, 403 doubleclick 광고 3rd party) | **REPRODUCED — Nuxt SSR hydration mismatch는 실 production 결함.** 새 Next 마이그레이션 시 이 회귀 차단 의무. |
| BUG-004 | 책장 선택 URL undefined | 요한복음 3장 선택 → URL=`https://maeil1dok.app/bible` (query param 없음, title 만 "요한복음 3장 \| 매일일독" 으로 갱신) | **REPRODUCED — 책장 선택 시 URL param 없음 → deep linking + refresh + URL 공유 모두 깨짐.** 11-READER.md 가 URL 단방향 fix 의무로 박혀 있어 v2 에서 해결 예정. |
| BUG-005 (비로그인) | /bible/highlights placeholder 노출 ("Task 3-3에서 구현 예정") | "데이터가 없습니다" + 로그인 안내 + 책 필터 + 색상 필터 정상. placeholder 텍스트 grep = 0 hits | **NOT REPRODUCED (비로그인).** 로그인 후 본인 highlights 데이터 조회 시 placeholder 노출 여부 별도 검증 필요 (사용자 로그인 의존). |

### 3.3 로그인 후 검증 (진행 중 — 사용자 로그인 대기)

> **상태**: 브라우저 띄워져 있음 (https://maeil1dok.app/bible 요한복음 3장). 사용자가 본인 계정으로 로그인 후 다음 항목 자동화 진행:
> - BUG-005 with data (본인 hightlights 데이터 조회 시 placeholder/오류 검증)
> - 다크모드 토글 동작 + 시각 회귀
> - 모바일 viewport (375px) vs 데스크탑 (1280px)
> - 04-production-live-audit.md §5 L-1~L-7 항목 채움 (Playwright 인증 주입 검증)

### 3.4 GH 라이브 결과 (sync + label/milestone 재매핑)

| 작업 | 결과 |
|---|---|
| `sync-issues.sh APPLY=1` (1차) | 12 update + 1 create (C-9d) — 0 fail |
| `track:extended` 라벨 신규 생성 | 1/1 |
| `v2/ADMIN-EXTENDED` milestone (#17) 신규 생성 | 1/1 |
| `v2/ADMIN` (#15) → `v2/ADMIN-CORE` rename | 1/1 |
| AD-1~5 (#153~157) 라벨 P3→P1 | 5/5 |
| AD-6~8 (#158~160) milestone ADMIN-EXTENDED 이동 + track:extended | 3/3 |
| `sync-issues.sh APPLY=1` (2차 — M-5c 깨진 body fix) | 1 update (#45) — M-5c 3411 chars 재동기화 |
| `02b-update-milestones.sh APPLY=1` (milestone description PATCH) | 17/17 PATCH 완료 — Wave 메타 SSOT 일치 |

---

## 4. 누적 적용 patch 인덱스 (본 세션)

총 22 신 patch (이전 세션 48 + 본 세션 22 = **누적 70**):

### 4.1 본 세션 1차 (Oracle R-final 13 fix)

(Critical 3 + Major 7 + Minor 3 — §2.2 표 참조)

### 4.2 본 세션 2차 (Oracle R-rerun-final 9 fix + validator §13/14/15 추가)

(§2.4 표 참조)

---

## 5. 신뢰성 우려 사항 재검토 (핸드오프 §2)

| 핸드오프 우려 | 본 세션 결론 |
|---|---|
| §2.1 모델 매칭 의심 (Momus R2~R6 antigravity fallback) | **해소** — 실제 모델은 `openai/gpt-5.5` (핸드오프 문서 자체의 모델명 오기재). 본 세션 모든 Momus R-rerun 응답시간 1m46s~3m48s 으로 lenient 아님. |
| §2.2 외부 검증 차단 (workspace credits = 0, antigravity 401) | **해소** — `openai/gpt-5.5` 는 antigravity 와 무관. 모든 외부 라운드 정상 실행. |
| §2.3 라이브 검증 부족 (Webfetch 한계) | **부분 해소** — Playwright headed 로 BUG-001 false positive 판명 + BUG-003/BUG-004 REPRODUCED 단정 + BUG-005 비로그인 깨끗. 로그인 후 추가 검증 진행 중. |

---

## 6. 진행 중 (본 섹션 종료 직전 갱신)

- Momus R-rerun-8~11 (5/5 게이트 통과까지)
- Oracle R-rerun-final-2 (5/5 통과 후)
- Phase 3 로그인 후 라이브 검증 (BUG-005 data / dark mode / mobile viewport)
- 본 문서 §0 최종 Verdict 갱신
- 04-production-live-audit.md §5 L-1~L-7 채움

---

## 7. 다음 단계 결정 (사용자 승인 필요)

다음 세션에서 진행할 영역. 본 세션 최종 verdict 도착 시 사용자에게 결정 요청:

1. Gate H 진입 (실 코드 작업 시작) — `validate-plan.sh` 122 PASS + Momus 5/5 + Oracle APPROVE/CONDITIONAL 충족 시
2. 추가 검증 루프 (불필요 의심 시) — 별도 세션
3. 라이브 보강 별도 세션 — 본 세션 미완료 항목 인계

---

## 8. 본 세션의 결정 사항 (재논의 금지)

- 핸드오프 §1 04-production-live-audit.md 의 BUG-001 (성경 본문 미표시) 는 Webfetch 한계로 인한 false positive 로 단정 (04-audit.md 본문 수정 권장).
- M-5c parser corruption (R-rerun-final Critical #1) 은 오케스트레이터가 만든 결함. 동일 패턴 (markdown table row 안 backtick span 의 `|`) 재발 방지를 위해 `validate-plan.sh §15 code fence balance` + `§14 M-5c body marker` 영구 박힘.
- ADMIN milestone 분할 (CORE 메인 컷오버 포함 / EXTENDED 별도 트랙) 은 catalog/GH 양쪽 모두 영구 적용. `extract-tasks.py` 의 SLICE_META ADMIN 우선순위 P3 → P1 + ADMIN_EXTENDED_IDS 분리 코드 영구 박힘.

<!-- handoff-rerun-version: 1 -->
<!-- handoff-rerun-date: 2026-05-28 -->
<!-- handoff-rerun-status: IN-PROGRESS (Momus 5/5 게이트 + Oracle R-rerun-final-2 + 사용자 로그인 후 Phase 3 잔여 항목 도착 시 §0/§6/§3.3 갱신) -->
