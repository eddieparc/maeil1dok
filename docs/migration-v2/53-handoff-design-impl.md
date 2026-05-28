# 53 · Handoff — Refined v3.1 디자인 실 구현 (Design Implementation)

> **작성일**: 2026-05-28
> **선행 핸드오프**: [52-handoff-next-fe-audit.md](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/52-handoff-next-fe-audit.md) (감사 PARTIAL) → 디자인 매너 4종 거절 → **Refined v1 → v2 → v3 → v3.1 사용자 확정**
> **본 세션 종료 시점**: v3.1 시안 사용자 OK
> **다음 세션 목적**: v3.1 시안을 19 atom + 35 page 실 코드에 구현 (Wave 0 동반 fix 빅뱅)

---

## §0 한 줄 요약

> Storybook `Design/Refined v1 — Mono Cocoa` 8 stories 가 **단일 진실 공급원 (SSOT)**.
> 컬러 토큰 29개 + 타이포 스케일 14개 + 라운드 토큰 8개 + 컴포넌트 5종 (`Btn` `Badge` `Alert` `Icon` `Logo`) + Lucide 26 아이콘이 확정되어 있다.
> 다음 세션은 **이 시안을 코드 atom 19개 + 페이지 35개로 옮기는 작업**이며, 동시에 build FAIL / TS 5 / vitest 46 (28-* 감사 확인) 도 동반 fix.

---

## §1 v3.1 디자인 시안 위치 (SSOT)

### §1.1 코드

[`maeil1dok-next/src/stories/design-manners/Refined.stories.tsx`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/stories/design-manners/Refined.stories.tsx) — 1100+ 라인 단일 파일

- 토큰 정의 (color / typography / radius)
- 5 컴포넌트 (`Btn` `Badge` `Alert` `Icon` `Logo` `TopNav` `Frame` `ReaderHeader/Body/Footer`)
- 8 stories (`Login` `Home` `BibleReader` `BibleReaderDark` `Plan` `Friends` `Atoms` `Tokens`)

### §1.2 Storybook 시각 SSOT

```bash
cd maeil1dok-next
npx storybook dev -p 6007 --no-open
# http://localhost:6007/?path=/story/design-refined-v1-mono-cocoa--home
```

> 본 세션 종료 시점에 `tmux session "storybook"` 으로 실행 중. 다음 세션은 재기동 또는 기존 사용.

### §1.3 v1 → v2 → v3 → v3.1 변경 history

| 버전 | 변경 |
|---|---|
| v1 | 초안 — Pretendard 전역 + 흑백+갈색 + Lucide |
| v2 | 시각 피로 감소 — 텍스트·버튼·패딩 축소 + **serif 복귀** (KoPub Batang hero·verse) |
| v3 | 라운드 +2-6px + 배지 pill + 시맨틱 컬러 4종 + Alert 컴포넌트 |
| **v3.1** | Border 통일 — Alert + brand_faint 카드에 muted border 추가 |

---

## §2 컬러 토큰 (총 29개)

### §2.1 기본 컬러 (12개)

| 토큰 | hex | 용도 |
|---|---|---|
| `ink` | `#0A0A0A` | 본문 + primary CTA |
| `paper` | `#FFFFFF` | 카드 배경 |
| `paper-warm` | `#FAFAF9` | 페이지 배경 |
| `brand` | `#5C3A2E` | 상징 색 (warm cocoa) — 유일한 brand 강조 |
| `brand-deep` | `#3D2817` | espresso (강조) |
| `brand-faint` | `#F4EFEA` | 5% tint (오늘 표시 / 하이라이트 / "나" 행 / 하세나 카드) |
| `brand-faint-border` | `#E5DED2` | brand-faint 배경 카드용 border (v3.1 신규) |
| `rule` | `#E8E5E0` | hairline divider |
| `mute` | `#6F6B66` | 보조 텍스트 |
| `subtle` | `#A39E97` | 3차 텍스트 / placeholder |
| `dark-bg` | `#141210` | 다크 모드 배경 |
| `dark-ink` | `#FAFAF9` | 다크 모드 텍스트 |
| `dark-rule` | `#2A2622` | 다크 모드 hairline |
| `dark-mute` | `#9B968F` | 다크 모드 보조 |

### §2.2 시맨틱 컬러 (4종 × 4 = 16개) — v3 추가

| 토큰 | hex | 용도 |
|---|---|---|
| `success` | `#3D6B4F` | forest green muted — 완료 |
| `success-bg` | `#ECF2EE` | Alert 배경 |
| `success-text` | `#1F3A2A` | Alert 텍스트 |
| `success-border` | `#D4DFD8` | Alert border (v3.1) |
| `warning` | `#A87C3D` | ochre — brown 톤 조화, 밀린 통독 |
| `warning-bg` | `#F7EFE0` | |
| `warning-text` | `#5C401C` | |
| `warning-border` | `#E8D8B8` | (v3.1) |
| `danger` | `#A8483E` | brick muted — 오류 / 중단 / 삭제 |
| `danger-bg` | `#F4E5E3` | |
| `danger-text` | `#5C1F18` | |
| `danger-border` | `#E5C9C4` | (v3.1) |
| `info` | `#4A6B8A` | slate blue muted — 공지 / 업데이트 |
| `info-bg` | `#E8EDF2` | |
| `info-text` | `#1F344D` | |
| `info-border` | `#CDD7E1` | (v3.1) |

### §2.3 globals.css 마이그레이션

현재 [`maeil1dok-next/src/app/globals.css`](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/app/globals.css) 의 `@theme` 토큰 (sage `#4B9F7E` primary + cream `#faf8f6` 등) **전체 교체 의무**. 본 §2.1 + §2.2 의 29개로 갱신.

---

## §3 타이포 토큰

### §3.1 폰트 패밀리

```css
--font-family-ui:      'Pretendard', 'Noto Sans KR', sans-serif
--font-family-serif:   'KoPub Batang', 'Noto Serif KR', 'RIDIBatang', serif
```

> 현 globals.css 의 `--font-family-reading` 은 KoPub Batang 으로 이미 정의됨 — 재활용 가능. 단 변수명 `serif` 로 통일 권장.

### §3.2 Sans (Pretendard) 스케일 — 9종

| 토큰 | size | weight | line-height | letter-spacing | 용도 |
|---|---|---|---|---|---|
| `display-l` | 32px | 600 | 1.2 | -0.03em | 페이지 dashboard 타이틀 |
| `display-m` | 24px | 600 | 1.25 | -0.025em | 작은 타이틀 |
| `h1` | 18px | 600 | 1.3 | -0.02em | 섹션 헤더 |
| `h2` | 15px | 600 | 1.35 | -0.018em | 카드 sub 헤더 |
| `body-l` | 15px | 500 | 1.6 | -0.012em | 본문 |
| `body` | 14px | 500 | 1.5 | -0.01em | 본문 작음 |
| `body-s` | 13px | 500 | 1.5 | -0.008em | 보조 |
| `caption` | 12px | 500 | 1.4 | -0.005em | 라벨 |
| `micro` | 11px | 500 | 1.4 | 0 | 메타 |
| `num-l` | 26px | 600 | 1.0 | -0.025em + tabular-nums | 큰 숫자 |
| `num-m` | 17px | 600 | 1.0 | -0.02em + tabular-nums | 중 숫자 |

### §3.3 Serif (KoPub Batang) 스케일 — 6종

| 토큰 | size | weight | line-height | letter-spacing | 용도 |
|---|---|---|---|---|---|
| `hero-xl` | 44px | 500 | 1.15 | -0.04em | Login hero |
| `hero-l` | 30px | 500 | 1.2 | -0.03em | 홈 greeting / 페이지 타이틀 |
| `hero-m` | 22px | 500 | 1.3 | -0.025em | 카드 메인 타이틀 (창세기 1-3장) |
| `hero-s` | 17px | 500 | 1.35 | -0.02em | 작은 카드 타이틀 |
| `verse` | 17px | 400 | 1.95 | -0.005em | 성경 본문 reading |
| `verse-s` | 14px | 500 | 1.6 | -0.005em | 인용구 / italic |

### §3.4 폰트 매핑 룰 (어디에 어느 폰트?)

| 영역 | 폰트 |
|---|---|
| 로고 ("매일일독") | **Serif** |
| Login / Intro hero | **Serif** (hero-xl) |
| 페이지 타이틀 ("통독 진행", "리더보드") | **Serif** (hero-l) |
| 홈 greeting ("정주현 님, 오늘도 함께 걸어요") | **Serif** (hero-l) |
| 카드 메인 타이틀 (책장 이름, 통독 분량) | **Serif** (hero-m) |
| 작은 카드 타이틀 (하세나, 그룹) | **Serif** (hero-s) |
| **성경 본문 verse** | **Serif** (verse) |
| 인용 / 메시지 / italic 표현 | **Serif** (verse-s) |
| Navigation, 메뉴 | Sans |
| 사람 이름 ("정주현", "김민서") | Sans |
| 숫자 / 데이터 (47%, 12일, 178/379) | Sans (tabular-nums) |
| 버튼 텍스트 | Sans |
| 라벨 / placeholder / 인풋 | Sans |
| 배지 / 태그 / 알림 본문 | Sans |
| 시간 / 날짜 / 메타 | Sans |

---

## §4 라운드 토큰 (8개, v3 +2-6px)

| 토큰 | px | 용도 |
|---|---|---|
| `sm` | 8 | small elements / icon button frames |
| `md` | 12 | 인풋 / select / textarea |
| `lg` | 16 | **카드 / 섹션 (가장 자주)** |
| `xl` | 20 | 큰 섹션 / 강조 카드 |
| `modal` | 24 | 모달 / sheet / drawer |
| `cell` | 8 | 캘린더 셀 / 작은 그리드 |
| `pill` | 999 | **버튼 / 배지 (모든 배지)** |
| `circle` | 50% | 아바타 / 상태 dot |

---

## §5 컴포넌트 인벤토리 + atom 매핑

### §5.1 v3.1 컴포넌트 (총 7종, Refined.stories.tsx 내부)

| 컴포넌트 | variant | size | 대응 atom |
|---|---|---|---|
| **`Btn`** | primary / secondary / outline / ghost | sm / md / lg | [Button.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Button.tsx) |
| **`Badge`** | default / solid / brand / success / warning / danger / info / outline | (size 1) | [Badge.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Badge.tsx) |
| **`Alert`** | success / warning / danger / info | (size 1) | 신규 atom 또는 [Toast.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Toast.tsx) 확장 |
| **`Icon`** | Lucide 26종 inline SVG | 11-22 dynamic | 신규 atom — `lucide-react` 설치 권장 |
| **`Logo`** | - | size prop | 신규 atom |
| **`TopNav`** | active prop | - | [Header.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/layout/Header.tsx) 또는 [HeaderClient.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/layout/HeaderClient.tsx) 갱신 |
| **`Frame`** | bg / dark prop | - | [Container.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Container.tsx) 재작성 |

### §5.2 19 atom 재디자인 매핑

| atom 파일 | v3.1 대응 | 작업 |
|---|---|---|
| [Avatar.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Avatar.tsx) | Friends 페이지의 `<div circle>` 패턴 | `R.circle` + `paper-warm` bg + `rule` border |
| [Badge.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Badge.tsx) | `Badge` 컴포넌트 (8 variant) | **pill 통일** |
| [Button.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Button.tsx) | `Btn` (4 variant × 3 size) | **pill 통일** |
| [Card.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Card.tsx) | 모든 카드 패턴 (paper + rule + R.lg) | base 카드 + `variant="faint"` for brand-faint 배경 |
| [Container.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Container.tsx) | `Frame` | bg / max-w / padding prop |
| [EmptyState.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/EmptyState.tsx) | (시안 미정 — 빈 상태 카드) | icon + serif title + sans description + CTA |
| [Input.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Input.tsx) | Atoms 페이지 인풋 | `R.md` (12px) + focused border `ink` |
| [Modal.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Modal.tsx) | (시안 미정) | `R.modal` (24px) + overlay + paper bg |
| [modal/AlertModal.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/modal/AlertModal.tsx) | `Alert` 컴포넌트 패턴 (시맨틱 4 톤) | 시맨틱 컬러 매핑 |
| [modal/ConfirmModal.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/modal/ConfirmModal.tsx) | (시안 미정) | primary Btn (ink) + ghost Btn (cancel) |
| [modal/ModalHost.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/modal/ModalHost.tsx) | 기존 유지 | useModal SSOT 보존 |
| [PageHeader.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/PageHeader.tsx) | `<h1 ...S.heroL>` 페이지 타이틀 | serif (hero-l) + back button + optional badge |
| [ProgressBar.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/ProgressBar.tsx) | Home 카드 내부 `height: 4 + R.pill` | percent prop + variant (primary/brand) |
| [Select.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Select.tsx) | (시안 미정) | R.md (12px) + chevron-down icon |
| [Skeleton.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Skeleton.tsx) | (시안 미정) | rule bg + animate-pulse |
| [Tabs.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Tabs.tsx) | Friends 페이지 "이번 주/이번 달/전체" 토글 | pill segment + active=ink bg |
| [Textarea.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Textarea.tsx) | (시안 미정) | Input과 동일 룰 |
| [ThemeToggle.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/ThemeToggle.tsx) | (시안 미정) | sun/moon icon toggle |
| [Toast.tsx](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/components/ui/Toast.tsx) | Alert 컴포넌트와 유사 | 시맨틱 4 톤 + auto-dismiss + portal |

---

## §6 Lucide 아이콘 26종 (v3.1 사용 목록)

```
check / check-circle / flame / chevron-right / chevron-left
arrow-right / arrow-up-right / bookmark / highlighter / calendar
settings / user / users / book-open / play / pause
more-horizontal / mail / lock / eye-off / sparkles / crown
circle-dashed / pen-line / info / triangle-alert / x-circle
```

### §6.1 lucide-react 설치 권장

```bash
cd maeil1dok-next
npm install lucide-react
```

장점:
- inline SVG path (현 Refined.stories.tsx) 대비 코드 정돈
- Tree-shaking 으로 번들 영향 최소
- icon name typo 컴파일 시점 검출
- 공식 출시 신규 아이콘 자동 사용 가능

대안: 직접 inline SVG 유지 (현 stories 방식) — atom 19개 통합 시 일관 패턴 유지 가능

**다음 세션 사전 결정**: `lucide-react` 설치 vs inline SVG 유지

---

## §7 35 페이지 빅뱅 구현 우선순위

### §7.1 Phase 1 — Foundation (Wave 0 동반 fix)

**견적**: 7.5~8 hour (28-* §7 참조)

1. F-4 TS 5건 fix (BibleSettingsContent / FontSection / PlanPageClient / ModalRegistry x2)
2. F-5 build green + NEXT-BUG-A (`TongdokModeProvider` undefined) 해결
3. F-6 vitest 46 fail → 0 (zustand v5 SSR + token-coverage + HydrationGate)
4. NEXT-BUG-C `/api/bible/personal-records/{stats,dates}` 2종 신규 구현
5. BUG-003 hydration mismatch root cause fix
6. globals.css 토큰 마이그레이션 (sage → cocoa)
7. Pretendard + KoPub Batang 폰트 로딩 검증 (현 jsdelivr CDN — 대체 또는 self-host 검토)
8. `lucide-react` 설치 결정

### §7.2 Phase 2 — Atom 재디자인 (19개)

**견적**: 4~6 hour

- §5.2 매핑표에 따라 atom 19개 모두 v3.1 토큰/패턴 적용
- Storybook stories 19 atom × 평균 3 variant = 약 60 story 추가 작성
- 각 atom diagnostics clean + 기존 사용처 호환성 검증

### §7.3 Phase 3 — 페이지 빅뱅 재구현 (35개)

**견적**: 30~40 hour

페이지 그룹별 우선순위:

| 우선순위 | 영역 | 대상 |
|---|---|---|
| P0 | Brand 첫인상 | /login (Refined Login) |
| P0 | 핵심 reading | /bible (Bible Reader Light/Dark/Sepia) |
| P0 | 홈 | / (Refined Home) |
| P1 | 통독 진행 | /plan, /catchup |
| P1 | 부속 reading | /bible/{home,bookmarks,highlights,history,notes,notes/[id],settings} |
| P2 | Social | /friends, /groups, /groups/[id], /profile/[id] |
| P2 | 보조 | /scoreboard, /settings, /hasena, /intro, /calendar, /reading, /plans |
| P3 | Public | /company, /maintenance, /not-found, /notice, /privacy, /support, /terms, /register-email, /auth/{forgot,reset,verify} |

### §7.4 Phase 4 — QA 라이브 검증

**견적**: 2~3 hour

- 28-* 감사와 동일 protocol — Playwright 35 page walk (사용자 본인 로그인)
- 35 page × 라이트/다크 × 모바일/데스크탑 = 시각 회귀 검증
- 콘솔 에러 0, 네트워크 4xx/5xx 0 보장

**Phase 1-4 합계 견적**: **44 ~ 57 hour**

---

## §8 사전 결정 사항 (다음 세션 진입 시 확인)

| # | 결정 | 옵션 / 권장 |
|---|---|---|
| 1 | `lucide-react` 설치 vs inline SVG | npm install (권장) |
| 2 | Pretendard/KoPub Batang 로딩 방식 | 현 jsdelivr CDN 유지 / self-host / Google Fonts |
| 3 | 다크모드 default | 라이트 우선 + ThemeToggle (v3 디자인 시 이미 결정) |
| 4 | Wave 0 동반 fix 시점 | atom 작업 전 / 후 / 병행 |
| 5 | 4 매너 archive (v1/v2/v3 Refined.stories.tsx history) | 보존 / 삭제 |
| 6 | atom 작업 + page 작업 세션 분리 | 단일 / atom + page 분리 |
| 7 | globals.css `@theme` 직접 수정 vs 별도 tokens 파일 | 직접 수정 (Tailwind v4) |

---

## §9 다음 세션 Trigger Prompt

```
매일일독 Next.js 디자인 실 구현 진행.

핸드오프 문서: /Users/jgp/GitHub/maeil1dok/docs/migration-v2/53-handoff-design-impl.md

이 파일을 먼저 Read 한 뒤, §7 Phase 1 → 2 → 3 → 4 순서로 진행:

Phase 1: Wave 0 동반 fix (TS 5 + build + vitest + missing APIs + hydration + globals.css 토큰 + 폰트 + lucide)
Phase 2: 19 atom 재디자인 (v3.1 토큰/패턴 적용, Storybook stories 작성)
Phase 3: 35 page 빅뱅 재구현 (Refined Home/Bible/Login 패턴 차용)
Phase 4: Playwright 라이브 35 page 검증 (사용자 본인 로그인)

SSOT:
- 디자인 시안: maeil1dok-next/src/stories/design-manners/Refined.stories.tsx (Storybook port 6007)
- 토큰: 본 핸드오프 §2 (컬러 29) + §3 (타이포 14) + §4 (라운드 8)
- 폰트 매핑: §3.4
- atom 매핑: §5.2
- 사전 결정: §8

규칙:
- 본 시안 외 디자인 의사결정 시 사용자 컨펌
- TS escape (as any / @ts-ignore) 금지
- console.log production 금지
- placeholder ("구현 예정" / "Task X-Y") 금지
- 모든 atom diagnostics clean 의무
- Wave 0 작업 후 build/vitest 모두 green
- Phase 4 Playwright walk 결과 보고서 작성 의무

PRE 결정 (재논의 금지):
- v3.1 디자인 시안은 사용자 OK (2026-05-28)
- 컬러 / 타이포 / 라운드 토큰은 본 핸드오프 §2-4 확정
- 폰트 매핑 룰 §3.4 확정
- Wave 0 + atom + page = 동일 세션 빅뱅 (사용자 결정)

진행 시작.
```

---

## §10 본 세션 산출물 트리 (최종)

```
docs/migration-v2/
├── 28-next-fe-completion-report.md         감사 verdict PARTIAL
├── 29-design-references-analysis.md        80장 lazyweb 분석
└── 53-handoff-design-impl.md               본 문서

maeil1dok-next/
├── .storybook/
│   ├── main.ts                             Storybook 9 config
│   └── preview.tsx                         globals.css import + storySort
├── src/stories/design-manners/
│   └── Refined.stories.tsx                 v3.1 단일 매너 (1100+ lines, 8 stories)
└── package.json                            +storybook ^10.4.1 +addons +chromatic

.sisyphus/evidence/next-fe-audit/
├── *.log                                   build/tsc/lint/vitest 4개
├── walks/                                  public + authenticated walk JSON
└── screenshots/                            70+ PNG (audit 47 + v1 7 + v2 8 + v3 5 + v3.1 2)
```

---

## §11 신뢰성 + 자가 메타-감사

| 단정 | 신뢰도 |
|---|---|
| v3.1 시안 사용자 OK | 🟢 사용자 메시지 "전반적으로 디자인 괜찮은 것 같아" (2026-05-28) |
| 컬러 토큰 29개 | 🟢 본 핸드오프 §2 enumeration |
| 타이포 14종 (Serif 6 + Sans 9 — num 2 포함) | 🟢 §3 |
| 라운드 8종 | 🟢 §4 |
| Lucide 26 아이콘 | 🟢 §6 (Refined.stories.tsx PATHS 객체) |
| Wave 0 견적 7.5~8 hr | 🟡 28-* §7 추정 (실 작업 ±20% 변동 가능) |
| 페이지 빅뱅 30~40 hr | 🟡 추정 (page 평균 ~1 hr 가정) |
| 19 atom 매핑 | 🟡 일부 (Modal / Select / Textarea / Skeleton / ThemeToggle) **시안 미작성** — 다음 세션에서 결정 |

> 🟡 시안 미작성 atom 5종은 §5.2 에 명시. 다음 세션 atom 재디자인 시 추가 시안 작성 또는 v3.1 토큰만 적용하고 패턴은 inferred.

---

<!-- handoff-version: 1 -->
<!-- handoff-date: 2026-05-28 -->
<!-- ssot: maeil1dok-next/src/stories/design-manners/Refined.stories.tsx -->
<!-- design-version: Refined v3.1 -->
