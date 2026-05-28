## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5d`

## 작업 내용
**Trigger 충돌 우회 — ON CONFLICT 방식** (Oracle R2 Critical #2, 자가 R3 Self-2, Self-critique B2) — `on_auth_user_created` 트리거가 `profiles` 자동 생성. **Supabase managed 환경에서 service_role 은 `auth.users` 의 trigger 제어 권한 없음 (table owner: `supabase_auth_admin`)**. 트리거 DISABLE 시도 대신 **`profiles INSERT ... ON CONFLICT (user_id) DO UPDATE SET ...`** 사용. 트리거가 빈 profiles row 를 먼저 만들어도 우리 데이터로 덮어쓰기. + maintenance mode 로 신규 가입은 별도 차단.

## 의존성 (Mn5)
- 선행: `M-5`

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5d.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — profiles INSERT 시 충돌 0건 (ON CONFLICT 의 DO UPDATE 가 처리) + profiles 의 모든 컬럼이 Django UserProfile 값으로 셋팅됨

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
