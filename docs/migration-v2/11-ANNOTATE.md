# 11-ANNOTATE · 북마크 / 하이라이트 / 노트

> **슬라이스 ID**: 11-ANNOTATE · **Wave**: 3 · **의존**: 11-FOUND, 11-MIGRATE, 11-READER · **크기**: M

## 1. 목표
Plan F 는 **데이터만 마이그레이션하고 UI는 제외**했다. v2 는 UI를 완성해 사용자가 자신의 북마크/하이라이트/노트를 라이브에서 본다. 라이브 BUG-005 ("Task 3-3에서 구현 예정") 해소.

## 2. 자산
- Nuxt: [/bible/bookmarks](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/bible/bookmarks.vue) 262, [/bible/highlights](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/bible/highlights/index.vue) 336, [/bible/notes](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/bible/notes/index.vue) 236, `/bible/notes/[id]` 398
- Django: `/api/v1/todos/bible/bookmarks/*`, `notes/*`, `highlights/*`, `personal-records/*`
- 모델: `BibleBookmark`, `BibleHighlight`, `ReflectionNote`, `PersonalReadingRecord`
- Supabase: 20260301000001_plan_f_new_tables.sql 에 신규 3 테이블 + RLS 완비

## 3. 작업
| # | 작업 | DoD |
|---|---|---|
| AN-1 | 본문에서 구절 선택 → 메뉴 → 북마크 추가 | 11-READER 와 협업 |
| AN-2 | 북마크 목록 페이지 — `/bible/bookmarks` | e2e + RLS |
| AN-3 | 하이라이트 색상 선택 + 적용 (5색) | 본문 텍스트에 색 반영 |
| AN-4 | 하이라이트 목록 — `/bible/highlights` (BUG-005 placeholder 제거 의무) | placeholder grep 0 |
| AN-5 | 노트 작성 — 제목/내용/공개여부 | CRUD |
| AN-6 | 노트 목록 + 상세 | e2e |
| AN-7 | 일괄 삭제 (`bookmarks/delete-all/` 등) | 확인 모달 |
| AN-8 | 마이그레이션: 3 신규 테이블 데이터 row count 일치 | 5% hard fail |
| AN-9 | BibleHighlight.memo 처리 — Plan F 는 제외, v2 결정 (MD-3) | 결정 + 구현 |

## 4. 결정
- AND-1 (= MD-3): memo 제외 / 포함
- AND-2: 하이라이트 색상 토큰 — 직전 디자인과 일관성

## 5. DoD
- EVIDENCE: 4 도메인 × CRUD × RLS 위반 시도 = 16 e2e + placeholder grep 0
- ASSERTION: "구현 예정" 텍스트 production build 에 0 hits
