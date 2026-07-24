# 11-PROFILE · 프로필 + 업적 + 잔디

> **슬라이스 ID**: 11-PROFILE · **Wave**: 4 · **의존**: 11-AUTH, 11-PROGRESS · **크기**: S

## 1. 목표
`/profile/[id]` — 닉네임/아바타/통계/업적/팔로우/연간 잔디 표시 + 본인 프로필 편집.

## 2. 자산
- Nuxt: [pages/profile/[id].vue](../../frontend/app/pages/profile/%5Bid%5D.vue) 840
- Django: `/api/v1/accounts/profile/<id>/`, `profile/<id>/calendar/`, `profile/<id>/achievements/`
- 모델: `UserProfile`, `UserAchievement`
- Plan F: UserAchievement SKIP. v2 는 재계산 (MD-2)

## 3. 작업
| # | 작업 | DoD |
|---|---|---|
| PF-1 | 프로필 표시 (본인/타인) | RLS + e2e |
| PF-2 | 프로필 편집 (닉네임/이미지/공개여부) | nickname unique 검증 |
| PF-3 | 잔디 (1년 일별 색상 grid) | VRT |
| PF-4 | 업적 — Plan F 폐기 후 v2 재계산 로직 | streak 기반 자동 산출 RPC |
| PF-5 | 팔로워/팔로잉 카운트 + 모달 | 11-SOCIAL 와 협업 |

## 4. 결정
- PFD-1 (= MD-2): 업적 폐기 / 재계산
- PFD-2: 잔디 색상 스케일 (단조 vs 통독 강도 색)

## 5. DoD (Oracle R-final Major #6 + Momus #3 4-tuple 보강)
- **CHANGE**: src/app/(authenticated)/profile/[id]/, src/repositories/profileRepo.ts, src/components/profile/*, src/lib/achievements/recompute.ts (PRE-6)
- **EVIDENCE**: `.sisyphus/evidence/11-PROFILE-e2e/` — 본인/타인 × 공개/비공개 = 4 케이스 + 잔디 VRT (light/dark) + achievement 재계산 결과 (`achievements-recompute.json`)
- **REPRODUCE**: `npx playwright test tests/e2e/profile/*.spec.ts`
- **ASSERTION**:
  - 4/4 e2e pass
  - 비공개 프로필 익명 접근: 401 (RLS 검증)
  - 잔디 VRT diff: 0 px (baseline 갱신 시 사용자 PR 승인)
  - achievement 재계산: streak 기반 자동 (PRE-6)
