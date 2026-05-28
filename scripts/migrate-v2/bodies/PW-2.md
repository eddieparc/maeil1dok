## 슬라이스 / 작업
**슬라이스**: `slice:PWA`  
**플랜**: docs/migration-v2/11-PWA.md  
**작업 ID**: `PW-2`

## 작업 내용
서비스 워커 — Next 의 next-pwa 또는 수동

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/PWA-PW-2.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — offline fallback 페이지 동작

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
