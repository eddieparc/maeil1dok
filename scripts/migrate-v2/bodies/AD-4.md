## 슬라이스 / 작업
**슬라이스**: `slice:ADMIN`  
**플랜**: docs/migration-v2/11-ADMIN.md  
**작업 ID**: `AD-4`

## 작업 내용
통독 플랜 엑셀 업로드 → daily_schedules 생성

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/ADMIN-AD-4.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 업로드 후 row 추가 검증 (없으면 신규 플랜 생성 불가능 — CORE)

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
