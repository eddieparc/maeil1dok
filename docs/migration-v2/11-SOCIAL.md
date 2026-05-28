# 11-SOCIAL · 친구 / 그룹 / 스코어보드

> **슬라이스 ID**: 11-SOCIAL · **Wave**: 5 · **의존**: 11-AUTH, 11-PROGRESS · **크기**: M

## 1. 목표
- `/friends` (팔로우/팔로워, 친구 검색·추가)
- `/groups`, `/groups/[id]` (그룹 리더보드·멤버 캘린더·그룹 진도)
- `/scoreboard` (종합 랭킹·하세나 랭킹)

## 2. 자산
- Nuxt: [pages/friends.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/friends.vue) 617, [pages/groups/index.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/groups/index.vue) 326, [pages/groups/[id].vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/groups/%5Bid%5D.vue) 959, [pages/scoreboard.vue](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/scoreboard.vue) 502
- Django: `/api/v1/accounts/follow/`, `unfollow/`, `followers/`, `following/`, `friends/`, `search/`, `/api/v1/todos/groups/*`, `/api/v1/todos/scoreboard/*`
- 모델: `Follow`, `ReadingGroup`, `GroupMembership`, `GroupInvitation`
- Next: 02 도착 후 정확화

## 3. 작업
| # | 작업 | DoD |
|---|---|---|
| S-1 | 팔로우/언팔로우 | upsert/delete + 카운트 |
| S-2 | 친구 검색 | nickname/email 부분 일치 |
| S-3 | 친구 피드 (진행 상황) | 페이징 |
| S-4 | 그룹 목록 + 가입/탈퇴 | (PRE-7 결정 필요 — 그룹 포함 여부) |
| S-5 | 그룹 리더보드 | 정렬 + 페이징 |
| S-6 | 그룹 멤버 캘린더 모달 | VRT |
| S-7 | 스코어보드 (개인 + 하세나) | 필터 (이번달/주/전체) |
| S-8 | T0002·T0004 회귀 방지 (audit_tmp): 필터 클릭 시 홈 리다이렉트 / 뒤로가기 500 에러 | 50회 반복 fuzz 통과 |

## 4. 결정
- SD-1: 그룹 기능 v2 포함 여부 (PRE-7) — 포함 시 SQL 추가, 미포함 시 본 슬라이스에서 그룹 부분 잘라냄
- SD-2: 친구 검색의 인덱싱 (Postgres full-text vs LIKE)
- SD-3: 스코어보드 캐싱 (실시간 vs 5분 캐시)

## 5. DoD
- EVIDENCE: e2e 8건 + T0002/T0004 fuzz
- ASSERTION: 0 hydration 미스매치, 0 SSR 500
