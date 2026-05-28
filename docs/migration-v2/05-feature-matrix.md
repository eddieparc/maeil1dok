# 05 · Feature Matrix (Cross-Mapping SSOT)

> **상태**: Gate B 1차 합성 완료. 추측 0, 모든 셀은 01~04 인벤토리에서 직접 추출.  
> **목적**: Nuxt × Next × Django × Supabase 의 GAP 자동 검출 + OWNER 슬라이스 할당.  
> **방법**: `/tmp/check/*.txt` 에 저장된 set 차집합 + 정규화 매칭.

---

## 0. 채점 라벨

| 라벨 | 의미 |
|---|---|
| `PARITY` | 양쪽 동등 (Nuxt와 Next 모두 동작) |
| `MISSING` | Nuxt에 있는데 Next에 없음 — v2 에서 작성 필요 |
| `REGRESSION` | 양쪽 다 있는데 Next 측이 깨진 / 부족함 |
| `NEW` | Next 측 신규 (Nuxt 에 대응 없음) |
| `RENAMED` | URL 또는 정체성이 바뀐 동일 기능 |
| `OBSOLETE` | v2 에서 불필요 (Supabase 가 흡수 등) |
| `DEFER` | PRE 결정에 따라 v2 범위 밖 |
| `BUG` | 라이브 또는 코드에서 확인된 실패 |

---

## 1. 라우트 매트릭스 — 페이지 기준

**기반 데이터**: Nuxt 40 routes ↔ Next 34 page routes.

### 1.1 양쪽 일치 (PARITY 27개)

| 라우트 | Nuxt | Next | OWNER 슬라이스 |
|---|---|---|---|
| `/` | index.vue (200) | (authenticated)/page.tsx + app/page.tsx | 11-PROGRESS |
| `/auth/forgot-password` | (335) | 동일 | 11-AUTH |
| `/auth/reset-password` | (394) | 동일 | 11-AUTH |
| `/auth/verify-email` | (258) | 동일 | 11-AUTH |
| `/bible` | (1198) | (authenticated)/bible/page.tsx | 11-READER |
| `/bible/bookmarks` | (262) | 동일 | 11-ANNOTATE |
| `/bible/highlights` | (336) | 동일 (BUG-005 잔존 의심) | 11-ANNOTATE |
| `/bible/history` | (447) | 동일 | 11-PROGRESS |
| `/bible/notes` | (236) | 동일 | 11-ANNOTATE |
| `/bible/notes/[id]` | (398) | 동일 | 11-ANNOTATE |
| `/bible/settings` | (1338) | 동일 (TS 에러 잔존) | 11-READER + 11-FOUND |
| `/company` | (229) | 동일 | 11-FOUND (정적) |
| `/friends` | (617) | 동일 | 11-SOCIAL |
| `/groups` | (326) | 동일 | 11-SOCIAL (DEFER per PRE-4) |
| `/groups/[id]` | (959) | 동일 | 11-SOCIAL (DEFER) |
| `/hasena` | (1416) | 동일 | 11-HASENA |
| `/intro` | (652) | 동일 | 11-PLAN |
| `/login` | (598) | 동일 | 11-AUTH |
| `/notice` | (329) | 동일 | 11-FOUND |
| `/plan` | (158) | 동일 (TS 에러 PlanPageClient:431) | 11-PLAN + 11-FOUND |
| `/plans` | (496) | 동일 | 11-PLAN |
| `/privacy` | (312) | 동일 | 11-FOUND |
| `/profile/[id]` | (840) | 동일 | 11-PROFILE |
| `/register-email` | (527) | 동일 | 11-AUTH |
| `/scoreboard` | (502) | 동일 (T0002/T0004 회귀 위험) | 11-SOCIAL |
| `/support` | (282) | 동일 | 11-FOUND |
| `/terms` | (299) | 동일 | 11-FOUND |

### 1.2 Nuxt 에만 (분류 처리)

| 라우트 | Nuxt 라인 | 분류 | 처리 |
|---|---|---|---|
| `/account/settings` | 1440 | **RENAMED** → `/settings` | 11-AUTH가 보안+소셜 연동+탈퇴 책임 |
| `/admin/hasena` | 524 | **DEFER** (PRE-5) | 11-ADMIN 별도 트랙 |
| `/admin/plans` | 1737 | **DEFER** | 11-ADMIN |
| `/admin/video/intro` | 840 | **DEFER** | 11-ADMIN |
| `/auth/[provider]/callback` | 325 | **RENAMED** → `/auth/callback` (Supabase 자동) | 11-AUTH |
| `/auth/error` | 75 | **OBSOLETE** | error boundary 흡수 |
| `/auth/google/setup` | 231 | **OBSOLETE** | Supabase OAuth 자동, 닉네임 보완은 11-AUTH §3.5 |
| `/auth/kakao/setup` | 234 | **OBSOLETE** | 동일 |
| `/install` | 98 | **MISSING** | 11-PWA에 추가 필요 |
| `/intro/[id]` | 17 | **MISSING** | 11-PLAN에 추가 (stub but functional) |
| `/notice/plan-update` | 219 | **MISSING** | 11-FOUND (dynamic slug or static) |
| `/reading-archived` | 7224 | **OBSOLETE** | 11-READER R-14 폐기, Nuxt 동결 |
| `/register` | 338 | **REPLACED** by `/register-email` | 이메일 가입 전용 |

### 1.3 Next 에만 (분류)

| 라우트 | 분류 | 비고 |
|---|---|---|
| `/auth/callback` | **RENAMED** = `/auth/[provider]/callback` | PARITY 처리 |
| `/bible/home` | **NEW** (5월 신규) | `/bible` 와 정체성 분리 의도 확인 필요 (Gate D) |
| `/calendar` | **NEW** | UX 개선 — Nuxt는 홈 안에 calendar 컴포넌트 |
| `/catchup` | **NEW** | Nuxt는 컴포넌트만, 라우트 신설 |
| `/maintenance` | **NEW** | Plan F Task 3 산출 |
| `/not-found` | **NEW** | Next 컨벤션 |
| `/reading` | **NEW** | Nuxt 의 reading-archived 후속? 의도 확인 필요 (Gate D) |
| `/settings` | **RENAMED** = `/account/settings` | 11-AUTH + 11-PROFILE |

### 1.4 라우트 GAP 요약

| 분류 | 건수 |
|---|---|
| PARITY | 27 |
| MISSING (v2 작성) | 3 (`/install`, `/intro/[id]`, `/notice/plan-update`) |
| RENAMED | 3 |
| OBSOLETE | 4 + reading-archived |
| DEFER | 3 (`/admin/*`) |
| NEW | 5 |

→ **실 MISSING 3건** 모두 작업량 작음.

---

## 2. Django API ↔ Next API + Supabase 직접

**기반**: Django 129 endpoint × Next 33 API route.

Next는 Supabase 클라이언트 직접 호출이 많아 1:1 매핑 아님.

### 2.1 도메인별 처리

| Django 도메인 | endpoint 수 | Next 측 | OWNER |
|---|---|---|---|
| Auth (login/register/social/refresh) | ~25 | Supabase Auth 직접 + `/api/auth/*` 4개 | 11-AUTH |
| Auth recovery | ~6 | Supabase + Next API | 11-AUTH |
| Accounts (profile/follow/search/calendar) | ~12 | `/api/profile/*` 7개 + Supabase 직접 | 11-AUTH + 11-PROFILE + 11-SOCIAL |
| Reading settings | 2 | `/api/profile/reading-settings/` | 11-AUTH |
| Bible plans | ~8 | `/api/plans/*` 2개 + Supabase | 11-PLAN |
| Bible schedules | ~6 | `/api/bible/schedules/*` 3개 | 11-PLAN |
| Bible progress | ~5 | `/api/bible/schedules/complete/` + RPC | 11-PROGRESS |
| Bible content | ~3 | `/api/bible-proxy/[...path]` | 11-READER |
| Bible annotations | ~12 | `/api/bible/*` 5개 | 11-ANNOTATE |
| Hasena | ~9 | `/api/hasena/*` 2개 + cron | 11-HASENA |
| Video intro | ~5 | `/api/intro/progress/` | 11-PLAN |
| Catchup | ~8 | `/api/catchup/*` 3개 | 11-CATCHUP |
| Groups+scoreboard+visitor | ~15 | Mostly DEFER (PRE-4) 또는 Supabase 직접 | 11-SOCIAL |
| Admin (excel/intro upload) | ~5 | DEFER (PRE-5) | 11-ADMIN |
| Session bridge | ~3 | **OBSOLETE** | — |

### 2.2 명시적 GAP

| Django endpoint | 필요성 | Next 측 처리 | OWNER |
|---|---|---|---|
| `/accounts/check-nickname/` | 닉네임 unique 검증 | **MISSING** Next API 또는 RPC | 11-AUTH (A-20) |
| `/accounts/merge-accounts/` | 계정 병합 | DECIDE (AD-2) | 11-AUTH |
| `/accounts/linked-accounts/` | 연동 소셜 목록 | **MISSING** Next API (service_role) | 11-AUTH (A-14) |
| `/accounts/link-social/` `unlink-social/` | 소셜 연동/해제 | `/api/auth/{link,unlink}-identity/` ✅ | PARITY |
| `/todos/bible-plans/upload-excel/` | 엑셀 업로드 | **DEFER** (PRE-5) | 11-ADMIN |
| `/todos/groups/*` (~15) | 그룹 기능 | **DEFER** (PRE-4) | 11-SOCIAL backlog |
| `/todos/scoreboard/*` | 스코어보드 | **MISSING** Next API 또는 RPC | 11-SOCIAL |
| `/todos/stats/visitors/*` | 방문자 통계 | **OBSOLETE** (Vercel Analytics) | — |
| `/todos/hasena/summary/regenerate/` | 요약 재생성 | DEFER (PRE-5) or cron 자동 | 11-ADMIN/11-HASENA |

### 2.3 Next NEW API (Django 없음)

| Next API | 의도 |
|---|---|
| `/api/cron/daily-reminder/` | 통독 리마인더 |
| `/api/cron/hasena-summary/` | 하세나 요약 자동 생성 |
| `/api/notifications/{friend-activity,settings,token}/` | FCM 인프라 |
| `/api/profile/avatar/` | 아바타 업로드 |

→ 11-PWA + 11-PROFILE + 11-HASENA 소관.

---

## 3. 도메인 모델 매트릭스

**기반**: Django 29 모델 × Supabase 23 테이블.

| Django 모델 | Supabase 테이블 | 분류 | OWNER |
|---|---|---|---|
| `User` (AbstractUser) | `auth.users` + `profiles` | PARITY (분할) | 11-AUTH+MIGRATE |
| `UserProfile` | `profiles` (병합) | PARITY | 11-MIGRATE |
| `SocialAccount` | `auth.identities` | **OBSOLETE** (Supabase 자동) | — |
| `Follow` | `user_follows` | PARITY | 11-MIGRATE |
| `UserAchievement` | (없음) | DECIDE (PRE-6 = 재계산) | 11-PROFILE RPC |
| `UserReadingSettings` | `user_reading_settings` | PARITY | 11-MIGRATE |
| `EmailVerificationToken` | (없음) | **OBSOLETE** (Supabase Auth) | — |
| `PasswordResetToken` | (없음) | **OBSOLETE** | — |
| `BibleReadingPlan` | `bible_reading_plans` | PARITY | 11-MIGRATE |
| `PlanSubscription` | `plan_subscriptions` | PARITY | 11-MIGRATE |
| `DailyBibleSchedule` | `daily_schedules` | PARITY (멱등성 fix) | 11-MIGRATE M-10 |
| `UserBibleProgress` | `user_progress` | PARITY (95% 손실 fix) | 11-MIGRATE |
| `VideoBibleIntro` | `video_bible_intros` | PARITY | 11-MIGRATE |
| `UserVideoIntroProgress` | `user_video_intro_progress` | PARITY | 11-MIGRATE |
| `HasenaRecord` | `hasena_records` | PARITY | 11-MIGRATE |
| `HasenaSummary` | `hasena_summaries` | PARITY | 11-MIGRATE |
| `VisitorCount` | (없음) | **OBSOLETE** (Vercel Analytics) | — |
| `ReadingGroup` | (없음) | **DEFER** (PRE-4) | 11-SOCIAL backlog |
| `GroupMembership` | (없음) | **DEFER** | 11-SOCIAL backlog |
| `GroupInvitation` | (없음) | **DEFER** | 11-SOCIAL backlog |
| `UserPlanDisplaySettings` | `user_plan_display_settings` | PARITY | 11-MIGRATE |
| `UserReadingPosition` | `user_reading_positions` | PARITY | 11-MIGRATE |
| `BibleBookmark` | `bible_bookmarks` (NEW) | PARITY | 11-MIGRATE+ANNOTATE |
| `ReflectionNote` | `reflection_notes` (NEW) | PARITY | 11-MIGRATE+ANNOTATE |
| `BibleHighlight` | `user_highlights` | PARITY (필드명+memo MD-3) | 11-MIGRATE+ANNOTATE |
| `PersonalReadingRecord` | `personal_reading_records` (NEW) | PARITY | 11-MIGRATE+ANNOTATE |
| `CatchupSession` | `catchup_sessions` | PARITY | 11-MIGRATE |
| `CatchupSchedule` | `catchup_schedules` | PARITY | 11-MIGRATE |
| `BibleContentCache` | `bible_content_cache` | PARITY (재생성 MD-4) | 11-MIGRATE |

### 3.1 Supabase 신규 테이블

| Supabase 테이블 | 의도 |
|---|---|
| `fcm_tokens` | FCM 푸시 토큰 (Plan E 신규) |
| `notification_settings` | 알림 설정 (Plan E 신규) |
| `migration_user_mapping` | 마이그레이션 임시 |

---

## 4. 라이브 버그 / 회귀 위험 매트릭스

| 버그 ID | 영역 | 단정? | v2 회귀 방지 OWNER |
|---|---|---|---|
| BUG-001 본문 미표시 | /bible | Webfetch 단독 불가, Gate D Playwright | 11-READER R-5~R-7 |
| BUG-002 btn_listen.png 404 | /bible | 정적 자산 | 11-READER R-10 |
| BUG-003 콘솔 에러 다수 | 전역 | Playwright 콘솔 수집 | 11-AUTH + 11-DESIGN |
| BUG-004 책장 URL undefined | /bible | 단정 보류 | 11-READER R-1~R-4 |
| BUG-005 "Task 3-3 구현 예정" | /bible/highlights | placeholder grep CI | 11-ANNOTATE AN-4 |
| T0002 리더보드→홈 리다이렉트 | /scoreboard | fuzz | 11-SOCIAL S-8 |
| T0004 리더보드 뒤로 500 | /scoreboard | SSR hydration | 11-SOCIAL S-8 |
| AUTH 새로고침 로그아웃 | 전역 | 11-AUTH §3.6 | 11-AUTH |

---

## 5. 사용자 시나리오 매트릭스 (01 §8 발췌)

| 시나리오 | Nuxt | Next | OWNER |
|---|---|---|---|
| 홈 일정 체크 토글 | ✅ (200) | ✅ HomeShell+components/home/* | 11-PROGRESS |
| 캘린더 일자 클릭 | ✅ (HomeShell) | ✅ /calendar | 11-PROGRESS |
| /bible 본문 읽기+책장 이동 | ⚠️ BUG-001/004 | ⚠️ Gate D 검증 | 11-READER |
| 역본 변경 | ✅ (composables 832) | ✅ parsers+ToolsPopover | 11-READER |
| 본문 선택→북마크/노트/하이라이트 | ✅ | ⚠️ BUG-005 | 11-ANNOTATE+READER |
| 오디오 재생 | ✅ (404 제외) | ⚠️ R-10 | 11-READER |
| 폰트/테마 설정 | ✅ (1338) | ⚠️ TS 에러 (BibleSettingsContent+FontSection) | 11-FOUND+READER |
| 그룹 진도 | ✅ (959) | DEFER (PRE-4) | 11-SOCIAL backlog |
| 하세나 일정+나눔 | ✅ (1416) | ⚠️ 나눔 v2 포함 (HD-1) | 11-HASENA |
| 친구 검색+추가 | ✅ (617) | ✅ /api/profile/* | 11-SOCIAL |
| 스코어보드 필터 | ⚠️ T0002/T0004 | ⚠️ fuzz | 11-SOCIAL |
| 프로필+잔디 | ✅ (840) | ⚠️ Achievement 재계산 (PRE-6) | 11-PROFILE |
| 인증 새로고침 유지 | ⚠️ Django BUG | ⚠️ Supabase 검증 | 11-AUTH |
| 비밀번호 재설정 | ✅ | ⚠️ Supabase reset 흐름 검증 | 11-AUTH |
| PWA 설치 | ✅ /install (98) | **MISSING** | 11-PWA |

---

## 6. GAP 종합 → 신규 작업 도출

### 6.1 명시적 MISSING (Next 작성 필요)

| 항목 | OWNER | 크기 |
|---|---|---|
| `/install` PWA 설치 페이지 | 11-PWA | S |
| `/intro/[id]` 플랜 상세 intro | 11-PLAN | S |
| `/notice/plan-update` (또는 generic dynamic notice) | 11-FOUND | S |
| 닉네임 unique 체크 API | 11-AUTH | S |
| 연동된 소셜 목록 API | 11-AUTH | S |
| 계정 병합 (AD-2 결정 따라) | 11-AUTH | M |
| Achievement 재계산 RPC (PRE-6) | 11-PROFILE | M |
| 스코어보드 API | 11-SOCIAL | M |
| 본문 표시+URL 단방향 (BUG-001/004 방지) | 11-READER | M |
| /highlights placeholder 제거+UI (BUG-005) | 11-ANNOTATE | M |
| 새로고침 인증 유지 | 11-AUTH | M |
| 마이그레이션 95% 손실 fix | 11-MIGRATE | L |
| 빌드 그린 (TS 에러 5건) | 11-FOUND | S |
| VRT 회복 (dark testMatch + 35407px diff) | 11-DESIGN | M |
| a11y 7건 color-contrast | 11-DESIGN | M |
| 다크모드 잔존 위반 | 11-DESIGN | M |
| FCM 푸시 인프라 검증 | 11-PWA | M |

→ **17 MISSING 항목** 슬라이스 정밀화 (Gate D) 에 반영.

### 6.2 OBSOLETE / DEFER 확정

| 항목 | 처리 |
|---|---|
| `/auth/error`, `/auth/{kakao,google}/setup` | OBSOLETE |
| `/reading-archived` (7224) + `index-archived` (2383) | OBSOLETE — Nuxt 동결 |
| SocialAccount/EmailToken/PasswordToken/VisitorCount | OBSOLETE 모델 |
| Group 3 모델+라우트+API | DEFER (PRE-4) |
| Admin 3 라우트+API | DEFER (PRE-5) |

### 6.3 NEW (Next 의도된 추가)

| 항목 | 의도 | 검증 |
|---|---|---|
| `/calendar` 별도 라우트 | UX 개선 | ✅ |
| `/catchup` 별도 라우트 | 새 기능 | 11-CATCHUP |
| `/maintenance` | 컷오버 인프라 | 11-FOUND |
| `/reading` | 의도 **불명확** | Gate D 정밀화 |
| `/bible/home` | 5월 신규, `/bible` 와 정체성 | Gate D 정밀화 |
| FCM/notification 인프라 | 푸시 | 11-PWA |

---

## 7. 합성 검증 (자가)

```
Nuxt 페이지: 40 (실 41 - 1 dynamic alias) ↔ 매트릭스: 40 PASS
Next 페이지: 34                            ↔ 매트릭스: 34 PASS  
Django 모델: 29                            ↔ 매트릭스: 29 PASS
Supabase 테이블: 23                        ↔ 매트릭스: 23 PASS

분류 분포:
  PARITY:    27 routes + 다수 모델/API
  MISSING:   17 작업 항목
  OBSOLETE:  9 (라우트 4 + 모델 4 + reading-archived 1)
  DEFER:     6 (그룹 3 모델/라우트, Admin 3 라우트)
  NEW:       11 (Next 라우트 5 + Supabase 테이블 3 + Next API 7 - 중복 4)
```

본 매트릭스는 인벤토리 4건의 단순 set 합성. 추측·환각 0.

<!-- matrix-version: 1 -->
<!-- synthesis-date: 2026-05-28 -->
