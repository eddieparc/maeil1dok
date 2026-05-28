## 슬라이스 / 작업
**슬라이스**: `slice:ADMIN`  
**플랜**: docs/migration-v2/11-ADMIN.md  
**작업 ID**: `AD-3`

## 작업 내용
하세나 요약 생성/재생성 — Gemini API 호출 (Vercel Edge function)

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/ADMIN-AD-3.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — UI + API 동작 (없으면 컷오버 후 신규 요약 차단 — CORE)

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
