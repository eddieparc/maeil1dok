# 11-DESIGN · 디자인 시스템 검증 + VRT 회복

> **슬라이스 ID**: 11-DESIGN  
> **Wave**: 2 (병렬 — data 무관, MIGRATE 산출물과 독립; Oracle R-final Critical #1 + Momus #1 일관화)  
> **의존**: 11-FOUND  
> **추정 크기**: M

---

## 1. 목표

Plan F 시기 검출됐던 시각 회귀 실패 (F1·F2·F3) 영역을 **검증 가능한 상태**로 복구. 디자인 토큰화는 이미 5월까지 진행되어 왔으므로 본 슬라이스는 **검증/잔존 위반 해소/회귀 방지**가 중심.

---

## 2. 기존 자산 검증 필요

### 2.1 5월까지 누적된 디자인 작업

git log 발췌:
- 토큰화: ui/Toast, Card, Button, Badge, Container, Input, Textarea, Select, Modal, EmptyState
- 페이지 토큰화: friends, scoreboard, profile, catchup, **groups (historical only — PRE-4 backlog, do NOT implement/VRT in v2; Oracle R-rerun-final Minor #1 caveat)**, hasena, home, reading, intro, plans, calendar, auth, public
- 다크모드: 4건의 darkmode commit
- 타이포그래피: heading hierarchy + custom font sizes 제거
- 접근성: aria-labels, focus rings, form components focus-visible

### 2.2 미해결 위반 (design-polish/issues.md)

| 위반 | 증거 | 우선 |
|---|---|---|
| F3: home-light.png VRT 35,407 픽셀 diff | design-polish issues §F3 | P1 |
| F2: playwright.config.ts testMatch ↔ ignore 모순 → dark VRT 미실행 | 같은 곳 | P0 |
| axe color-contrast 위반 7건 (login/register-email/company/home/plans/reading/settings) | 같은 곳 | P1 |
| BookSelector, BibleReaderHeader, BibleReaderView.css 5월 변경의 회귀 여부 | git show e5269db | P1 |

---

## 3. 작업 항목

### 3.1 VRT 인프라 복구 (F2·F3)

| # | 작업 | DoD |
|---|---|---|
| D-1 | playwright.config.ts 의 dark VRT testMatch ↔ ignore 충돌 제거 | `npx playwright test --list` 에 dark VRT 등장 |
| D-2 | dark VRT 실 1회 실행 → baseline 갱신 또는 fail 명시 | snapshots 디렉토리 갱신 + commit |
| D-3 | home-light 35,407 픽셀 diff 원인 — 의도된 변화 (디자인 업데이트) 라면 baseline 갱신, 회귀라면 fix | diff 원인 보고서 + 결정 + 적용 |
| D-4 | VRT 실행 시 fail 시 무시 금지 — CI 에 noUncommitted snapshot 강제 | 의도 회귀 시도 → CI fail 확인 |

### 3.2 접근성 7건 해소

| # | 작업 | 페이지 | DoD |
|---|---|---|---|
| D-5 | login color contrast | login | axe 통과 |
| D-6 | register-email contrast | register-email | axe 통과 |
| D-7 | company contrast | company | axe 통과 |
| D-8 | home contrast | (authenticated)/home | axe 통과 |
| D-9 | plans contrast | plans | axe 통과 |
| D-10 | reading contrast | reading | axe 통과 |
| D-11 | settings contrast | settings | axe 통과 |

### 3.3 5월 WIP 변경 회귀 검증

| # | 작업 | DoD |
|---|---|---|
| D-12 | BookSelector.tsx 5월 변경 (525 line diff) — 책 선택 UX 회귀 검증 | playwright: 책 선택 → 본문 정상 (BUG-004 회귀 0) |
| D-13 | BibleReaderHeader, BibleReaderView.css 변경 — 헤더 + 본문 영역 시각 회귀 | VRT diff 0 px |
| D-14 | buildInteractiveSrcDoc.ts (iframe) — 본문 렌더 영향 | 11-READER 와 협업 |

### 3.4 다크모드 잔존 위반 ([`docs/audit_tmp/darkmode_audit_v2.md`](file:///Users/jgp/GitHub/maeil1dok/docs/audit_tmp/darkmode_audit_v2.md) — Momus R-rerun-19 fix 실 경로)

| # | 작업 | DoD |
|---|---|---|
| D-15 | 다크모드 토글 → 모든 페이지 즉시 반영 | 라우트 × 라이트/다크 = 2N 스크린샷 비교 |
| D-16 | 시스템 테마 변경 → 자동 반영 | next-themes attribute=class 동작 검증 |

### 3.5 회귀 방지 시스템

| # | 작업 | DoD |
|---|---|---|
| D-17 | CI VRT — PR 마다 자동 실행 + diff 결과 PR 코멘트 | 의도 회귀 PR → 빨강 |
| D-18 | placeholder grep — production 빌드에서 "구현 예정", "TODO production" 등 검출 시 CI fail (00-meta §2.6) | 의도 검출 시 실패 |
| D-19 | a11y baseline — axe violations 0 외에 증가 시 fail | 동일 |

---

## 4. 결정 사항

| 결정 | 옵션 |
|---|---|
| DD-1 | home-light 35,407 픽셀 — baseline 갱신 / 회귀 fix |
| DD-2 | VRT 도구 — 현 playwright 유지 / 다른 도구 |
| DD-3 | 디자인 시스템 SSOT atom 추가 작성 여부 (LeaderLabel 같은 도메인 라벨) |

---

## 5. DoD 통합

- **CHANGE**: playwright.config.ts, tests/e2e/visual-regression*, design tokens, 페이지별 색상 fix
- **EVIDENCE**: 
  - `.sisyphus/evidence/11-DESIGN-vrt/` — light + dark VRT 결과
  - axe 리포트 (모든 라우트 violations 0)
- **REPRODUCE**: `npx playwright test tests/e2e/visual-regression*`
- **ASSERTION**:
  - dark VRT: 실제 실행됨 (`--list` 등장)
  - VRT diff: 0 px (모든 baseline 라우트)
  - axe violations: 0
  - placeholder grep: 0 hits in production build

<!-- plan-checksum: PENDING -->
