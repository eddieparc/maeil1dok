## 슬라이스 / 작업
**슬라이스**: `slice:ANNOTATE`  
**플랜**: docs/migration-v2/11-ANNOTATE.md  
**작업 ID**: `AN-4`

## 작업 내용
하이라이트 목록 — `/bible/highlights` (BUG-005 placeholder 제거 의무 + **BUG-006 회귀 방지 의무**)

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/ANNOTATE-AN-4.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — placeholder grep 0 + **로그인 후 페이지 렌더 검증 (`TypeError: Cannot read properties of null (reading 'id')` JS 크래시 차단 — 04-production-live-audit.md L-8 신 발견)** + e2e: 로그인 사용자가 highlights 페이지 진입 시 빈 페이지 ❌ / 정상 컨테이너 ✅ (snapshot ≥ 3 줄 + main heading 존재)

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
