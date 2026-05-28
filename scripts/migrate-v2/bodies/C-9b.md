## 슬라이스 / 작업
**슬라이스**: `slice:CUTOVER`  
**플랜**: docs/migration-v2/11-CUTOVER.md  
**작업 ID**: `C-9b`

## 작업 내용
**Hard DB Lock** — MySQL 사용자 권한 REVOKE INSERT/UPDATE/DELETE (또는 `FLUSH TABLES WITH READ LOCK`). 모바일 클라이언트가 토큰 가지고 직접 호출해도 데이터 변경 0 보장

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/CUTOVER-C-9b.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — `INSERT` 시도 → ER_TABLEACCESS_DENIED. 검증 query 결과

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
