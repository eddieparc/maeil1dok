# 40 · GitHub Issues + Milestones 매핑

> **상태**: 스켈레톤 — Gate F (Oracle 최종 통과) 후 실제 GH 생성.  
> **목적**: 확정 플랜의 모든 작업 항목을 GitHub 에 등록하여 **하나도 놓치지 않게 추적**.

---

## 1. Milestone 매핑 (15개 슬라이스 → 15 Milestones + 1 인프라)

| Milestone 이름 | Wave | 슬라이스 파일 | 우선순위 (06 §4) |
|---|---|---|---|
| `v2/FOUND — Foundation 복구` | 0 | 11-FOUND.md | P0 |
| `v2/MIGRATE — 데이터 마이그레이션 v2` | 1 | 11-MIGRATE.md | P0 |
| `v2/AUTH — 인증 시스템` | 2 | 11-AUTH.md | P1 |
| `v2/DESIGN — 디자인 검증` | 2 | 11-DESIGN.md | P1 |
| `v2/PWA — PWA+FCM` | 2 | 11-PWA.md | P2 |
| `v2/READER — 성경 뷰어` | 3 | 11-READER.md | P0 |
| `v2/PLAN — 통독 플랜·일정` | 3 | 11-PLAN.md | P1 |
| `v2/ANNOTATE — 북마크·하이라이트·노트` | 3 | 11-ANNOTATE.md | P1 |
| `v2/PROGRESS — 진도 추적` | 4 | 11-PROGRESS.md | P1 |
| `v2/HASENA — 하세나` | 4 | 11-HASENA.md | P2 |
| `v2/CATCHUP — 캐치업` | 4 | 11-CATCHUP.md | P2 |
| `v2/PROFILE — 프로필·업적·잔디` | 4 | 11-PROFILE.md | P2 |
| `v2/SOCIAL — 친구·스코어보드` | 5 | 11-SOCIAL.md | P2 |
| `v2/ADMIN-CORE — 관리자 핵심 (메인 컷오버 포함, PRE-5)` | 5 | 11-ADMIN.md §3 | P1 (메인 컷오버 포함, 없으면 운영 마비) |
| `v2/ADMIN-EXTENDED — 관리자 확장 (컷오버 후, PRE-5)` | (별도 트랙) | 11-ADMIN.md §4 | P3 (안정화 후) |
| `v2/CUTOVER — 실 컷오버` | 6 | 11-CUTOVER.md | P0 (마지막) |
| `v2/INFRA — 메타 시스템·CI` | 0 | 00-meta-system.md | P0 |

> **Oracle R-final Critical #1 일관화**: 본 표의 Wave 순서가 [10-plan-overview.md §3 Wave 구조](10-plan-overview.md) 와 각 [11-*.md 슬라이스 헤더](.) 와 1:1 일치하도록 갱신됨. `validate-plan.sh` 가 3중 일치를 강제 검사.

> **Momus #2 / PRE-5 일관화**: ADMIN 마일스톤이 CORE (메인 컷오버 포함, P1) / EXTENDED (별도 트랙, P3) 로 분리됨. [10-plan-overview §0 PRE-5](10-plan-overview.md#L19) 와 [11-ADMIN.md §3·§4](11-ADMIN.md) 의 분할 결정 반영.

---

## 2. Label 스킴

### 2.1 슬라이스 라벨 (15개)
- `slice:FOUND`, `slice:AUTH`, `slice:DESIGN`, `slice:PWA`, `slice:MIGRATE`, `slice:READER`, `slice:PLAN`, `slice:ANNOTATE`, `slice:PROGRESS`, `slice:HASENA`, `slice:CATCHUP`, `slice:PROFILE`, `slice:SOCIAL`, `slice:ADMIN`, `slice:CUTOVER`

### 2.2 우선순위 라벨
- `P0` (블로커, 즉시)
- `P1` (컷오버 전 필수)
- `P2` (컷오버 직전)
- `P3` (안정화 후)
- `backlog`

### 2.3 분류 라벨 (05 매트릭스에서)
- `gap:missing` — Nuxt 에 있는데 Next 없음
- `gap:regression` — Next 측 깨짐
- `gap:bug` — 라이브 확인된 버그
- `gap:new` — Next 신규
- `gap:obsolete` — v2 에서 제거
- `gap:defer` — PRE 결정에 따라 후순위

### 2.4 카테고리 라벨
- `type:meta` — 메타 시스템·CI·governance
- `type:data` — 데이터 마이그레이션·검증
- `type:auth` — 인증·세션
- `type:ux` — 시각·a11y·VRT
- `type:test` — 테스트 작성·실행
- `type:infra` — DNS·OAuth·Vercel·Supabase 설정
- `type:docs` — 문서

### 2.5 상태 라벨
- `state:blocked` — 결정 대기
- `state:ready` — 작업 시작 가능
- `state:in-progress` — 진행 중
- `state:review` — PR 리뷰 대기
- `state:done` — 완료 + DoD 통과

---

## 3. Issue 템플릿

### 3.1 작업 이슈 (`.github/ISSUE_TEMPLATE/v2-task.md`)

```markdown
---
name: v2 작업
about: 마이그레이션 v2 단일 작업 단위
labels: [needs-review]
---

## 슬라이스 / 작업
**슬라이스**: `slice:XXX`  
**플랜 라인**: docs/migration-v2/11-XXX.md#L{lineno}  
**Wave**: N  
**의존**: #X, #Y

## 작업 내용 (구체적)
(슬라이스 플랜의 What to do 그대로)

## DoD 4중 (모두 체크돼야 close)
- [ ] **CHANGE** — diff 파일 목록: (PR 머지 시 자동)
- [ ] **EVIDENCE** — 증거 파일: `.sisyphus/evidence/{slice}-{task}.{ext}` 경로
- [ ] **REPRODUCE** — 재현 명령:
      ```
      <한 줄 명령>
      ```
- [ ] **ASSERTION** — 측정값 (예: "TS errors: 0", "row count: N==N", "playwright: 12/12 passed")

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷으로 통과 처리 금지

## 회귀 방지 명시 (해당 시)
- 직전 BUG ID: (BUG-001, BUG-005, T0004 등)
- 본 작업이 그 회귀를 막는 방법:

## Linked
- PR: (머지 시 close)
- 슬라이스: 
- 메타 시스템 규칙: (적용되는 00-meta §N)
```

### 3.2 결정 이슈 (PRE-X / *D-N)

```markdown
---
name: 결정 (Decision)
about: 의사결정 필요 항목
labels: [decision, needs-review]
---

## 결정 ID
PRE-X 또는 AD-N / MD-N / RD-N 등

## 배경
(왜 결정이 필요한지)

## 옵션
- [ ] A. ...
- [ ] B. ...
- [ ] C. ...

## 추천 (자동)
> Option X — 이유: ...

## 영향 받는 슬라이스
- slice:XXX
- slice:YYY

## 결정 후
- 영향 슬라이스 플랜 수정
- 결정 docs/migration-v2/10-plan-overview.md §0 에 반영
```

---

## 4. Issue 카탈로그 (작성 예정)

> Gate F (Oracle 통과) 후 본 표를 실제 `gh issue create` 명령으로 일괄 생성.

각 슬라이스의 작업 항목을 Issue 1개씩 매핑:

| 슬라이스 | 작업 ID (플랜 내) | Issue 제목 (예시) | 라벨 |
|---|---|---|---|
| **11-FOUND** | F-1 ~ F-14 | "환경 복구", "TS 에러 5건 해소", "WIP 커밋 분리"... | slice:FOUND, P0 |
| **11-AUTH** | A-1 ~ A-21 | "Supabase OAuth provider 등록", "이메일 가입 흐름"... | slice:AUTH, P1 |
| **11-MIGRATE** | M-1 ~ M-16 | "Rate limit 한계 측정", "5% hard fail 적용", "멱등성 fix"... | slice:MIGRATE, P0 |
| **11-READER** | R-1 ~ R-15 | "URL schema Zod", "본문 텍스트 e2e", "iframe 정상화"... | slice:READER, P0 |
| **11-PLAN** | P-1 ~ P-8 | "플랜 목록", "구독", "해지", "캘린더"... | slice:PLAN, P1 |
| **11-PROGRESS** | PR-1 ~ PR-12 | "읽음 토글", "통계", "잔디"... | slice:PROGRESS, P1 |
| **11-HASENA** | H-1 ~ H-5 | "오늘 하세나", "토글", "과거 조회"... | slice:HASENA, P2 |
| **11-CATCHUP** | CA-1 ~ CA-6 | "TS 에러 해소", "preview", "create"... | slice:CATCHUP, P2 |
| **11-SOCIAL** | S-1 ~ S-8 | "팔로우", "친구검색", "스코어보드"... | slice:SOCIAL, P2 |
| **11-PROFILE** | PF-1 ~ PF-5 | "프로필 표시", "편집", "잔디"... | slice:PROFILE, P2 |
| **11-ANNOTATE** | AN-1 ~ AN-9 | "구절 선택→메뉴", "북마크 목록", "노트 CRUD"... | slice:ANNOTATE, P1 |
| **11-DESIGN** | D-1 ~ D-19 | "dark VRT 회복", "axe 7건", "BookSelector 회귀"... | slice:DESIGN, P1 |
| **11-PWA** | PW-1 ~ PW-6 | "매니페스트", "iOS PWA", "FCM 토큰"... | slice:PWA, P2 |
| **11-ADMIN** | AD-1 ~ AD-6 | (별도 컷오버) | slice:ADMIN, P3 |
| **11-CUTOVER** | C-1 ~ C-24 | "사전 검증", "DNS 전환", "스모크"... | slice:CUTOVER, P0 |

**예상 Issue 수**: 약 150개 (작업 항목 합계).

추가:
- **결정 Issue**: PRE-1~7 (7개) + 슬라이스별 *D-N (약 30개) = 약 37개
- **메타 인프라 Issue**: pre-push hook, placeholder grep CI, plan-checksum 동기화 — 약 10개

**총 약 200개 Issue / 16개 Milestone**.

---

## 5. 자동 생성 명령 (Gate F 통과 후 사용)

본 매핑은 `gh` CLI 로 일괄 생성 가능. 스크립트는 Gate F 통과 후 작성.

```bash
# 예시 (실제는 generate 스크립트로 batch)
gh milestone create "v2/FOUND" --description "Foundation 복구 — 빌드 그린 + 환경 + WIP 정리"
gh issue create \
  --title "[FOUND] TS 에러 5건 해소 (빌드 그린)" \
  --milestone "v2/FOUND" \
  --label "slice:FOUND,P0,type:meta" \
  --body-file scripts/issues/found/ts-errors.md
```

생성 스크립트 위치 (작성 예정): `scripts/migrate-v2/generate-issues.sh`

---

## 6. 추적·동기화

### 6.1 GitHub Issue ↔ 플랜 체크박스 동기화 (00-meta §2.7)

Issue 가 close 되면 해당 슬라이스 플랜의 체크박스도 `[ ]` → `[x]`. CI 또는 GH Action 으로 자동화.

### 6.2 Plan checksum (00-meta §2.6)

각 11-*.md 의 메타 코멘트:
```
<!-- plan-checksum: PENDING -->
```

→ Gate F 통과 시 sha256 첫 8자로 갱신. 이후 변경 시 검출.

---

## 7. GitHub Project (Kanban) 활용 정책 (자가 R3 Self-7)

186 이슈 추적을 사용자가 직접 따라가기 어려움. GH Project (V2 / 신규) 활용:

| Project View | 필터 | 용도 |
|---|---|---|
| **By Wave** | milestone group: Wave 0~6 | 진행 단계 시각화 |
| **By Slice** | label: slice:* | 슬라이스별 진척 |
| **By Priority** | label: P0/P1/P2/P3 | 우선순위 큐 |
| **Critical Path** | label: slice:FOUND OR MIGRATE OR AUTH OR READER OR PROGRESS OR CUTOVER + sort by milestone | 크리티컬 패스 트래킹 |
| **Blocked** | label: state:blocked | 결정 대기 |

생성 명령 (Gate G 통과 후):
```bash
gh project create --owner eddieparc --title "Migration v2 — 매일일독 Nuxt→Next 재출범"
# Project 에 모든 v2 milestone 의 이슈 자동 추가 — gh project item-add
```

## 8. 본 문서의 진행 상태

- [x] Milestone 매핑 정의 (15+1)
- [x] Label 스킴 정의
- [x] Issue 템플릿 (작업 + 결정)
- [x] Issue 카탈로그 자동 생성 (186 issue, catalog.json)
- [x] GH Project 활용 정책 (Kanban)
- [ ] **Gate F (Oracle 최종 리뷰) 통과 후 실제 `gh` 명령 생성**
- [ ] 자동 동기화 워크플로우 (.github/workflows/plan-sync.yml)

<!-- mapping-version: 2 -->
