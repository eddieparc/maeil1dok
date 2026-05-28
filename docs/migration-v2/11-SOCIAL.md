# 11-SOCIAL · 친구 / 스코어보드 (그룹은 PRE-4 백로그)

> **슬라이스 ID**: 11-SOCIAL · **Wave**: 5 · **의존**: 11-AUTH, 11-PROGRESS · **크기**: M (축소 — 그룹 제외)

## 1. 목표
- `/friends` (팔로우/팔로워, 친구 검색·추가)
- `/scoreboard` (종합 랭킹·하세나 랭킹)
- **그룹 기능 (`/groups`, `/groups/[id]`) 은 PRE-4 결정에 따라 v2 제외 (백로그)** — Momus #2 일관화

## 2. 자산
- Nuxt (활용): [pages/friends.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/friends.vue) 617, [pages/scoreboard.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/scoreboard.vue) 502
- Nuxt (v2 제외, 백로그): [pages/groups/index.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/groups/index.vue) 326, [pages/groups/[id].vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/groups/%5Bid%5D.vue) 959
- Django: `/api/v1/accounts/follow/`, `unfollow/`, `followers/`, `following/`, `friends/`, `search/`, `/api/v1/todos/scoreboard/*` (활용). `/api/v1/todos/groups/*` (백로그)
- 모델: `Follow` (활용). `ReadingGroup`, `GroupMembership`, `GroupInvitation` (PRE-4 백로그, 11-MIGRATE 에서 SKIP)
- Next: 02 도착 후 정확화

## 3. 작업
| # | 작업 | DoD |
|---|---|---|
| S-1 | 팔로우/언팔로우 | upsert/delete + 카운트 |
| S-2 | 친구 검색 | nickname/email 부분 일치 |
| S-3 | 친구 피드 (진행 상황) | 페이징 |
| S-4 | (백로그, PRE-4) 그룹 목록 + 가입/탈퇴 — v2 제외 | — |
| S-5 | (백로그, PRE-4) 그룹 리더보드 — v2 제외 | — |
| S-6 | (백로그, PRE-4) 그룹 멤버 캘린더 모달 — v2 제외 | — |
| S-7 | 스코어보드 (개인 + 하세나) | 필터 (이번달/주/전체) |
| S-8 | T0002·T0004 회귀 방지 (audit_tmp): 필터 클릭 시 홈 리다이렉트 / 뒤로가기 500 에러 | 50회 반복 fuzz 통과 |

## 4. 결정
- SD-1: ~~그룹 기능 v2 포함 여부~~ → **PRE-4 결정에 따라 백로그 확정 (재논의 금지)**
- SD-2: 친구 검색의 인덱싱 (Postgres full-text vs LIKE)
- SD-3: 스코어보드 캐싱 (실시간 vs 5분 캐시)

## 5. DoD (Oracle R-final Major #6 + Momus #3 4-tuple 보강)
- **CHANGE**: src/app/(authenticated)/friends/, scoreboard/, src/components/social/, src/repositories/socialRepo.ts (그룹 라우트/컴포넌트 추가/수정 금지)
- **EVIDENCE**: `.sisyphus/evidence/11-SOCIAL-e2e/` — 팔로우 CRUD + 친구 검색 + 스코어보드 3 필터 + T0002 fuzz + T0004 fuzz (8건). `.sisyphus/evidence/11-SOCIAL-group-backlog.txt` — `/groups` 라우트 grep 0 hits (백로그 회귀 차단)
- **REPRODUCE**: `npx playwright test tests/e2e/social/*.spec.ts && grep -rn 'groups' src/app/\\(authenticated\\)/ | grep -v __backlog__ | wc -l`
- **ASSERTION**:
  - 0 hydration 미스매치, 0 SSR 500
  - T0002/T0004 fuzz 50회 통과
  - `/groups` 라우트 / API 호출 grep = 0 (백로그 회귀 차단)
