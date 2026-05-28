# 10 · Migration Master Plan v2 (Overview)

> **상태**: 스켈레톤 — Gate C(품질 스코어카드 + 사용자 직감) 완료 후 본문 채움.  
> **전제**: 본 플랜은 [`05-feature-matrix.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/05-feature-matrix.md) 의 GAP 컬럼과 [`06-quality-scorecard.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/06-quality-scorecard.md) 의 우선순위 매트릭스에서 직접 도출된다.  
> **체크섬**: 작성 완료 시 `<!-- plan-checksum: sha256-first-8 -->` 메타 박음 (00-meta-system.md §2.6).

---

## 0. 사전 전제 (Prerequisites) — DEFAULT 잠정 적용

> **상태**: 2026-05-28 사장님 사인 미확인 시점에서 추천안을 DEFAULT 로 적용. 추후 다른 결정 시 영향 슬라이스 재조정 필요.

| ID | 전제 | 결정 | 영향 슬라이스 |
|---|---|---|---|
| PRE-1 | 컷오버 방식 | **Big Bang (점검 두고 한 번에)** | 11-CUTOVER |
| PRE-2 | 3월 Supabase 잔재 (64명 부분 마이그레이션) | **TRUNCATE 후 처음부터** | 11-MIGRATE |
| PRE-3 | 옛 Nuxt 시스템 | **동결 (긴급 보안 외 손대지 않음)** | 모든 슬라이스 (5월 WIP 작업 정리는 11-FOUND) |
| PRE-4 | 그룹 기능 (ReadingGroup/Membership/Invitation) | **백로그 (이번 v2 에서 제외)** | 11-SOCIAL 축소, 11-MIGRATE 에서 그룹 3 테이블 SKIP |
| PRE-5 | Admin 도구 (`/admin/*`) | **수정 (Momus R1 BLOCKING #4)**: 핵심 쓰기 기능 (플랜 엑셀 업로드, 영상 인트로 업로드, 하세나 요약 재생성) 은 **메인 컷오버에 포함** (11-ADMIN-CORE, Wave 5). 통계·대시보드 등 비쓰기 부분만 별도 컷오버. | 11-ADMIN-CORE 메인 포함 / 11-ADMIN-EXTENDED 별도 트랙 |
| PRE-6 | UserAchievement 데이터 | **재계산 (streak 기반 자동 산출 로직)** | 11-PROFILE, 11-PROGRESS |
| PRE-7 | 일정 / 컷오버 시점 | **장인 정신 — 시간 제약 없음, 품질 기준만 따짐**. **Mn4: 단, production 측이 시간 흐름에 따라 drift (신규 사용자/데이터/버그) 가능 — 매월 1회 인벤토리 재확인 의무. drift 1% 초과 시 plan 재합의** | 모든 게이트 통과 기준이 시간 압박 0 + 월간 drift 체크 |

**Contest 가능**: 위 결정 중 하나라도 사장님 의향과 다르면 해당 ID 지목해 알려주시면 슬라이스 재조정.

추가 도출 결정 (각 슬라이스 내부의 `*D-N`):
- AD-1~4 (인증 정책 4개)
- MD-1~6 (마이그레이션 정책 6개)
- RD-1~4 (Reader 정책)
- 외 슬라이스 마다 평균 2~4개

→ 위 슬라이스 정밀화 (Gate D) 단계에서 한 번에 묶어 추가 결정 요청.

---

## 1. 마스터 플랜 v2의 8가지 원칙

> 본 8개 원칙은 [`00-meta-system.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/00-meta-system.md) 에서 도출. 모든 슬라이스 플랜에 강제 적용.

1. **Definition of Done 4중 강제** — CHANGE / EVIDENCE / REPRODUCE / ASSERTION
2. **5% 데이터 손실 임계 = hard fail** — fail-soft 금지
3. **인증 우회 스크린샷 = 무효** — Playwright 검증은 인증 주입 필수
4. **빌드 그린 ≠ 완료** — 런타임 스모크 의무
5. **스코프 체크섬** — Plan ↔ Diff 1:1 매핑
6. **WIP 커밋 main push 금지** — pre-push hook
7. **체크박스 ≡ GitHub Issue 상태** — 자동 동기화
8. **사용자 직감 슬롯 AI 금지** — 06 §3 사용자만 채움

---

## 2. 슬라이스 분할 전략 (영역별 독립 플랜)

> 각 슬라이스는 다른 슬라이스와 거의 독립 배포 가능하도록 분할. 일정 압박 시 슬라이스 단위로 컷.

| ID | 슬라이스 | 영역 | 추정 크기 | 의존성 |
|---|---|---|---|---|
| 11-FOUND | Foundation 복구 | 빌드 그린 + 환경 + WIP 정리 + lsp clean + 기본 라우팅 | S | — |
| 11-AUTH | 인증 (이메일/소셜/세션) | login/register/oauth callback/세션 영속 + 새로고침 로그인 유지 | M | FOUND |
| 11-MIGRATE | 데이터 마이그레이션 v2 | 03a/03b 모델 → Supabase, 매핑 정확성 100%, 멱등성 검증 | L | AUTH |
| 11-READER | 성경 본문 뷰어 | /bible (Nuxt 1198행) → Next 슬림화 + 본문 표시 + 역본 + URL 파라미터 | L | MIGRATE |
| 11-PLAN | 통독 플랜 / 일정 | /plan, /plans, schedule API, 진도율, 캘린더 | M | READER |
| 11-PROGRESS | 진도 추적 + 사용자 데이터 | 읽음 표시, 통계, 히스토리, hasena 진도 | M | PLAN |
| 11-HASENA | 하세나 (묵상/요약) | hasena 일정 + 요약 + 나눔 | M | PROGRESS |
| 11-CATCHUP | 캐치업 (밀린 일정) | catchup session/schedule, 재배치 알고리즘 | M | PROGRESS |
| 11-SOCIAL | 친구/팔로우/그룹/스코어보드 | follows, group leaderboard, scoreboard | M | PROGRESS, AUTH |
| 11-PROFILE | 프로필 + 업적 + 잔디 | profile/[id], 업적 추적 (Plan F는 SKIP했음 — v2는 재개) | S | PROGRESS |
| 11-ANNOTATE | 북마크/하이라이트/노트 | bookmark, highlight, note (Plan F는 UI 없이 데이터만) | M | READER |
| 11-DESIGN | 디자인 시스템 검증 | VRT 회복 + 다크모드 검증 + a11y 7개 위반 해소 | M | FOUND |
| 11-PWA | PWA + FCM | service worker + push token + apple/google/fcm | M | AUTH |
| 11-ADMIN | Admin 도구 (조건부) | /admin/* — 사용자 결정 따라 포함/제외 | M | MIGRATE |
| 11-CUTOVER | 실 컷오버 | DNS + OAuth redirect URI + maintenance + smoke + VPS 폐기 | M | 모든 11-* + 사전 검증 |

각 슬라이스는 별도 마크다운 파일로 분리되어 `11-{id}.md` 로 작성됨. 본 파일은 인덱스 + 의존 그래프.

---

## 3. Wave 구조 (병렬 실행 단위) — Momus R1 BLOCKING #2 반영

> **수정 사유**: 직전 구조는 Wave 1 의 11-AUTH 가 운영 Supabase 측 OAuth Provider 등록·테스트를 포함했는데, Wave 2 의 11-MIGRATE 가 TRUNCATE 를 수행하면서 1차 검증 상태를 파괴할 수 있었음. **11-MIGRATE 를 Wave 1 로 끌어올리고, 11-AUTH 의 운영 환경 검증을 MIGRATE 직후 (Wave 2) 로 이동.**

```
Wave 0 (직렬):
└── 11-FOUND  ← 빌드 그린 + WIP 정리

Wave 1 (직렬 단독 — DB 파괴적 작업이므로 병렬 금지):
└── 11-MIGRATE  ← TRUNCATE + 사용자 사전 생성 (M-1~M-9 + M-5b-pre + M-5b~M-5e). 운영 Supabase 의 SoT.
                  Mn3: 권장 timebox 2주 (장인정신 무한정 회피). 초과 시 deep-dive 검토.

Wave 2 (병렬 3개 — MIGRATE 산출물 위에서):
├── 11-AUTH      ← Supabase Auth Provider 등록 + OAuth 콜백 + 새로고침 회귀 (사용자 mapping 위에서 검증)
├── 11-DESIGN    ← VRT 회복 + a11y + 다크모드 (data 무관)
└── 11-PWA       ← 매니페스트 + iOS + 인프라 (FCM 실 등록은 Wave 3로 지연 — Momus R1 Minor #3)

Wave 3 (병렬 3개):
├── 11-READER    ← /bible 본문 + URL + 인터랙션
├── 11-PLAN      ← 플랜·일정 (MIGRATE 의 plan_subscriptions 위에서)
└── 11-ANNOTATE  ← 북마크/하이라이트/노트 (BUG-005 해소)

Wave 4 (병렬 4개):
├── 11-PROGRESS  ← 진도 추적 (CRITICAL 데이터)
├── 11-HASENA
├── 11-CATCHUP
└── 11-PROFILE   ← Achievement 재계산

Wave 5 (병렬 2개):
├── 11-SOCIAL    ← 친구·스코어보드 (그룹은 backlog)
└── 11-ADMIN-CORE ← Admin 핵심 쓰기 기능 (플랜 엑셀 업로드 + 영상 인트로 업로드 + 하세나 요약 재생성) — Momus R1 BLOCKING #4

Wave 6 (직렬):
└── 11-CUTOVER   ← DNS + smoke + Fix-forward only

별도 트랙 (메인 의존성 없음):
└── 11-ADMIN-EXTENDED ← 통계·대시보드 등 비-쓰기 Admin (PRE-5의 잔여, 컷오버 후 안정화 단계)
```

**크리티컬 패스**: FOUND → MIGRATE → AUTH → READER → PROGRESS → ADMIN-CORE → CUTOVER (7 슬라이스)

**병렬화 안전 원칙**:
- DB 파괴적 작업 (TRUNCATE, 스키마 변경) 은 Wave 단독 직렬.
- 운영 Supabase 의 read-only 작업 (검증/스모크) 만 병렬 허용.
- FCM 토큰 실 등록은 사용자 사전 생성 후 (Wave 3 이후) — Wave 1/2 에서는 Mock 만.

---

## 4. 직전 시도와의 차이점 (Plan F 대비)

| 측면 | Plan F (2026-03) | Plan v2 (현재) |
|---|---|---|
| 마이그레이션 데이터 검증 임계 | 5% (fail-soft) | 5% (hard fail) |
| 인증 우회 스크린샷 처리 | 통과 처리됨 (F1) | 무효 처리 (Playwright 인증 주입 의무) |
| VRT 검증 | 미실행 (F2) | dark/light 양쪽 강제 실행, diff > 0 = fail |
| 빌드 깨진 상태 | 세션 종료 허용 (F5) | 종료 전 그린 의무 |
| 체크박스 vs 실 진척 | 불일치 허용 (F8) | GitHub Issue 자동 동기화 |
| 스코프 통제 | 없음 (WIP 커밋 폭주, F7) | 체크섬 + PR description 매핑 |
| 사용자 직감 반영 | 없음 | 06 §3 슬롯 + 직감≠자동 행 재조사 |
| Plan 적대적 크리틱 | Metis 1회 타임아웃 후 진행 | Momus 5회 연속 OK까지 강제 |

---

## 5. 산출물 인덱스 (Gate D 단계 1차 산출 완료, 인벤토리 도착 후 정밀화)

| 파일 | 라인 | 상태 | 비고 |
|---|---|---|---|
| [`11-FOUND.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-FOUND.md) | ~190 | 1차 산출 | 빌드 그린 + WIP 정리 + 환경 복구 |
| [`11-AUTH.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-AUTH.md) | ~210 | 1차 산출 | 03a 기반 인증 흐름 + 직전 3개 버그 회귀 방지 |
| [`11-MIGRATE.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-MIGRATE.md) | ~180 | 1차 산출 | Plan F 95% 손실 근본 원인 + v2 변경점 |
| [`11-READER.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-READER.md) | ~140 | 1차 산출 | /bible 뷰어 (Nuxt 1198 → Next 슬림) |
| [`11-PLAN.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-PLAN.md) | ~80 | 1차 산출 | 플랜 구독/해지/캘린더 |
| [`11-PROGRESS.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-PROGRESS.md) | ~120 | 1차 산출 | 읽음/통계/히스토리 (CRITICAL) |
| [`11-HASENA.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-HASENA.md) | ~40 | 1차 산출 | 하세나 일정/요약 |
| [`11-CATCHUP.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-CATCHUP.md) | ~40 | 1차 산출 | 캐치업 |
| [`11-SOCIAL.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-SOCIAL.md) | ~50 | 1차 산출 | 친구/그룹/스코어보드 (T0002·T0004 회귀 방지) |
| [`11-PROFILE.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-PROFILE.md) | ~40 | 1차 산출 | 프로필/업적/잔디 |
| [`11-ANNOTATE.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-ANNOTATE.md) | ~55 | 1차 산출 | 북마크/하이라이트/노트 (BUG-005 해소) |
| [`11-DESIGN.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-DESIGN.md) | ~100 | 1차 산출 | VRT 회복 + a11y 7건 + 다크모드 |
| [`11-PWA.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-PWA.md) | ~50 | 1차 산출 | PWA + FCM + Apple |
| [`11-ADMIN.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-ADMIN.md) | ~45 | 1차 산출 | 조건부 (PRE-6) |
| [`11-CUTOVER.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-CUTOVER.md) | ~110 | 1차 산출 | DNS/OAuth/smoke/폐기 |

> 정밀화 단계: 02-next-inventory.md + 04-production-live-audit.md 도착 후 각 슬라이스의 "기존 자산" 섹션에서 Next 측 상태를 정확한 file:line 으로 채운다.

---

## 6. 본 플랜 작성을 막는 결정 사항 (PRE-1 ~ PRE-7 + 슬라이스별 결정)

위 §0 의 7개 전제 + 각 슬라이스의 `*D-N` 결정들이 합쳐서 한 번에 사용자에게 일괄 요청된다.
Gate C 통과 직후 (06-quality-scorecard.md 사용자 직감 슬롯 채움과 함께) 결정 요청.

<!-- plan-checksum: PENDING -->
