## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5d`

## 작업 내용
**Trigger 충돌 우회 + 마이그레이션 중 가입 차단** (Oracle R2 Critical #2, 자가 R3 Self-2) — `on_auth_user_created` 트리거가 `profiles` 자동 생성하므로 충돌. 마이그레이션 동안 `ALTER TABLE auth.users DISABLE TRIGGER ALL` (service_role 권한 가능) + maintenance mode 로 신규 가입 차단 의무 (트리거 OFF 동안 정상 신규 가입은 profiles 미생성). 마이그레이션 종료 후 즉시 트리거 RE-ENABLE.

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5d.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 충돌 0건 + profiles count == auth.users count + maintenance mode 동안 신규 signup 시도 시 503

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
