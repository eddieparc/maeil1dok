## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-9b`

## 작업 내용
**Skip 사용자 spot check** (Momus R1 Hidden #2) — `data/skipped_users.json` 의 무작위 5명을 Django 측에서 직접 SELECT 해 `scheduled_deletion_at` / `merged_into` / 중복 이메일 여부 확인

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-9b.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 5/5 모두 정당 skip 입증

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
