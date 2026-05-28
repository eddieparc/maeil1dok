## 슬라이스 / 작업
**슬라이스**: `slice:ADMIN`  
**플랜**: docs/migration-v2/11-ADMIN.md  
**작업 ID**: `AD-2`

## 작업 내용
보호된 라우트 (/admin/*) — 미들웨어 가드

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/ADMIN-AD-2.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 비관리자 → 403

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
