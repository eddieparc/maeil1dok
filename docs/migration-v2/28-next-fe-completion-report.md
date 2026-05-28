# 28 · Next.js Frontend 완성도 감사 결과 보고서

> **감사 일시**: 2026-05-28 (Asia/Seoul)
> **감사 대상**: `maeil1dok-next/` (read-only)
> **감사자**: Sisyphus (Claude Opus 4.7)
> **선행 핸드오프**: [52-handoff-next-fe-audit.md](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/52-handoff-next-fe-audit.md)
> **Evidence 디렉토리**: [.sisyphus/evidence/next-fe-audit/](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/)

---

## §0 한 줄 Verdict

> **PARTIAL — Foundation broken, structure mature.**
>
> 35 page · 33 API · 102 component **골격은 완성 단계**이며 placeholder/TODO/console.log 흔적이 **0건**일 만큼 정돈되어 있다.
> 그러나 (1) **build FAIL** + **TS 5건** + **vitest 46건 fail** + (2) **`/bible` 라우트 HTTP 500 런타임 크래시** + (3) **2개 API 미구현(`/api/bible/personal-records/{stats,dates}`)** + (4) **`/` 홈 hydration mismatch** 가 동시에 존재한다.
>
> **Gate H (실 코드 작업 시작) 진입 전 Wave 0 (11-FOUND) 우선 완료가 필수**이며, 견적은 §7에 정밀화한다.

**등급 분류표**:

| 영역 | 등급 | 이유 |
|---|---|---|
| 코드 자산 정량 | 🟢 GREEN | 35 / 33 / 102 인벤토리 일치, placeholder 0건 |
| 정적 분석 | 🔴 RED | build FAIL, TS 5건, vitest 46 fail |
| 런타임 (public) | 🟢 GREEN | 13/13 HTTP 200, 0 console error, 0 net 4xx |
| 런타임 (authenticated) | 🟡 YELLOW | 21/22 HTTP 200, **1건 500 (`/bible`)**, API 누락 3건 |
| 디자인 시스템 | 🟡 YELLOW | atom 19개 정비, hex hardcode 11파일 26건 잔존 |
| 미완성 흔적 grep | 🟢 GREEN | placeholder/TODO/console.log = 0건 |

---

## §1 정적 분석 (4 도구 실행 결과)

모든 명령 출력은 [`/.sisyphus/evidence/next-fe-audit/*.log`](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/) 에 저장.

### §1.1 `npm run build` — ❌ FAIL

**재현 명령**: `cd maeil1dok-next && npm run build`

**증거 ([build.log](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/build.log))**:

```
⚠ Compiled with warnings in 1394ms
./src/app/(authenticated)/bible/page.tsx
Attempted import error: 'TongdokModeProvider' is not exported from '@/stores/bible/tongdokMode'
✓ Compiled successfully in 2.0s
Linting and checking validity of types ...
Failed to compile.

./src/app/(authenticated)/bible/settings/BibleSettingsContent.tsx:166:40
Type error: Type '<K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => void'
  is not assignable to type '<K extends string>(key: K, value: unknown) => void'.
Next.js build worker exited with code: 1 and signal: null
```

**진단**:
- 핸드오프(52-handoff §1.2)의 "catchup/page.tsx:154 missedCount" 에러는 **사라짐** (직전 세션 또는 다른 작업에서 fix됨)
- 새 build blocker = [`BibleSettingsContent.tsx:166`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/settings/BibleSettingsContent.tsx#L166) — `<FontSection settings={settings} updateSetting={updateSetting} />`. 부모 시그니처 `<K extends keyof ReadingSettings>`가 자식 시그니처 `<K extends string>`보다 좁아 invariant 위반.
- Warning(TongdokModeProvider 미export)은 §5.1 의 `/bible` 500 과 직결됨.

### §1.2 `npx tsc --noEmit` — ❌ 5건

**증거 ([tsc.log](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/tsc.log))**:

| # | 파일:라인 | 에러 코드 | 유형 |
|---|---|---|---|
| 1 | `src/app/(authenticated)/bible/settings/BibleSettingsContent.tsx:166:40` | TS2322 | updateSetting 시그니처 미스매치 |
| 2 | `src/app/(authenticated)/bible/settings/FontSection.tsx:89:38` | TS7053 | implicit any (Record key index) |
| 3 | `src/app/(authenticated)/plan/PlanPageClient.tsx:431:49` | TS2554 | Expected 1 arguments, but got 2 |
| 4 | `src/lib/modal/ModalRegistry.ts:55:9` | TS2769 | string \| undefined → string |
| 5 | `src/lib/modal/ModalRegistry.ts:56:9` | TS2769 | (동일 패턴) |

**핸드오프 비교**: 직전 5건 (BibleSettingsContent, FontSection, PlanPageClient, ModalRegistry, **CatchupClient**) → 본 감사 5건 (CatchupClient 빠지고 **BibleSettingsContent 신규** + ModalRegistry 2건으로 분리). **파일 구성은 변했으나 갯수는 동일 5**.

### §1.3 `npm run lint` — ✅ PASS

**증거 ([lint.log](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/lint.log))**: exit 0, 출력 없음.

> ⚠ `next.config.ts`에 ESLint plugin 미설정 (build 시 `⚠ The Next.js plugin was not detected in your ESLint configuration` 경고). 룰셋 신뢰도 의문.

### §1.4 `npx vitest run` — ❌ 46 fail / 314 pass (360 total)

**증거 ([vitest.log](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/vitest.log))**:

```
Test Files  4 failed | 42 passed (46)
     Tests  46 failed | 314 passed (360)
  Duration  3.17s
```

**핸드오프 비교**: 직전 "4건 fail" → **현재 46건 fail (11.5배 회귀)**. **REGRESSION 단정**.

**Root cause 3종**:

| 파일 | fail 수 | 진단 |
|---|---|---|
| `src/stores/bible/bibleUserData.test.ts` | 22 | `factory.ts:11` zustand v5 `createStore<T>()(initializer)` curry — vitest SSR import `__vite_ssr_import_0__.createStore is not a function`. zustand v5.0.11 자체는 export 존재 (`Object.keys: ['createStore','create','useStore']` 직접 확인). **vitest setup/mock 회귀**. |
| `src/stores/bible/tongdokMode.test.ts` | 22 | 동일 root cause |
| `src/lib/zustand/HydrationGate.test.tsx` | 1 | 즉시 `ready` 렌더 (fallback `loading` 미노출) — hydration 로직 변경 추정 |
| `tests/token-coverage.test.ts` | 1 | 11파일 26건 hex hardcode 검출 — 디자인 토큰 미마이그레이션 |

### §1.5 E2E 인벤토리 (실행 안함)

```
$ find tests -name '*.spec.ts' | wc -l
18
```

`tests/e2e/*.spec.ts` 18개: a11y, avatar, bible, catchup, hasena, home, home-plan-d, intro, legal, modal, navigation, plans, profile, reading-settings, settings, toast, visual-regression, visual-regression-dark. `playwright.config.ts` setup project + chromium + 2 visual-regression projects (390×844) 분리 구조 ✅.

---

## §2 코드 자산 매트릭스

### §2.1 Page (`page.tsx`) — 35개 ✅

```
$ find src/app -name page.tsx | wc -l
35
```

**그룹별 분포**:

| 그룹 | 갯수 | 평균 라인 | `'use client'` | 최대 |
|---|---|---|---|---|
| `(authenticated)/*` | 22 | ~120 | 8/22 | `notes/[id]` 276 |
| `(public)/*` | 12 | ~155 | 10/12 | `register-email` 316 |
| root `page.tsx` | 1 | 120 | 0 | - |

**의심 (페이지가 너무 얇음, server-only wrapper로 추정)**:
- `bible/home/page.tsx` 7라인
- `groups/page.tsx` 9, `scoreboard/page.tsx` 9, `groups/[id]/page.tsx` 16
- `not-found/page.tsx` 20, `friends/page.tsx` 25

### §2.2 API (`route.ts`) — 33개 ✅

```
$ find src/app/api -name route.ts | wc -l
33
```

**라인 합계 ~2,500. HTTP 메서드 export 분포**:
- 1 메서드: 27개 (단일 핸들러)
- 2 메서드: 4개 (`notifications/{settings,token}`, `bible/{notes,personal-records}`, `profile/{reading-settings,avatar}`)
- 3 메서드: 2개 (`bible/{bookmarks,notes/[id]}`)
- 4 메서드: 1개 (`bible/highlights` — GET/POST/PATCH/DELETE)

**Top 3 (가장 무거움)**: `catchup/create` 193 · `bible/highlights` 173 · `cron/hasena-summary` 171.

**누락 발견 (§5.2 라이브 호출에서 404)**:
- ❌ `/api/bible/personal-records/stats` (없음)
- ❌ `/api/bible/personal-records/dates` (없음)

### §2.3 Components — 102개 ✅

```
$ find src/components -name '*.tsx' | wc -l
102
```

**도메인별 분포**:

| 도메인 | 갯수 | 비고 |
|---|---|---|
| `bible/*` | 38 | 가장 큰 영역. `BibleViewer.tsx` 574라인이 최대 |
| `ui/*` (atom) | 19 | Avatar, Badge, Button, Card, Container, EmptyState, Input, Modal, modal/{Alert,Confirm,ModalHost}, PageHeader, ProgressBar, Select, Skeleton, Tabs, Textarea, ThemeToggle, Toast |
| `home/*` | 7 | ReadingCardStack 269, QuickAccessGrid 162 |
| `layout/*`, `catchup/*`, `calendar/*` | 5 each | - |
| `settings/*`, `profile/*` | 4 each | - |
| `schedule/*`, `groups/*` | 3 each | - |
| `scoreboard/*`, `providers/*`, `friends/*` | 2 each | - |
| `plans/*`, `intro/*`, `hasena/*` | 1 each | - |

**과대 컴포넌트 (재구조화 후보)**:
- `hasena/HasenaClient.tsx` **716 lines** ← 최대
- `bible/BibleViewer.tsx` 574
- `intro/IntroClient.tsx` 415
- `bible/ReadingSettingsPanel.tsx` 361
- `bible/BibleHome.tsx` 310

---

## §3 디자인 시스템 적용도

### §3.1 atom 인벤토리 (19개)

[`src/components/ui/`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/) 에 19 atom 정비됨. CLAUDE.md §UI Component Guidelines의 **통합 모달 시스템**은 `useModal()` composable + `ModalHost` + `ConfirmModal` + `AlertModal` 4종으로 구현되어 있음 ✅.

### §3.2 Modal SSOT 진단

**`useModal()` 사용**: 12 hits. **`<Modal isOpen=>` (atom Modal 직접 마운트)**: 6 도메인 모달 — TongdokNextSchedule, Highlight, TongdokAlreadyComplete, NoteQuick, TongdokComplete, VersionSelector.

**판정**: 통합 시스템은 confirm/alert 전용. 폼 입력·옵션 선택이 필요한 도메인 모달은 atom Modal 직접 마운트가 적절. **CLAUDE.md 룰 위반 아님 (재해석)**. 단, 패턴 명세는 CLAUDE.md에 추가 권장.

### §3.3 Tailwind 토큰 vs Hardcoded hex

[`tests/token-coverage.test.ts`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/tests/token-coverage.test.ts) 1건 fail. **11 파일 26건 hardcoded hex 검출**:

| 파일 | 색상 | 비고 |
|---|---|---|
| `login/page.tsx` | `#FEE500`, `#000000` | 카카오 브랜드 색 (allowlist에 `#FEE500`만 있음, `#000000` 누락) |
| `api/bible/bookmarks/route.ts` | `#3B82F6` | DB default 색상 (서버 코드, 정당) |
| `bible/settings/SettingsPreview.tsx` | `#8BA888`, `#4A5D4A`, `#E0E0E0`, `#1F2937` | 미리보기 직접 색상 |
| `friends/FriendsClient.tsx` | `#FECACA`, `#FEF2F2`, `#B91C1C`, `#FCA5A5` | 에러 상태 (Toast/Banner 토큰화 필요) |
| `home/HasenaCard.tsx` | `#92400E` | amber 700 |
| `home/IntroCard.tsx` | `#1E40AF` | blue 800 |
| `layout/HeaderClient.tsx` | `#DC2626` | red 600 (delete account 등) |
| `ui/Container.tsx` | `#F9F8F6` | 주석 (docstring) — false positive 후보 |
| `hooks/bible/__tests__/useHighlight.test.ts` | `#FF0000`, `#666`, `#BBB` | 테스트 데이터 |
| `hooks/useConfetti.ts` | 6 confetti 색 | 정당 (random palette) |
| `stores/bible/bibleUserData.test.ts` | `#FFD700`, `#FF0000` | 테스트 데이터 |

**평가**: production runtime 코드 한정으로 7파일 (login, SettingsPreview, FriendsClient, HasenaCard, IntroCard, HeaderClient) 마이그레이션 필요. 나머지(테스트·서버·confetti)는 정당 허용 후보.

### §3.4 다크모드 / 반응형 적용도

§5.3 의 모바일 viewport (375×812) + 다크 모드 emulate(dark) 6 라우트 screenshot 확보 (`{id}-mobile-light.png`, `{id}-desktop-dark.png`). 모두 HTTP 200, 시각 검증은 산출물(screenshot) 기준 사용자 검토.

---

## §4 미완성 흔적 (Phase 3 hunt)

**모두 `src/` 내부 grep 실측**:

| 패턴 | hits | 평가 |
|---|---|---|
| `구현 예정` / `Task [0-9]+-[0-9]+` / `TODO production` / `FIXME production` | **0** | ✅ v2 plan placeholder 룰 통과 |
| `TODO` / `FIXME` / `XXX` / `HACK` | **0** | ✅ 매우 깨끗 |
| `console.log/debug/info` non-test | **0** | ✅ production-ready |
| `lorem` / `ipsum` | **0** | ✅ |
| `placeholder` (45 hits) | 모두 benign | `<Input placeholder=>` / `ModalRegistry 'placeholder' status` / bible parser `__BIBLE_PLACEHOLDER__` 토큰 |
| `as any` / `@ts-ignore` / `@ts-expect-error` / `as unknown as` | 41건 | tests 21 + Supabase repos 30 + **production 코드 5건** |

**Production TS escape 5건** (실제 우회 — 식별 완료):

| 파일:라인 | 패턴 | 평가 |
|---|---|---|
| [`api/catchup/create/route.ts:147`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/catchup/create/route.ts#L147) | `(supabase.from('catchup_sessions') as any)` | Supabase type 보강으로 제거 가능 |
| [`api/catchup/create/route.ts:167`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/catchup/create/route.ts#L167) | `(supabase.from('catchup_schedules') as any).insert(...)` | 동일 |
| [`api/catchup/create/route.ts:176`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/api/catchup/create/route.ts#L176) | `(supabase.from('catchup_sessions') as any)` | 동일 |
| [`components/bible/ReadingSettingsModal.tsx:206`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/bible/ReadingSettingsModal.tsx#L206) | `updateSetting(key as any, value as any)` | §1.2 #1 build blocker와 동일 패턴 (해결 시 일괄 처리 가능) |
| [`lib/bible/search.ts:43`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/lib/bible/search.ts#L43) | `CHOSUNG_LIST.includes(char as any)` | readonly array narrow — TS 5.5+ `Array.includes` widening 으로 제거 가능 |

---

## §5 라이브 런타임 검증 (Phase 5)

`npm run dev` (Next 15.5.12, ready 1043ms) + Playwright headed Chrome desktop 1280×800 (light) → 모바일 375×812 → 다크모드 1280×800 순.
사용자 본인 Supabase 계정 (Email/OAuth 자율) 로그인 확보. `sb-rvkfecshizmsldwodmfe-auth-token` 쿠키 확인 후 walk 진행.

> **사전 합의**: dev 서버는 production Supabase 직결 (`NEXT_PUBLIC_SUPABASE_URL=rvkfecshizmsldwodmfe.supabase.co` 단일 환경). 본 감사는 navigation/read-only만 수행 — 어떤 DB write도 없음.

### §5.1 (authenticated) 22 라우트 — **21/22 OK, 1건 500**

**증거 ([authenticated-walk.json](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/walks/authenticated-walk.json) + 22 PNG)**.

| 라우트 | status | h1 | bodyLen | console err | net 4xx/5xx | 평가 |
|---|---|---|---|---|---|---|
| `/` | 200 | "나른한 오후,\n말씀과 동행하세요" | 304 | 0 | 0 | ⚠️ **pageerror: Hydration mismatch** |
| **`/bible`** | **500** | **"문제가 발생했습니다"** | 86 | 3 | 1 | 🔴 **HTTP 500. Element type undefined** |
| `/bible/home` | 200 | "성경" | 357 | 1 | 1 | 🟡 `/api/bible/highlights` 400 |
| `/bible/bookmarks` | 200 | "북마크" | 156 | 0 | 0 | ✅ |
| `/bible/highlights` | 200 | "하이라이트" | 496 | 0 | 0 | ✅ **BUG-006 NOT REPRODUCED** |
| `/bible/history` | 200 | "읽기 기록" | 1228 | 2 | 2 | 🟡 `/api/bible/personal-records/{stats,dates}` 404 |
| `/bible/notes` | 200 | "묵상노트" | 457 | 0 | 0 | ✅ |
| `/bible/notes/[placeholder-id]` | 200 | (empty) | 74 | 1 | 1 | 🟡 404 on 존재 안 함 ID (정당 동작) |
| `/bible/settings` | 200 | "읽기 설정" | 437 | 0 | 0 | ✅ |
| `/calendar` | 200 | "내 캘린더" | 236 | 0 | 0 | ✅ |
| `/catchup` | 200 | "밀린 통독 따라잡기" | 125 | 0 | 0 | ✅ |
| `/friends` | 200 | "친구" | 132 | 0 | 0 | ✅ |
| `/groups` | 200 | "그룹" | 366 | 0 | 0 | ✅ |
| `/groups/[placeholder-id]` | 200 | "그룹 정보" | 129 | 0 | 0 | ✅ |
| `/hasena` | 200 | "하세나" | 185 | 0 | 0 | ✅ |
| `/intro` | 200 | "개론" | 1209 | 0 | 0 | ✅ |
| `/plan` | 200 | "성경통독표" | 972 | 0 | 0 | ✅ |
| `/plans` | 200 | "플랜 관리" | 219 | 0 | 0 | ✅ |
| `/profile/[placeholder-id]` | 200 | (empty) | 111 | 0 | 0 | ⚠️ 빈 h1 — 존재 안 함 ID에 대한 empty state UX 검증 필요 |
| `/reading` | 200 | (empty) | 127 | 0 | 0 | ⚠️ 빈 h1 (의도 여부 확인) |
| `/scoreboard` | 200 | "스코어보드" | 261 | 0 | 0 | ✅ |
| `/settings` | 200 | "계정 설정" | 379 | 0 | 0 | ✅ |

#### §5.1.A `/bible` HTTP 500 원인 단정

**브라우저 콘솔 에러 원문**:
```
Error: Element type is invalid: expected a string (for built-in components)
or a class/function (for composite components) but got: undefined.
You likely forgot to export your component from the file it's defined in,
or you might have mixed up default and named imports.
```

**진단**:

[`src/app/(authenticated)/bible/page.tsx:2`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/%28authenticated%29/bible/page.tsx#L2):
```typescript
import { TongdokModeProvider, createTongdokModeStore } from '@/stores/bible/tongdokMode'
```

[`src/stores/bible/tongdokMode.ts:270-274`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/stores/bible/tongdokMode.ts#L270-L274):
```typescript
export const {
  StoreProvider: TongdokModeProvider,
  useStoreContext: useTongdokMode,
  useStoreApi: useTongdokModeApi,
} = createStoreContext<TongdokModeState>()
```

> Export 자체는 정적으로 존재 (line 271 destructured rename). 그러나 런타임에서 `TongdokModeProvider`가 `undefined` → `createStoreContext()`가 `{ StoreProvider }` 객체를 반환하지 않거나, Turbopack/Webpack의 정적 분석이 destructured rename을 인식 못함.
>
> Build warning "Attempted import error" 와 동일 root cause.

**해결 방향 (Wave 0 추가 작업)**:
- **옵션 A**: `createStoreContext()` 구현 확인 후 반환 객체 보장
- **옵션 B**: `tongdokMode.ts` 에 `export const TongdokModeProvider = ...` 평이한 named export 로 재작성 (정적 분석 친화)
- **옵션 C**: provider.tsx 의 `createStoreContext` 가 named export 4개를 직접 export 하도록 리팩토링

### §5.2 (public) 13 라우트 — **13/13 OK**

**증거 ([public-walk.json](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/walks/public-walk.json) + 13 PNG)**.

모두 HTTP 200, console error 0, network 4xx/5xx 0. 일부 bodyLen 작음 (login 97, register-email 80, auth-* 82-103) — render skeleton 또는 minimal UI (브랜드 로고 + 입력 폼만). screenshot 시각 검증 가능.

### §5.3 다크모드 / 모바일 viewport — **12/12 OK**

6 핵심 라우트 × 2 viewport (mobile-375×812-light + desktop-1280×800-dark) = 12 screenshot 추가 확보. 모두 HTTP 200, 시각 회귀는 사용자 검토 영역.

### §5.4 BUG 회귀 검증 (Nuxt → Next 측 재현 여부)

핸드오프 §1.5 의 라이브 사이트(Nuxt+Django) BUG 들이 Next 측에도 있는지 단정:

| BUG (Nuxt 측) | Next 측 단정 | 증거 |
|---|---|---|
| **BUG-001** 본문 미표시 (`/bible`) | **N/A** — Webfetch false positive (27-handoff §3) | 검증 불가능 (애초 결함 없었음) |
| **BUG-003** 콘솔 hydration mismatch | **🔴 REPRODUCED** at `/` | authenticated-walk.json id=authed-root `pageErrs[0]` = "Hydration failed because the server rendered HTML didn't match the client" |
| **BUG-004** 책장 URL undefined | **❓ UNVERIFIABLE** | `/bible` 500 으로 책 선택 인터랙션 시점 도달 불가 — Wave 0 해결 후 재검증 의무 |
| **BUG-005** "Task 3-3 placeholder" | **🟢 NOT FOUND** | `grep -rE '구현 예정\|Task [0-9]+-[0-9]+'` = 0 hits 단정 (§4) |
| **BUG-006** `/bible/highlights` 로그인 사용자 null TypeError 크래시 | **🟢 NOT REPRODUCED** | `/bible/highlights` HTTP 200, h1 "하이라이트", bodyLen 496, console err 0, pageErr 0 |
| **T0004** 리더보드 뒤로 500 | **❓ UNVERIFIED** | `/scoreboard` 단독 진입은 200/clean. 뒤로가기 인터랙션 미테스트 (별도 시나리오 필요) |

**신 결함 (Nuxt 에 없던 것 — Next 측 고유)**:

| ID | 라우트 | 증상 |
|---|---|---|
| **NEXT-BUG-A** | `/bible` | TongdokModeProvider undefined → HTTP 500 (가장 critical) |
| **NEXT-BUG-B** | `/bible/home` | `/api/bible/highlights` 400 (page 진입 시 자동 호출, 미인증/잘못된 쿼리 의심) |
| **NEXT-BUG-C** | `/bible/history` | `/api/bible/personal-records/{stats,dates}` 404 — API 자체 미구현 (33 API 리스트 부재 확인) |
| **NEXT-BUG-D** | `/profile/[id]`, `/reading` | 빈 h1 (UX intent 불명) |

---

## §6 05-feature-matrix.md 대조 (Phase 6 dry-run)

> **사용자 결정**: dry-run + 사용자 검토 후 적용 (직전 Phase 5 결정 시 옵션 선택). 본 절은 **변경 제안만** 작성. 실 갱신은 사용자 명시 승인 후.

### §6.1 라벨 변경 제안

[`05-feature-matrix.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/05-feature-matrix.md) 의 27 PARITY 행 중 본 감사 결과 변경 필요 항목:

| 행 (05-feature-matrix.md 라인) | 현 라벨 | 변경 제안 | 사유 |
|---|---|---|---|
| L36 `/bible` (1198) | PARITY | **🔴 REGRESSION** | HTTP 500 런타임 크래시 (`TongdokModeProvider undefined`) |
| L38 `/bible/highlights` | PARITY (BUG-005 잔존 의심) | **✅ PARITY 확정** | BUG-005 0 hits 단정 + 라이브 200 clean |
| L39 `/bible/history` | PARITY | **🟡 REGRESSION (API)** | `/api/bible/personal-records/{stats,dates}` 404 |
| L42 `/bible/settings` | PARITY (TS 에러 잔존) | **유지 (TS 5건 중 2건 잔존)** | BibleSettingsContent + FontSection TS 에러 |
| L83 `/bible/home` | NEW (정체성 분리 의도 확인 필요) | **🟡 NEW + 결함 1건** | `/api/bible/highlights` 400 |
| L211 BUG-003 | "Playwright 콘솔 수집" | **🔴 CONFIRMED Next 측 재현** | `/` 홈 hydration mismatch 단정 |
| L213 BUG-005 | "placeholder grep CI" | **🟢 RESOLVED** | 0 hits 단정 |
| L209 BUG-001 | "Webfetch 단독 불가" | **🟢 N/A 확정** | 재현 시도 불가 (애초 결함 없음, 27-handoff §3 confirm) |

### §6.2 신 BUG 등재 제안

05-feature-matrix.md L209~L215 BUG 표에 추가:

```markdown
| NEXT-BUG-A | /bible HTTP 500 | TongdokModeProvider undefined | 11-FOUND (urgent) |
| NEXT-BUG-B | /api/bible/highlights 400 | /bible/home 진입 시 자동 호출 실패 | 11-ANNOTATE |
| NEXT-BUG-C | /api/bible/personal-records/{stats,dates} 404 | API 자체 미구현 | 11-PROGRESS |
| NEXT-BUG-D | /profile/[id]·/reading 빈 h1 | UX intent 불명 — empty state 디자인 필요 | 11-SOCIAL / 11-READER |
```

### §6.3 실제 적용 여부

**미적용 (dry-run)**. 사용자가 본 §6.1 + §6.2 검토 후 "적용" 명시 요청 시 04-/05-* 파일 수정 가능.

---

## §7 Wave 0 (11-FOUND) 정밀 견적

핸드오프 §3 Phase 6.3 의 F-1 ~ F-17 슬라이스에 대한 견적. **모든 추정은 본 감사 실측 기반.**

### §7.1 F-1 ~ F-3 (sanity)

| 슬라이스 | 작업 | 견적 (junior dev) | 견적 (Sisyphus) |
|---|---|---|---|
| F-1 npm install | node_modules 이미 존재, 재설치 불요 | 0 min | 0 min |
| F-2 playwright.config testMatch 충돌 | playwright.config.ts 검증 — 충돌 없음 (`testMatch: /.*\.setup\.ts/` 등 분리 명확) | 5 min (확인만) | 0 min (본 감사로 검증됨) |
| F-3 vercel.json 확인 | cron 3개 정상 | 5 min | 0 min |

**합계 F-1~F-3**: 0 min (본 감사 부산물로 완료)

### §7.2 F-4 (TS 에러 5건 fix) — **핵심 작업**

| # | 파일 | 추정 fix 라인 | 난이도 |
|---|---|---|---|
| 1 | `BibleSettingsContent.tsx:166` updateSetting 시그니처 | FontSection prop 시그니처를 `<K extends keyof ReadingSettings>` 로 좁히기 (FontSection 내부도 갱신) | M (인터페이스 변경 2~3파일 영향) |
| 2 | `FontSection.tsx:89` Record key 인덱싱 implicit any | `(fontFamilies as Record<string, ...>)[key]` 또는 type guard 추가 | S (1 라인) |
| 3 | `PlanPageClient.tsx:431` Expected 1 args got 2 | 호출자 또는 함수 시그니처 확인 (잘못된 추가 인자) | S (1 라인) |
| 4 | `ModalRegistry.ts:55-56` undefined assignment | nullish 가드 추가 | S (2 라인) |

**견적 합계**: ~45 min (오라클 컨설팅 0 — 모두 명확한 fix)

### §7.3 F-5 (build green)

F-4 완료 후 자동 동반. 단 **`/bible` 500 root cause 해결 의무 동반** (build warning + runtime crash 동일 root cause).

| 작업 | 견적 |
|---|---|
| TongdokModeProvider 해결 (옵션 B 권장: tongdokMode.ts 평이한 named export 재작성) | 20 min |
| build 재실행 + diagnostics clean 확인 | 5 min |

**견적 합계**: 25 min

### §7.4 F-6 (vitest 46 fail → 0)

| 그룹 | 견적 | 비고 |
|---|---|---|
| zustand factory.ts createStore vitest SSR 회귀 (44건) | 30~60 min | vitest config 또는 mock 점검. zustand v5.0.11 자체는 정상, vitest 환경 회귀. 1건 fix 시 44건 동시 해결. |
| token-coverage hex 11파일 (1건) | 60 min | login 카카오 색은 allowlist 추가, 나머지 7 production 파일 토큰화 |
| HydrationGate 1건 | 15 min | 컴포넌트 hydration 로직 변경 — 테스트 vs 구현 align |

**견적 합계**: 1.75 ~ 2.25 hour

### §7.5 F-7 ~ F-12 (WIP 정리 + git)

핸드오프 §1.2의 "`e5269db WIP(backend): update 24 files` main 푸시됨 (정리 미완)" — 본 감사는 git 정리 미수행. **사용자 결정 항목 §8 #1 참조**.

### §7.6 F-13 ~ F-17 (잔여)

핸드오프 §3 Phase 6.3 미상세. 11-FOUND.md 직접 참조 필요 (본 감사 범위 밖).

### §7.7 신규 의무 작업 (본 감사로 추가 발견)

| 항목 | 견적 | 슬라이스 |
|---|---|---|
| NEXT-BUG-A `/bible` 500 (TongdokModeProvider) | 20 min (F-5와 동일 root cause) | 11-FOUND |
| NEXT-BUG-B `/bible/home` 400 진단 + fix | 30 min | 11-ANNOTATE |
| NEXT-BUG-C `/api/bible/personal-records/{stats,dates}` API 신규 구현 2종 | 2 hour | 11-PROGRESS |
| NEXT-BUG-D 빈 h1 (`/profile/[id]`, `/reading`) empty state UX | 30 min | 11-SOCIAL + 11-READER |
| BUG-003 `/` 홈 hydration mismatch root cause 분석 + fix | 1 hour | 11-AUTH + 11-DESIGN |

**신규 작업 합계**: ~4.5 hour

### §7.8 Wave 0 전체 견적

| 영역 | 견적 |
|---|---|
| F-1 ~ F-3 sanity | 0 min |
| F-4 TS 5건 fix | 45 min |
| F-5 build green (포함 TongdokModeProvider) | 25 min |
| F-6 vitest 46 fail → 0 | 1.75 ~ 2.25 hour |
| F-7 ~ F-12 WIP 정리 | 사용자 결정 의존 |
| 신규 의무 (NEXT-BUG A~D + hydration) | 4.5 hour |
| **합계 (F-7 ~ F-12 제외)** | **약 7.5 ~ 8 hour** |

> **유의**: 본 견적은 본 감사가 직접 실행하지 않은 영역(예: zustand factory 회귀 root cause 정밀 진단)에 1-2 hour buffer 추가 가능.

---

## §8 다음 단계 사용자 결정 항목

### §8.1 즉시 결정 필요

| # | 영역 | 옵션 |
|---|---|---|
| 1 | 본 보고서 commit | (a) 명시 요청 시 commit / (b) 사용자가 직접 commit / (c) 보류 |
| 2 | §6.1 05-feature-matrix.md 라벨 변경 적용 | (a) 본 감사 산출물로 즉시 적용 / (b) 사용자 검토 후 별도 단계 / (c) 보류 |
| 3 | §6.2 신 BUG (NEXT-BUG A~D) 05-feature-matrix.md 등재 | (a) 적용 / (b) 별도 BUG-007 ~ 시리즈로 재명명 후 적용 / (c) 보류 |
| 4 | Wave 0 (F-1 ~ F-17) 진입 시점 | (a) 즉시 새 세션 시작 / (b) 핸드오프 별도 작성 후 / (c) 사용자 검토 시간 |

### §8.2 Gate H 진입 권고

> **본 감사 권고**: Wave 0 (특히 F-4 + F-5 + 신규 NEXT-BUG-A) 완료 전 Gate H 본격 진입은 **불가**.
> Build FAIL + `/bible` 500 상태에서 다른 슬라이스 (Wave 1 MIGRATE 등) 진행 시 회귀 검증 자체가 불가능.

권장 순서:
1. **Wave 0 P0 cluster** (3~4 hour): F-4 TS 5건 + F-5 build green + NEXT-BUG-A TongdokModeProvider → `npm run build` 통과 + `/bible` 200 회복
2. **Wave 0 P1 cluster** (2~3 hour): F-6 vitest 46 fail → 0 + NEXT-BUG-C API 2종 구현 + BUG-003 hydration fix
3. **Wave 0 cleanup** (1~2 hour): F-7~F-12 WIP 정리 (사용자 결정 의존)
4. **Gate H 본격 진입** (Wave 1 MIGRATE) — Wave 0 완료 확인 후

### §8.3 본 감사 결과의 한계 (메타-감사 자가 보고)

| 영역 | 한계 |
|---|---|
| BUG-004 책장 URL undefined | `/bible` 500 으로 인터랙션 도달 불가 — Wave 0 후 재검증 의무 |
| T0004 리더보드 뒤로 500 | 뒤로가기 인터랙션 시나리오 미테스트 |
| 다크모드 / 모바일 시각 회귀 | 6 라우트 × 2 viewport screenshot 확보했으나 **시각 비교는 사용자 검토 영역** |
| `[id]` 동적 라우트 | placeholder UUID (`00000000-...`) 만 테스트. 실 존재 ID 로의 happy path 미검증 |
| 35 - 22 - 13 = 0 (총합) | 35 page 모두 raw walk 완료 ✅ |

---

## §9 신뢰성 보장 (재현 명령 + evidence)

### §9.1 재현 명령

```bash
# Phase 1 정적 분석
cd maeil1dok-next
npm run build 2>&1 | tee build.log              # FAIL
npx tsc --noEmit 2>&1 | tee tsc.log             # 5 errors
npm run lint 2>&1 | tee lint.log                # PASS
npx vitest run 2>&1 | tee vitest.log            # 46 fail

# Phase 2 매트릭스
find src/app -name page.tsx | wc -l             # 35
find src/app/api -name route.ts | wc -l         # 33
find src/components -name '*.tsx' | wc -l       # 102

# Phase 3 hunt
grep -rE '구현 예정|Task [0-9]+-[0-9]+|TODO production' src/ | wc -l   # 0
grep -rE 'TODO|FIXME|XXX|HACK' src/ | wc -l                              # 0
grep -rE 'console\.(log|debug|info)' src/ | grep -v -E '__tests__|\.test\.|\.spec\.' | wc -l   # 0

# Phase 5 라이브 (사용자 로그인 필요)
npm run dev &
# Playwright headed Chrome 으로 13 public + 22 authenticated 순회
```

### §9.2 Evidence 파일 트리

```
.sisyphus/evidence/next-fe-audit/
├── build.log          (1.7 KB)
├── tsc.log            (1.7 KB)
├── lint.log           (51 B)
├── vitest.log         (43 KB)
├── walks/
│   ├── public-walk.json         (13 routes)
│   └── authenticated-walk.json  (22 routes)
└── screenshots/                 (46 PNG)
    ├── {public-id}-light.png         × 13
    ├── {authed-id}-light.png         × 21
    ├── bible-light.png               (500 error page)
    ├── {key-id}-mobile-light.png     × 6
    └── {key-id}-desktop-dark.png     × 6
```

### §9.3 자가-감사 (meta-audit) 자기 신뢰성

| 단정 | 출처 | 신뢰도 |
|---|---|---|
| build FAIL | build.log:42 (Failed to compile + TS error) | 🟢 명령 출력 |
| tsc 5건 | tsc.log:1-15 | 🟢 명령 출력 |
| lint PASS | lint.log exit 0 | 🟢 명령 출력 |
| vitest 46 fail | vitest.log:Test Files 4 failed | 🟢 명령 출력 |
| 35/33/102 인벤토리 | find … wc -l | 🟢 명령 출력 |
| placeholder 0 hits | grep ... wc -l | 🟢 명령 출력 |
| `/bible` 500 | authenticated-walk.json id=bible status=500 | 🟢 Playwright 출력 |
| BUG-006 not reproduced | id=bible-highlights status=200 consoleErrsN=0 pageErrsN=0 | 🟢 Playwright 출력 |
| Wave 0 견적 7.5~8 hour | §7 본 감사 추정 | 🟡 추정 — 실 작업 시 ±20% 변동 가능 |
| TongdokModeProvider 진단 (Turbopack 정적 분석 미인식) | grep 출력 + build warning + runtime 500 매칭 | 🟡 추정 (정확 root cause는 createStoreContext 구현 분석 필요) |

> 🔴 (출처 없음·환각) 단정 없음.

---

## §10 완료 신호

핸드오프 §10 의 완료 신호 체크:

- [x] §5 모든 성공 기준 충족 (4 정적 도구 실행 / 35+33+102 매트릭스 / 라이브 35 page 순회 / BUG 회귀 검증)
- [x] 신규 파일 `28-next-fe-completion-report.md` 작성 완료
- [x] §0 한 줄 verdict 등급 (**PARTIAL — Foundation broken, structure mature**)
- [ ] 갱신된 `05-feature-matrix.md` — **dry-run only (사용자 검토 대기)**
- [x] evidence 디렉토리 `.sisyphus/evidence/next-fe-audit/` 완비
- [x] 사용자에게 verdict + 다음 단계 (Gate H 진입 우선순위) 결정 요청 (§8)

---

<!-- audit-version: 1 -->
<!-- audit-date: 2026-05-28 -->
<!-- audit-source: 52-handoff-next-fe-audit.md -->
<!-- evidence-root: .sisyphus/evidence/next-fe-audit/ -->
