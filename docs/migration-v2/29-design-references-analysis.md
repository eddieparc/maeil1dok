# 29 · 디자인 레퍼런스 분석 + 디자인 매너 후보

> **작성일**: 2026-05-28
> **선행**: [28-next-fe-completion-report.md](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/28-next-fe-completion-report.md) (감사 완료 — Verdict PARTIAL)
> **목적**: 80장 lazyweb 레퍼런스 분석 → 매일일독에 적용할 디자인 매너 4종 후보 도출 → 사용자 선택 → Storybook 시각화 → 19 atom 재디자인 → 35 page 빅뱅 재구현 (별도 세션)

---

## §0 진행 상태

| 항목 | 상태 |
|---|---|
| Storybook 9 (10.4.1) 셋업 | ✅ 완료 (`.storybook/{main,preview}` + 샘플 stories 3건 + vitest/a11y/docs/mcp addons + Chromatic + Playwright 바이너리) |
| 4 카테고리 × 20장 = 80장 lazyweb 수집 | ✅ 완료 (similarity 점수 + vision 캡션 raw 포함) |
| Bible 카테고리 노이즈 제거 | ⚠️ 20장 중 8장만 effective (blank screen 12건 노이즈) |
| 디자인 매너 후보 4종 도출 | ✅ 본 문서 §3 |
| 사용자 매너 선택 | ⏳ 대기 |
| Storybook에서 atom 시각화 | ⏳ 매너 선택 후 |
| 19 atom 재디자인 | ⏳ 시각화 후 |
| 35 page 빅뱅 재구현 | ⏳ 별도 세션 (Wave 0 동반 fix) |

---

## §1 80장 수집 결과 요약

### §1.1 카테고리별 effective hits

| 카테고리 | 검색어 | 수집 | effective | 노이즈 |
|---|---|---|---|---|
| 1. Premium reading / focus | "Premium reading focus app interface dark cream minimal long-form text reader with bookmarks highlights notes" | 20 | ~16 | 4 (apple-books 마케팅 페이지 중복 변형) |
| 2. Habit tracker / streak | "habit tracker streak daily app calendar grid progress completion check-in mobile interface" | 20 | ~19 | 1 |
| 3. Bible / Christian | "Bible app YouVersion devotional Christian reading plan verse highlight chapter navigation" | 20 | **8** | **12** (blank screens) |
| 4. Minimal SaaS / Notion·Linear | "minimal SaaS dashboard Notion Linear Cron grayscale accent typography clean whitespace" | 20 | ~17 | 3 (camera/loading splash) |
| **합계** | - | **80** | **~60** | **~20** |

> Bible 카테고리는 lazyweb 인덱스가 빈약 — Mobbin/Savee 추가 소스 권장. 본 분석은 60 effective 기준.

### §1.2 패턴별 추출 (vision 캡션 + similarity 점수 기반)

#### 패턴 A: 다크 모드 long-form serif reader

- **everand** (similarity 0.645): "long-form content on dark background with serif typography for distraction-free reading"
- **ref1_bible** (0.699): "Bible reading screen showing a chapter passage in dark mode with verse numbers"
- **art-of-fauna** (0.632): "Fullscreen reading text display with large paginated paragraphs on a dark background"
- **night-sky** (0.531): "long-form dark-mode article page with scrolling text and embedded mobile UI screenshots"
- **wikipedia reading preferences**: "테마 (Default/system, Light, Sepia, Dark, Black) + dimming images"

**핵심 매너**: 다크 배경 + serif 본문 + 미니멀 chrome + 좌우 chapter navigation arrows + verse numbers superscript

#### 패턴 B: Verse-of-the-day 카드 + 데일리 안내

- **kjvbible** (0.687): "Verse of the Day card with artwork, verse text, primary actions to share, read passage, subscribe, watch video"
- **ref5_bible** (0.616): "Bible verse card + chat prompts (Ask anything, Heal my pain, Customized devotionals)"
- **hallow** (0.512): "Daily quote card + email newsletter signup form"
- **alpha** (0.496): "Bible reading habit hero banner + program CTAs + featured content section + video"

**핵심 매너**: 큰 verse 카드 (이미지 backdrop 옵션) + 텍스트 중앙 정렬 + share/play/save 액션 행 + 데일리 갱신 indicator

#### 패턴 C: 캘린더 + 스트릭 시각화

- **duolingo streak** (0.681): "monthly calendar of daily activity + Personal/Friends tabs + streak goal progress bar"
- **headway streak** (0.529): "intro screen explaining calendar feature to track progress + streak badge preview + Continue button"
- **drops streak** (0.667): "month calendar visualizing activity + Rescues section with locked reward icons + Share button"
- **mindllama** (0.670): "current day streak count in large card + monthly calendar + selectable dates + close/more options"
- **speak** (0.495): "current day streak + weeks in a row + flame icon + month calendar + Your Records section"
- **boldvoice** (0.699): "monthly calendar view for habit/activity tracking + checkmarked completed days + summary stats"
- **finch insights** (0.516): "mood calendar heatmap across months + filter + legend (positive/neutral/negative)"
- **how-we-feel** (0.670): "Check-in saved confirmation + circular progress ring indicating daily completion + streak status"

**핵심 매너**: 월별 캘린더 히트맵 + 큰 숫자 streak 카드 + 화염/체크 아이콘 + 우측 weekly indicators + Share/Rescue CTAs

#### 패턴 D: 데일리 체크인 / 큰 완료 액션

- **habits** (0.667): "Habit tracker daily check-in screen showing a large central checkbox button to press and hold to mark a habit completed"
- **zero** (0.691): "Daily habit tracker Today dashboard showing weekly streak overview + large completion checkmark + primary plus button"
- **how-we-feel** (0.670): "Check-in saved + circular progress ring + central plus button to start another check-in"
- **couple-joy** (0.420): "1 day streak with flame icon + weekly calendar tracker + I'm committed button"

**핵심 매너**: 큰 단일 액션 (체크박스/플러스/체크마크) 중앙 + 위클리 점 7개 + flame indicator + commit CTA

#### 패턴 E: 미니멀 다크 productivity (Notion / Raycast / Linear 톤)

- **notion main_tabs** (0.493): "Dark-mode home dashboard with Jump back in cards + Favorites list + plus buttons + bottom navigation home/search/inbox/new"
- **acrobat** (0.493): "Dark-mode home with Welcome header + Recent/Starred file tabs + floating + action button"
- **persist** (0.515): "Minimal notes home in dark mode with Notes header + simple note text area + profile avatar + bottom sheet"
- **up-ahead** (0.486): "Minimal dark countdown home + welcome + app description + floating plus + sliders icon"
- **glean** (0.481): "Home dashboard with global search bar + Today agenda card + tabbed feed (Suggested/Recent/Mentions)"
- **raycast** landing (0.512): "Dark-themed productivity landing 'A new start' + templates + integrations"

**핵심 매너**: 다크 #0A0A0B 베이스 + 회색 텍스트 위계 + 단일 accent (paint of color) + 좌측 sidebar / 하단 nav + 큰 hero greetings

#### 패턴 F: 크림 / 미니멀 라이트 (현재 매일일독 적합)

- **doji** (0.480): "Minimal fashion landing page with centered hero image + sparse navigation (Manifesto/Careers) + Get the app CTA"
- **minimal-gallery** (0.316): "Distraction-free reader screen with serene landscape background + add bookmark buttons + sort dropdown"
- **canva templates** (0.379): "Template marketplace with search bar + horizontal category chips + scroll grid + see all links"
- **calendly admin** (0.391): "Admin dashboard preview + delegation + templates + onboarding/team setup sections"

**핵심 매너**: 크림 #faf8f6 / 흰 베이스 + 얇은 border + serif + sans 콤보 + sparse navigation + 큰 hero typography

---

## §2 현 매일일독 토큰 + 패턴 매칭

[현 globals.css](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/globals.css#L72-L113) 가지고 있는 자산:

```css
--color-primary: #4B9F7E;          /* sage green */
--color-bg-primary: #faf8f6;       /* cream */
--font-family-ui: "Pretendard"     /* 한국 sans-serif */
--font-family-reading: "KoPub Batang"  /* 한국 명조체 — 성경 본문 */
```

| 매칭 | 평가 |
|---|---|
| 패턴 F (크림 라이트) | ✅ **현재 자산과 80% 매칭** — 토큰 살아있음, atom 정비만 필요 |
| 패턴 A (다크 long-form) | 🟡 부분 — KoPub Batang 다크 모드 가능. globals.css 에 `--custom-variant dark` 정의됨. |
| 패턴 B (verse-of-the-day) | ⚠️ 현재 미보유 — `/bible/home` 또는 `/` 홈에서 활용 가능 |
| 패턴 C (캘린더 + 스트릭) | ✅ 부분 — `/calendar` 페이지 존재. `/plan` 페이지에 진행률 carrier 가능. |
| 패턴 D (데일리 체크인) | 🟡 부분 — 통독 schedule complete API 있음. 시각화 약함. |
| 패턴 E (다크 productivity) | 🟡 보조 — 다크 모드 ThemeToggle 있음. settings/admin 영역 적합. |

---

## §3 디자인 매너 후보 4종 (사용자 선택용)

각 매너에 **공통 베이스** (현재 sage `#4B9F7E` + cream `#faf8f6` + Pretendard/KoPub 유지)를 두고 각자 시각 정체성을 다르게 갑니다.

### 매너 1 — **"Devotional Modern"** (Reading-first, Notion-aligned)

```
영감: Readwise Reader + Notion + Apple Books + Wikipedia Reading preferences
타깃 페이지: /bible (성경 본문), /bible/notes, /bible/highlights
```

- **컬러**: 라이트 모드 크림 `#faf8f6` + sage `#4B9F7E` accent / 다크 모드 `#0F0E0C` (warm dark) + sage 약화
- **타이포**: UI = Pretendard / 본문 = KoPub Batang 17-19px / 디스플레이 = KoPub Batang Bold 32-44px
- **레이아웃**: 본문 max-w-prose (65ch) 중앙. 좌우 거대한 여백. chrome 미니멀.
- **컴포넌트 특징**:
  - Verse 행: superscript number + leading-relaxed
  - 다크/라이트/세피아 3 테마 토글 (Wikipedia 패턴 차용)
  - 책장 선택 = drawer (Reader.app 패턴)
  - 하이라이트 5색 (yellow/green/blue/pink/purple) — pastel
  - 북마크/노트/하이라이트 인라인 long-press menu
- **모션**: ease-out, 부드러운 fade (200-300ms)
- **장점**: 매일일독 핵심 = 성경 본문 reading. 본문 제일주의. 한국 명조체 살림.
- **위험**: SaaS dashboard 느낌이 약해 `/scoreboard`, `/friends` 등 social 페이지에서 묽어 보일 수 있음.

### 매너 2 — **"Quiet Discipline"** (Habit-tracker-first, Calm-aligned)

```
영감: Streaks + Calm + duolingo streak + how-we-feel + finch insights
타깃 페이지: /, /plan, /catchup, /scoreboard
```

- **컬러**: 라이트 = warm cream `#FAF6F0` + sage `#4B9F7E` (primary) + amber `#D4A24C` (streak accent) / 다크 = `#1A1815` (warm dark)
- **타이포**: UI = Pretendard 14-15px / 디스플레이 = KoPub Batang Bold 24-32px (덜 큼)
- **레이아웃**: 큰 일일 체크인 카드 1개 중앙 + 보조 widget 그리드 (calendar heatmap + streak metric + today's plan)
- **컴포넌트 특징**:
  - "오늘 읽기" 큰 단일 액션 카드 (data-driven 진행률 ring 포함)
  - 월별 캘린더 heatmap (완료=sage / 부분=sage-light / 빈=neutral)
  - Flame streak 아이콘 + 큰 숫자 표시
  - Pull-to-refresh + 완료 시 confetti (이미 `useConfetti` 있음)
  - 하단 nav = Calm 패턴 (4-5 탭 + 큰 중앙 추가 버튼)
- **모션**: spring (cubic-bezier(0.34, 1.56, 0.64, 1)) — 완료 시 살짝 bounce
- **장점**: 매일 습관 형성 메시지 강함. 카드 1개 중심으로 인지부하 낮음.
- **위험**: 성경 본문 reading 경험은 매너 1보다 약함. `/bible` 등 reader 페이지가 어울리지 않을 수 있음.

### 매너 3 — **"Sacred Minimal"** (Brand-driven, Hallow/Dipsea-aligned)

```
영감: Hallow + Dipsea + doji + minimal-gallery + Apple Journal
타깃 페이지: /login (브랜드 첫인상) + /, /intro
```

- **컬러**: 라이트 = pure white + sage `#4B9F7E` + 깊은 olive `#2D4A3A` (text contrast) / 다크 = `#0E1614` (deep forest)
- **타이포**: UI = Pretendard 15-16px / 디스플레이 = KoPub Batang Light **48-80px** (oversized hero) + 한국어 자간 -3%
- **레이아웃**: 풀스크린 hero 우선 + 큰 여백 + 1 column 중심. 카드 그림자 거의 없음 (1px border only).
- **컴포넌트 특징**:
  - Hero typography 임팩트 (한 줄 메시지 + 작은 sub-copy)
  - 브랜드 verse + scripture inline (KoPub Batang Light)
  - OAuth 버튼은 outline-only 미니멀 (현재의 컬러 fill 제거)
  - 모달 = full-screen sheet (모바일) / centered drawer (데스크톱)
  - 아이콘 = thin stroke (Heroicons Outline 또는 Lucide thin)
- **모션**: 최소 (Apple 스타일 — content first)
- **장점**: 브랜드 정체성 강력. "신성한 미니멀" — 매일일독의 영적 톤과 부합.
- **위험**: 기능 dense 한 `/bible/settings`, `/catchup`, `/friends` 등에서 비효율적. 정보 밀도가 낮아 스크롤 폭증 가능.

### 매너 4 — **"Hybrid"** (Page-별 매너 차등 적용)

```
영감: 위 1+2+3 의 page-by-page 조합
적용:
  - /login, /, /intro → 매너 3 Sacred Minimal (브랜드)
  - /bible (성경 본문) → 매너 1 Devotional Modern
  - /, /plan, /catchup, /scoreboard → 매너 2 Quiet Discipline
  - /bible/{settings,history,notes,highlights} → 매너 1 + 매너 2 합성
  - /friends, /groups, /profile → 매너 2 + 매너 5(Notion-style) 합성
```

- **컬러**: 공통 sage `#4B9F7E` + cream `#faf8f6` 유지. 다크 모드 페이지별 분리 (`#0F0E0C` reading dark, `#1A1815` warm dark, `#0E1614` brand dark).
- **타이포**: 페이지별 분기. 본문 = KoPub Batang, UI = Pretendard 공통.
- **레이아웃 표준**:
  - 페이지 max-w 토큰 3종: `prose` (65ch reading), `app` (640px content), `wide` (1024px dashboards)
  - 모바일 하단 nav 표준화 (5 탭 — Home / Plan / Bible / Catchup / Profile)
  - 데스크톱 사이드바 또는 상단 nav (Linear 패턴) — 1024px 이상에서만
- **컴포넌트 특징**:
  - atom 19개 모두 매너 1 기준으로 재디자인 (가장 strict)
  - 페이지 헤더 atom (`PageHeader`)에 `variant` prop 추가: `'reading' | 'discipline' | 'sacred' | 'default'`
  - 모달 ssot 통합 (현재 useModal + atom Modal 일관화)
- **장점**: 페이지의 용도에 맞춘 정밀한 매너 적용. 35 page 모두 적합.
- **위험**: **가장 큰 구현 비용**. atom 차등 variant 필요. design tokens 다층화. 디자인 일관성 관리 어려움. 사용자가 페이지 이동 시 다른 정체성 인식 가능.

---

## §4 매너 비교 매트릭스

| 차원 | 매너 1 Devotional Modern | 매너 2 Quiet Discipline | 매너 3 Sacred Minimal | 매너 4 Hybrid |
|---|---|---|---|---|
| 성경 본문 reading 경험 | 🟢 최상 | 🟡 중 | 🟡 중 | 🟢 최상 (매너 1) |
| 매일 습관 형성 메시지 | 🟡 약 | 🟢 최상 | 🟡 약 | 🟢 최상 (매너 2) |
| 브랜드 첫인상 (login/) | 🟡 중 | 🟡 중 | 🟢 최상 | 🟢 최상 (매너 3) |
| 기능 dense 페이지 (settings) | 🟢 양호 | 🟢 양호 | 🔴 비효율 | 🟢 양호 |
| Social/social 페이지 (friends) | 🟡 중 | 🟢 양호 | 🟡 중 | 🟢 양호 |
| 다크모드 지원 | 🟢 양호 | 🟢 양호 | 🟢 양호 | 🟢 양호 |
| 한국 타이포 활용도 | 🟢 최상 (KoPub 본문) | 🟡 중 | 🟢 최상 (oversized) | 🟢 최상 |
| Storybook 시각화 비용 | 1-2 hr | 1-2 hr | 1-2 hr | **2-4 hr** (3종 variant) |
| 19 atom 재디자인 비용 | 4-6 hr | 4-6 hr | 4-6 hr | **8-12 hr** |
| 35 page 빅뱅 재구현 비용 | 30-40 hr | 30-40 hr | 30-40 hr | **40-60 hr** |
| 디자인 일관성 위험 | 낮음 | 낮음 | 낮음 | **높음** (page-별 variant 관리) |

---

## §5 evidence 보존

본 §1-2 의 vision 캡션 + similarity 점수 raw 데이터는 lazyweb API 응답 그대로 [.sisyphus/evidence/next-fe-audit/references/](file:///Users/jgp/GitHub/maeil1dok/.sisyphus/evidence/next-fe-audit/references/) 에 저장하지 않음 (data:URL token expires in 1 hour 이므로 이미지 자체는 lazyweb backend 에 의존). 본 보고서 §1.2 의 핵심 패턴 추출이 evidence 역할.

**다운로드 필요 시**: 매너 결정 후 해당 카테고리 top 5장씩 다운로드하여 본 evidence 디렉토리 보존 가능.

---

## §6 사용자 결정 요청

다음 결정 4종 필요:

1. **매너 선택**: 1 / 2 / 3 / 4 (또는 합성 다른 안)
2. **Storybook 시각화 우선순위**: atom 19개 중 어디부터 (예: Button + Card + PageHeader + Modal 4종 먼저 vs 전체 일괄)
3. **다크모드 default**: 라이트 우선 / 다크 우선 / 사용자 OS 추종
4. **다음 세션 분리 여부**: 본 세션에서 atom 시각화까지 / 별도 새 세션
