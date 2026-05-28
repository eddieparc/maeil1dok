## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5b`

## 작업 내용
**SocialAccount → auth.identities 명시적 마이그레이션** (Oracle Critical #1) — Django `accounts_socialaccount` 의 모든 row 를 `provider` + `provider_id` + `user_id (mapped UUID)` 로 `auth.identities` 에 service_role 로 직접 insert. Apple Private Relay 이메일이나 Kakao 비공개 이메일 사용자도 첫 로그인 시 자동 연결됨.

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5b.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — Django SocialAccount count == Supabase auth.identities count (정상 사용자 모수 기준). 5명 spot check: Django provider_id 가 auth.identities.provider_id 와 일치

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
