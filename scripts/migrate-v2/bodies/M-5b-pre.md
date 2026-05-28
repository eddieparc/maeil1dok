## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5b-pre`

## 작업 내용
**`auth.identities` 쓰기 메커니즘 사전 검증** (Self-critique B1) — 빈 Supabase 프로젝트에 1건 sample 로 (a) `service_role` 로 `auth.identities` 직접 INSERT 시도, (b) 실패 시 `supabase.auth.admin.linkIdentity()` API 시도, (c) 둘 다 실패 시 `supabase.auth.admin.createUser({...identities})` 통합 생성 시도. 동작하는 경로 1개 입증 후 M-5b 진입.

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5b-pre.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 1건 sample 로 `auth.identities` 에 row 존재 입증 + 사용한 method 보고서

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
