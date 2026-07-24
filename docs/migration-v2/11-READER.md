# 11-READER · 성경 본문 뷰어

> **슬라이스 ID**: 11-READER  
> **Wave**: 3 (병렬)  
> **의존**: 11-FOUND, 11-MIGRATE  
> **추정 크기**: L  
> **상태**: 스켈레톤

---

## 1. 목표

`/bible` 라우트에서 성경 본문이 **실제로 표시되고**, **URL 파라미터가 깨지지 않으며**, **역본/북마크/노트/하이라이트가 작동**하는 상태를 달성. Plan F 시기 라이브의 BUG-001 (본문 미표시), BUG-004 (URL undefined)이 v2 에선 회귀 금지.

---

## 2. 기존 자산

### 2.1 Nuxt 측 (01 §1 + §2)

| 항목 | 파일 | 라인 수 | 비고 |
|---|---|---|---|
| 라우트 | [pages/bible/index.vue](../../frontend/app/pages/bible/index.vue) | 1198 | 모놀리식 |
| 보관본 | `pages/reading-archived.vue` | 7224 | 폐기 결정 필요 |
| 보관본2 | `pages/index-archived.vue` | 2383 | 폐기 결정 필요 |
| 설정 | [pages/bible/settings.vue](../../frontend/app/pages/bible/settings.vue) | 1338 | |
| 컴포저블 (parsers) | composables/bible/* | 832+ | 표준/KNT/GAE 등 역본별 파서 |

### 2.2 Next 측 (02 §3 — verify 필요, 정밀화 단계에서 file:line 확정)

- `src/app/(authenticated)/bible/` 라우트들 (settings, /bible 본체)
- `src/components/bible/BibleReaderView.tsx`, `BibleReaderHeader.tsx`, `BookSelector.tsx`
- `src/lib/bible/parsers/standardParser.ts` 외 파서들
- iframe 기반 본문 렌더링 (`buildInteractiveSrcDoc.ts`)
- TS 에러 1건 잔존 — `BibleSettingsContent.tsx` (02 §8)
- 02의 5월 WIP 변경이 BookSelector·BibleReaderHeader·CSS 등에 영향

### 2.3 외부 의존

- `/api/bible-proxy/` Next API — Django 의 BibleContentCache 또는 외부 소스 프록시
- Django 측 엔드포인트 (`bible_cache.urls`)

---

## 3. Plan F 시기 검증된 위험

| 위험 | 증거 | v2 처리 |
|---|---|---|
| 본문 미표시 (라이브 BUG-001) | docs/bible-renewal-qa-report.md | 컷오버 전 본문 렌더링 e2e 의무 |
| URL `chapter=undefined` (BUG-004) | 같은 보고서 | URL state 단방향 테스트 (책 선택 → URL 정상) |
| iframe `text/css` MIME 에러 | 과거 감사 T0004 | iframe src/style 검증 |
| 본문 영역 깨진 이미지 | BUG-002 (`btn_listen.png` 404) | 정적 자산 누락 검증 + grep |
| /bible/highlights 의 "Task 3-3에서 구현 예정" | BUG-005 | placeholder grep CI (00-meta §2.6) |

---

## 4. 작업 항목

### 4.1 URL → State → Render 단방향

| # | 작업 | DoD |
|---|---|---|
| R-1 | URL 파라미터 schema 정의 — `?book=jhn&chapter=3&version=GAE` (Zod) | schema 파일 + 잘못된 입력 → 기본값 fallback |
| R-2 | 책/장 선택 → URL push (replace) → state | playwright: 선택 시 URL 정상 (BUG-004 회귀 0) |
| R-3 | URL → fetch (시퀀스 일관) | 동일 URL 진입 시 동일 본문 |
| R-4 | 다음/이전 장 네비 | 양 끝 (창세기 1장 ← / 요한계시록 22장 →) 처리 명시 |

### 4.2 본문 렌더링 (BUG-001 재발 금지)

| # | 작업 | DoD |
|---|---|---|
| R-5 | bible-proxy 응답 schema 검증 + 정상/주석 분리 | 창세기 1:1 본문 텍스트 (e2e) "태초에 하나님이 천지를 창조하시니라" 등장 |
| R-6 | 파서 통합 — 표준/KNT/GAE 분기 검증 | 4개 역본 × 3개 책 = 12 케이스 e2e |
| R-7 | iframe 렌더링 모드 — 폰트, MIME 정상 | iframe console 에 MIME error 0 |
| R-8 | 절 번호 표시 / 단락 / 각주 | 시각 회귀 (VRT) 통과 |

### 4.3 인터랙션 (북마크/노트/하이라이트 슬라이스 11-ANNOTATE 와 협업)

| # | 작업 | DoD |
|---|---|---|
| R-9 | 구절 선택 → 메뉴 (북마크/노트/하이라이트) — UI 만 (실 동작은 11-ANNOTATE) | UI 동작 |
| R-10 | 오디오 듣기 버튼 (`btn_listen.png` 누락 해결) | 자산 존재 + 클릭 동작 |
| R-11 | 폰트/테마 설정 즉시 반영 | 설정 변경 시 본문 < 100ms 재렌더 |

### 4.4 데스크탑 vs 모바일

| # | 작업 | DoD |
|---|---|---|
| R-12 | 모바일 (375px) 본문 가독성 | VRT pass + a11y color contrast pass |
| R-13 | 데스크탑 (1280px) max-width 적용 | VRT pass |

### 4.5 보관본 처리

| # | 작업 | DoD |
|---|---|---|
| R-14 | `reading-archived.vue` (7224) / `index-archived.vue` (2383) — Nuxt 측 폐기 결정 | 사용자 결정 후 삭제 또는 동결 |
| R-15 | Nuxt의 1198 라인 모놀리식 → Next는 화면-단위 분리 (header/reader/sidebar/menu) | 컴포넌트 분리 + 각 파일 ≤ 300 라인 |

---

## 5. 결정 사항

| 결정 | 옵션 |
|---|---|
| RD-1 | Nuxt의 `reading-archived.vue` 7224 라인 — 폐기 / 일부 기능 이전 |
| RD-2 | iframe 렌더링 유지 / 직접 SSR / 클라이언트 컴포넌트 |
| RD-3 | 오디오 재생 방식 — 외부 링크 / 내장 player / TTS |
| RD-4 | 역본 비교 뷰 (두 역본 나란히) — v2 포함 / 백로그 |

---

## 6. DoD 통합

- **CHANGE**: src/app/(authenticated)/bible/, src/components/bible/, src/lib/bible/
- **EVIDENCE**: 
  - playwright e2e 트레이스 (12 케이스 본문 + URL + 인터랙션)
  - VRT light + dark, mobile + desktop
- **REPRODUCE**: `npx playwright test tests/e2e/bible/`
- **ASSERTION**:
  - 본문 텍스트 등장: 12/12 케이스
  - URL undefined 회귀: 0건
  - iframe console error: 0
  - placeholder grep: 0 hits
  - VRT diff: 0 px

<!-- plan-checksum: PENDING -->
