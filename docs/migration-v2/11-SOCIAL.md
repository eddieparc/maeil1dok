# 11-SOCIAL · 친구 / 스코어보드 (그룹은 PRE-4 백로그)

> **슬라이스 ID**: 11-SOCIAL · **Wave**: 5 · **의존**: 11-AUTH, 11-PROGRESS · **크기**: M (축소 — 그룹 제외)

## 1. 목표
- `/friends` (팔로우/팔로워, 친구 검색·추가)
- `/scoreboard` (종합 랭킹·하세나 랭킹)
- **그룹 기능 (`/groups`, `/groups/[id]`) 은 PRE-4 결정에 따라 v2 제외 (백로그)** — Momus #2 일관화

## 2. 자산
- Nuxt (활용): [pages/friends.vue](../../frontend/app/pages/friends.vue) 617, [pages/scoreboard.vue](../../frontend/app/pages/scoreboard.vue) 502
- Nuxt (v2 제외, 백로그): [pages/groups/index.vue](../../frontend/app/pages/groups/index.vue) 326, [pages/groups/[id].vue](../../frontend/app/pages/groups/%5Bid%5D.vue) 959
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
| **S-9** | **기존 Next 그룹 코드 archive 처리** (Momus R-rerun-9 fix + Oracle R-rerun-final-2 Minor #1 정정 — PRE-4 일관화). 실 코드에 이미 [groups/page.tsx](../../maeil1dok-next/src/app/%28authenticated%29/groups/page.tsx) / [groups/[id]/page.tsx](../../maeil1dok-next/src/app/%28authenticated%29/groups/%5Bid%5D/page.tsx) / [types/groups.ts](../../maeil1dok-next/src/types/groups.ts) / [repositories/groupsRepository.ts](../../maeil1dok-next/src/repositories/groupsRepository.ts) 가 존재. 다음 단계로 archive: (a) **`maeil1dok-next/__backlog__/groups-v3/` 디렉토리 신설 + 4 파일 git mv** (소실 방지, v3 부활 시 재활용). 라우트 제외의 핵심은 **`src/app` 밖으로 이동** — Next.js 가 `src/app/` 외부 파일은 라우트로 인식 안 함. (b) 라우트 매니페스트 / 네비게이션 / sitemap 에서 `/groups` 진입 경로 제거. (c) 사이드바/푸터/추천 카드의 `/groups` 링크 → `/scoreboard` 또는 제거. (d) **`tsconfig.json` 의 `exclude` 배열에 `"__backlog__/**"` 추가** (typecheck 제외용 — 현재 [`tsconfig.json:40-46`](../../maeil1dok-next/tsconfig.json) 참조). **`next.config.ts` pageExtensions 조작 불필요** — Oracle R-rerun-final-2 Minor #1 정정: 현재 `next.config.ts` 비어 있고, `src/app` 밖 이동 + `tsconfig.exclude` 만으로 충분 + 빌드 산출물 검증으로 최종 확인. | (a) `__backlog__/groups-v3/` 안 4 파일 + 원 위치 파일 0건. (b) `grep -r "/groups" maeil1dok-next/src/app/** maeil1dok-next/src/components/**` 0 hits (단 `__backlog__` 디렉토리 제외). (c) `next build` exit 0 + `__backlog__/` 파일이 빌드 산출물 (.next/) 에 미포함 검증 (`find .next -path '*__backlog__*' \| wc -l == 0`). (d) git log 에서 archive commit 확인 + `tsconfig.json exclude` 에 `__backlog__/**` 포함 검증 |

## 4. 결정
- SD-1: ~~그룹 기능 v2 포함 여부~~ → **PRE-4 결정에 따라 백로그 확정 (재논의 금지)**
- SD-2: 친구 검색의 인덱싱 (Postgres full-text vs LIKE)
- SD-3: 스코어보드 캐싱 (실시간 vs 5분 캐시)

## 5. DoD (Oracle R-final Major #6 + Momus #3 4-tuple 보강 + Momus R-rerun-9 S-9 archive 일관화)
- **CHANGE**: src/app/(authenticated)/friends/, scoreboard/, src/components/social/, src/repositories/socialRepo.ts + **`__backlog__/groups-v3/` 신설 + git mv 4 파일 (groups/page.tsx, groups/[id]/page.tsx, types/groups.ts, repositories/groupsRepository.ts) + 네비/사이드바/푸터/카드 의 /groups 링크 제거 + tsconfig.json exclude `__backlog__/**` 추가 + `next build` 산출물 검증 (Oracle R-rerun-final-3 Minor #1 — next.config pageExtensions 조작 불필요)**
- **EVIDENCE**: `.sisyphus/evidence/11-SOCIAL-e2e/` — 팔로우 CRUD + 친구 검색 + 스코어보드 3 필터 + T0002 fuzz + T0004 fuzz (8건). `.sisyphus/evidence/11-SOCIAL-S9-archive.txt` — `git log --diff-filter=R --name-only` 로 4 파일 archive 흔적 + active route tree grep 0 hits
- **REPRODUCE**: `npx playwright test tests/e2e/social/*.spec.ts && grep -rn 'groups' maeil1dok-next/src/app/ maeil1dok-next/src/components/ maeil1dok-next/src/repositories/ maeil1dok-next/src/types/ | grep -v __backlog__ | wc -l`
- **ASSERTION**:
  - 0 hydration 미스매치, 0 SSR 500
  - T0002/T0004 fuzz 50회 통과
  - **active route tree 의 `/groups` 라우트 / API 호출 / type import / repository 사용 grep = 0** (단, `__backlog__/groups-v3/` 디렉토리 제외 — PRE-4 백로그 보존)
  - `next build` 산출물 (`.next/`) 에 `__backlog__/` 파일 0건 (빌드 제외 검증)
