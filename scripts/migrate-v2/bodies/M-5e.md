## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5e`

## 작업 내용
**`auth.identities` identity_data JSONB 완비** (Oracle R2 Major #3, 자가 R3 Self-3) — GoTrue schema 정확히: `{"sub": provider_id, "email": email, "email_verified": true, "phone_verified": false, "provider_id": provider_id, ...optional provider-specific}`. `sub` 와 `provider_id` 모두 명시 (둘 다 GoTrue 가 참조).

## 의존성 (Mn5)
- 선행: `M-5b`

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5e.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 5명 spot check: identity_data.sub == identity_data.provider_id == auth.identities.provider_id

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
