## 슬라이스 / 작업
**슬라이스**: `slice:ANNOTATE`  
**플랜**: docs/migration-v2/11-ANNOTATE.md  
**작업 ID**: `AN-8`

## 작업 내용
마이그레이션: 3 신규 테이블 데이터 row count 일치

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/ANNOTATE-AN-8.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 5% hard fail

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
