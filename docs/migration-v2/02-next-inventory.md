# 매일일독 Next.js 마이그레이션 코드베이스 전수 인벤토리

> **작성자**: Sisyphus (sub-agent 실패 후 직접 작성)  
> **방법**: bash + filesystem 직접 enumerate + `npx tsc --noEmit` 실측 + `npx vitest run` 실측  
> **타겟**: /Users/jgp/GitHub/maeil1dok/maeil1dok-next  
> **총 .tsx/.ts 파일**: 338

---

## 섹션 1: 라우트/페이지 전수 (38 페이지)

### 인증 그룹 `(authenticated)/`

| 라우트 | 파일 | 비고 |
|---|---|---|
| `/` | [src/app/(authenticated)/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/page.tsx) | 홈 |
| `/bible` | [src/app/(authenticated)/bible/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/page.tsx) | 성경 뷰어 본체 |
| `/bible/bookmarks` | [bookmarks/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/bookmarks/page.tsx) | |
| `/bible/highlights` | [highlights/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/highlights/page.tsx) | BUG-005 placeholder 여부 확인 필요 |
| `/bible/history` | [history/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/history/page.tsx) | |
| `/bible/home` | [home/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/home/page.tsx) | 5월 신규 (`758f5ad refactor(bible): move BibleHome to /bible/home standalone page`) |
| `/bible/notes` | [notes/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/notes/page.tsx) | |
| `/bible/notes/[id]` | [notes/[id]/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/notes/%5Bid%5D/page.tsx) | |
| `/bible/settings` | [settings/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/settings/page.tsx) | TS 에러 잔존 (BibleSettingsContent + FontSection) |
| `/calendar` | [calendar/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/calendar/page.tsx) | |
| `/catchup` | [catchup/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/catchup/page.tsx) | 빌드 차단했던 TS 에러 영역 |
| `/friends` | [friends/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/friends/page.tsx) | |
| `/groups` | [groups/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/groups/page.tsx) | |
| `/groups/[id]` | [groups/[id]/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/groups/%5Bid%5D/page.tsx) | |
| `/hasena` | [hasena/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/hasena/page.tsx) | |
| `/intro` | [intro/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/intro/page.tsx) | |
| `/plan` | [plan/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/plan/page.tsx) | TS 에러 (PlanPageClient.tsx:431) |
| `/plans` | [plans/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/plans/page.tsx) | |
| `/profile/[id]` | [profile/[id]/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/profile/%5Bid%5D/page.tsx) | |
| `/reading` | [reading/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/reading/page.tsx) | |
| `/scoreboard` | [scoreboard/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/scoreboard/page.tsx) | |
| `/settings` | [settings/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/settings/page.tsx) | |
| (layout) | [layout.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/layout.tsx) | 인증 가드 |
| (error) | [error.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/error.tsx) | 에러 바운더리 |

<!-- rows: 22 + 2 (layout/error) = 24, including dynamic [id] -->

### 공개 그룹 `(public)/`

| 라우트 | 파일 |
|---|---|
| `/auth/forgot-password` | [forgot-password/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/auth/forgot-password/page.tsx) |
| `/auth/reset-password` | [reset-password/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/auth/reset-password/page.tsx) |
| `/auth/verify-email` | [verify-email/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/auth/verify-email/page.tsx) |
| `/company` | [company/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/company/page.tsx) |
| `/login` | [login/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/login/page.tsx) |
| `/maintenance` | [maintenance/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/maintenance/page.tsx) | Plan F Task 3 산출물 — **존재 확인** |
| `/not-found` | [not-found/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/not-found/page.tsx) |
| `/notice` | [notice/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/notice/page.tsx) |
| `/privacy` | [privacy/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/privacy/page.tsx) |
| `/register-email` | [register-email/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/register-email/page.tsx) |
| `/support` | [support/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/support/page.tsx) |
| `/terms` | [terms/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/terms/page.tsx) |
| (layout) | [(public)/layout.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/layout.tsx) |
| (error) | [(public)/error.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28public%29/error.tsx) |

### 글로벌

| 경로 | 파일 |
|---|---|
| `/auth/callback` | [src/app/auth/callback/route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/auth/callback/route.ts) | OAuth 콜백 |
| `/` (루트) | [src/app/page.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/page.tsx) |
| (루트 layout) | [src/app/layout.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/layout.tsx) |
| (미들웨어) | [src/middleware.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/middleware.ts) | MAINTENANCE_MODE + Apple POST 콜백 |

---

## 섹션 2: API Routes (33개)

| 엔드포인트 | 파일 | 주 동작 |
|---|---|---|
| `/api/auth/delete-account` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/auth/delete-account/route.ts) | 탈퇴 |
| `/api/auth/link-identity` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/auth/link-identity/route.ts) | 소셜 연동 |
| `/api/auth/unlink-identity` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/auth/unlink-identity/route.ts) | 소셜 해제 |
| `/api/auth/update-password` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/auth/update-password/route.ts) | 비밀번호 변경 |
| `/api/bible-proxy/[...path]` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible-proxy/%5B...path%5D/route.ts) | 성경 본문 프록시 |
| `/api/bible/bookmarks` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/bookmarks/route.ts) | 북마크 CRUD |
| `/api/bible/highlights` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/highlights/route.ts) | 하이라이트 |
| `/api/bible/notes` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/notes/route.ts) | 노트 목록 |
| `/api/bible/notes/[id]` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/notes/%5Bid%5D/route.ts) | 노트 단건 |
| `/api/bible/personal-records` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/personal-records/route.ts) | 개인 읽기 기록 |
| `/api/bible/schedules` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/schedules/route.ts) | 일정 |
| `/api/bible/schedules/today` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/schedules/today/route.ts) | 오늘 일정 |
| `/api/bible/schedules/complete` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/bible/schedules/complete/route.ts) | 완료 토글 |
| `/api/catchup/abandon` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/catchup/abandon/route.ts) | 캐치업 포기 |
| `/api/catchup/complete` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/catchup/complete/route.ts) | 완료 |
| `/api/catchup/create` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/catchup/create/route.ts) | 세션 생성 |
| `/api/cron/daily-reminder` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/cron/daily-reminder/route.ts) | Vercel Cron — 푸시 리마인더 |
| `/api/cron/hasena-summary` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/cron/hasena-summary/route.ts) | Vercel Cron — 하세나 요약 생성 |
| `/api/hasena/complete` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/hasena/complete/route.ts) | |
| `/api/hasena/summary` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/hasena/summary/route.ts) | |
| `/api/intro/progress` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/intro/progress/route.ts) | |
| `/api/notifications/friend-activity` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/notifications/friend-activity/route.ts) | Next 레거시 FCM 실험 |
| `/api/notifications/settings` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/notifications/settings/route.ts) | |
| `/api/notifications/token` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/notifications/token/route.ts) | Next 레거시 FCM 토큰 |
| `/api/plans/subscribe` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/plans/subscribe/route.ts) | |
| `/api/plans/unsubscribe` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/plans/unsubscribe/route.ts) | |
| `/api/profile/avatar` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/avatar/route.ts) | |
| `/api/profile/follow` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/follow/route.ts) | |
| `/api/profile/followers` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/followers/route.ts) | |
| `/api/profile/following` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/following/route.ts) | |
| `/api/profile/reading-settings` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/reading-settings/route.ts) | |
| `/api/profile/unfollow` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/unfollow/route.ts) | |
| `/api/profile/update` | [route.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/profile/update/route.ts) | |

---

## 섹션 3: 컴포넌트 카탈로그 (111개, 16 카테고리)

| 카테고리 | 파일 수 | 주요 컴포넌트 |
|---|---|---|
| bible | 41 | BibleViewer, BibleReaderView, BibleChapterView, BookSelector, BibleReaderHeader, ToolsPopover, VerseActionMenu, ReadingSettingsModal/Panel, BookmarkModal, HighlightModal/ColorPicker, NoteQuickModal, TongdokCompleteModal 외 |
| ui | 20 | Avatar, Badge, Button, Card, Container, EmptyState, Input, Modal (+모달 시스템 ModalHost/Confirm/Alert), PageHeader, ProgressBar, Select, Skeleton, Tabs, Textarea, ThemeToggle, Toast |
| home | 9 | HomeShell, HomeHero, DailyStatus, ReadingCardStack, HasenaCard, IntroCard, QuickAccessGrid |
| calendar | 7 | MultiPlanCalendar, CalendarDayCell, CalendarHeader, CalendarLegend, PlanTogglePanel, generateCalendarDates (+test) |
| catchup | 5 | CatchupClient, CatchupPreviewModal, CatchupProgressCard, CatchupSettingsModal, TodayCatchupList |
| layout | 5 | Header, HeaderClient, Menu, BottomNavigation, FloatingNav |
| settings | 4 | SettingsPage, ProfileSection, NotificationsSection, SecuritySection |
| profile | 4 | ProfilePage, ProfileEditModal, FollowersModal, FollowingModal |
| groups | 3 | GroupsClient, GroupCard, GroupDetailClient |
| schedule | 3 | ScheduleList, ScheduleItem, PlanSelector |
| providers | 3 | ThemeProvider, ToastProvider, index |
| scoreboard | 2 | ScoreboardClient, LeaderboardCard |
| friends | 2 | FriendsClient, FriendCard |
| intro | 1 | IntroClient |
| hasena | 1 | HasenaClient |
| plans | 1 | PlanCard |

<!-- rows: 16 categories, total component files: 111 -->

---

## 섹션 4: lib/ 모듈

| 모듈 | 파일 | 역할 |
|---|---|---|
| bible/parsers | [common, kntParser, standardParser, wooriParser](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/lib/bible/parsers/) (+ test 3) | 역본별 본문 파서 |
| bible | books, constants, navigation, search, types (+test) | 책 메타데이터 + 검색 + 네비 |
| catchup | scheduling (+test) | 캐치업 알고리즘 |
| firebase | admin, config, messaging, send (+test) | Next 레거시 FCM SDK 통합 |
| modal | ModalHost, ModalRegistry, types, index | 모달 시스템 |
| notifications | friendActivity | 친구 활동 알림 |
| supabase | client, server, middleware, database.types | Supabase 클라이언트 분리 (브라우저/서버/미들웨어) |
| zustand | factory, hooks, HydrationGate, provider, index, test-utils (+test) | Zustand SSR-safe 래핑 |
| utils | utils.ts | cn() class-merge |

---

## 섹션 5: Repositories

[src/repositories/](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/repositories/) 디렉토리:

- `bible/` 하위 (구체화 안 됨)
- `factory.ts`
- `groupsRepository.ts`
- `implementations/`
- `index.ts`
- `interfaces/`
- `scoreboardRepository.ts`
- `types/`
- `__tests__/`

→ Repository 패턴 부분 도입 상태. groups, scoreboard 만 명시적 repository. bible 은 하위 디렉토리만 존재 (구현 상태 불분명).

---

## 섹션 6: Hooks

| Hook | 파일 |
|---|---|
| useConfetti | [hooks/useConfetti.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useConfetti.ts) |
| useFocusTrap | [hooks/useFocusTrap.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useFocusTrap.ts) |
| useModal | [hooks/useModal.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useModal.ts) (+test) |
| useReadingPosition | [hooks/useReadingPosition.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useReadingPosition.ts) |
| useScrollLock | [hooks/useScrollLock.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useScrollLock.ts) |
| useSwipeNavigation | [hooks/useSwipeNavigation.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useSwipeNavigation.ts) |
| useTheme | [hooks/useTheme.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useTheme.ts) |
| useToast | [hooks/useToast.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/hooks/useToast.ts) |
| (hooks/bible/) | 하위 디렉토리 존재 — 정밀화 필요 |

---

## 섹션 7: Stores (Zustand)

- `src/stores/bible/` 하위만 있음. 다른 도메인 스토어는 server state 위주로 처리 (route handler + Supabase).
- `tongdokMode.test.ts` 가 vitest fail 의 핵심 (아래 §11).

---

## 섹션 8: 빌드/타입 상태 (실측 — 2026-05-28)

### TypeScript 에러 — 5건

| # | 파일:라인 | 에러 |
|---|---|---|
| 1 | [BibleSettingsContent.tsx:166](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/settings/BibleSettingsContent.tsx#L166) | TS2322 제네릭 keyof ReadingSettings vs string 불일치 |
| 2 | [FontSection.tsx:89](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/settings/FontSection.tsx#L89) | TS7053 index signature 누락 |
| 3 | [PlanPageClient.tsx:431](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/plan/PlanPageClient.tsx#L431) | TS2554 인자 개수 불일치 (Expected 1, got 2) |
| 4 | [ModalRegistry.ts:55](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/lib/modal/ModalRegistry.ts#L55) | TS2769 overload 매치 실패 — string\|undefined |
| 5 | [ModalRegistry.ts:56](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/lib/modal/ModalRegistry.ts#L56) | TS2769 동일 |

### 빌드 상태
`npm run build` 시도 → TS 에러 5건으로 인해 **Compile Error** 로 FAIL. (이전 build.log 확인: `catchup/page.tsx:154 missedCount` 에러도 발생했었음 — 그 에러는 현재 표시되지 않으므로 직전 작업으로 해소된 듯, 다만 별도 검증 필요.)

### 환경
- `node_modules` 설치 상태 확인됨 (`npx tsc` 동작).
- ESLint 플러그인 (next-plugin) 경고: "The Next.js plugin was not detected in your ESLint configuration."

---

## 섹션 9: 미완성/플레이스홀더 흔적

`/bible/highlights` 의 직전 라이브 이슈 BUG-005 ("Task 3-3에서 구현 예정") 의 회귀 가능성은 본 인벤토리 단독으로 단정 불가. 라이브 확인은 04-production-live-audit.md 의 (제약된) 결과 참조. CI 차원 placeholder grep 의무화는 00-meta-system §2.6 에 정의됨.

추가 패턴 검색 의무:
- production build artifact 에 "구현 예정", "Task X-Y", "TODO production" grep → 0 hits 검증.
- 본 인벤토리 단계에서는 빌드 fail 로 production build 자체가 생성 불가. **빌드 그린 (11-FOUND) 통과 후 즉시 검증** 의무.

---

## 섹션 10: Supabase 마이그레이션 (7개 + scripts)

| 파일 | 내용 |
|---|---|
| [20260225000001_v1_production_schema.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260225000001_v1_production_schema.sql) | 초기 스키마 (profiles, bible_reading_plans, plan_subscriptions, daily_schedules, user_progress, video_bible_intros, hasena_summaries 등) |
| [20260225000002_triggers_and_seed.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260225000002_triggers_and_seed.sql) | 트리거 + 시드 |
| [20260226000001_plan_d_user_follows.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260226000001_plan_d_user_follows.sql) | user_follows |
| [20260226000002_plan_d_user_highlights.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260226000002_plan_d_user_highlights.sql) | user_highlights |
| [20260226000003_plan_d_daily_status_rpc.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260226000003_plan_d_daily_status_rpc.sql) | RPC |
| [20260227000001_plan_e_avatar_fcm_notifications.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260227000001_plan_e_avatar_fcm_notifications.sql) | Next 레거시 Avatar + FCM 알림 |
| [20260301000001_plan_f_new_tables.sql](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/supabase/migrations/20260301000001_plan_f_new_tables.sql) | bible_bookmarks, reflection_notes, personal_reading_records, migration_user_mapping |

### scripts/migrate/ (Plan F 산출물)
- `01-extract-mysql.ts` ~ `04-validate.ts` 5개 스크립트
- `run-migration.ts` orchestrator
- `RUNBOOK.md`
- `data/` (203명 추출 데이터 + validation_report.json + dry_run_report.json)
- `test-connection.ts`

---

## 섹션 11: 테스트 인프라

### Vitest 실측 결과 (실행됨)
- **테스트 파일**: 46개
- **통과**: 42 파일 (314 tests)
- **실패**: 4 파일 (46 tests)

### 실패 핵심 원인 (한 곳)
[src/stores/bible/tongdokMode.test.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/stores/bible/tongdokMode.test.ts):
```
TypeError: (0 , __vite_ssr_import_0__.createStore)(...) is not a function
❯ Module.<anonymous> src/lib/zustand/factory.ts:11:31
```
→ `src/lib/zustand/factory.ts` 의 `createStore` 임포트 문제. zustand v4→v5 변경 또는 mock 설정 문제 추정 (verify 필요). **단일 root cause 가 46 테스트를 fail 시킴.**

### Playwright e2e
- 19개 e2e spec 파일 (tests/e2e/)
- 26개 VRT 스냅샷 이미지
- `playwright.config.ts` 의 testMatch ↔ ignore 모순 (design-polish/issues.md §F2) — 본 인벤토리 단독으로 재검증 가능.

---

## 섹션 12: 환경변수 의존성 (17개)

| 변수 | 용도 | 사용처 grep | 노출 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | client.ts, server.ts | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 동일 | public |
| `SUPABASE_SERVICE_ROLE_KEY` | service role | server API routes + scripts/migrate | secret |
| `GEMINI_API_KEY` | 하세나 요약 생성 | api/cron/hasena-summary | secret |
| `CRON_SECRET` | Vercel Cron 보호 | api/cron/* | secret |
| `YOUTUBE_API_KEY` | YouTube 메타 | hasena 로직 | secret |
| `HASENA_PLAYLIST_ID` | 하세나 플레이리스트 | 동일 | secret |
| `NEXT_PUBLIC_HASENA_PLAYLIST_ID` | 클라이언트 노출 버전 | grep 발견 — 중복 사용 의심 | public |
| `MAINTENANCE_MODE` | 유지보수 모드 토글 | middleware.ts | secret (Vercel env) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Next 레거시 Firebase 클라이언트 | firebase/config | public |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Next 레거시 Firebase 클라이언트 | firebase/config | public |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Next 레거시 Firebase 클라이언트 | firebase/config | public |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Next 레거시 Firebase 클라이언트 | firebase/config | public |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Next 레거시 Firebase 클라이언트 | firebase/config | public |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Next 레거시 Firebase 클라이언트 | firebase/config | public |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Next 레거시 FCM 웹 VAPID | firebase/messaging | public |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Next 레거시 서버 FCM | firebase/admin, send | secret |

---

> 참고: 위 Firebase/FCM 항목은 `maeil1dok-next` 전환 실험 인벤토리다. 현재 운영 Nuxt/Django 앱의 OS 푸시는 `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`를 사용하는 표준 Web Push(VAPID) 구현을 기준으로 한다.

## 검증 (자가)

```bash
# 라우트 카운트
find src/app -name "page.tsx" | wc -l                      # → 38
# API 라우트
find src/app/api -name "route.ts" | wc -l                  # → 33
# 컴포넌트 총합
find src/components -name "*.tsx" -o -name "*.ts" | wc -l  # → 111
# Migrations
ls supabase/migrations/*.sql | wc -l                       # → 7
# TS 에러
npx tsc --noEmit 2>&1 | grep -c "error TS"                 # → 5
# Vitest
npx vitest run                                              # → 4 failed / 42 passed (test files), 46 failed / 314 passed (tests)
```

<!-- rows: 페이지 38, API 33, 컴포넌트 111, lib 모듈 9개, 마이그레이션 7개, 환경변수 17개, TS 에러 5건, Vitest fail 4파일 -->
