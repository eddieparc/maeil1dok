## 슬라이스 / 작업
**슬라이스**: `slice:PWA`  
**플랜**: docs/migration-v2/11-PWA.md  
**작업 ID**: `PW-6`

## 작업 내용
Apple Sign In 리뷰 호환성 (Apple은 Sign In 시 push 표시 요구사항 있음)

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/PWA-PW-6.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — Apple 리뷰 가이드 체크리스트

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
