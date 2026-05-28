## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5b`

## 작업 내용
**SocialAccount → auth.identities 명시적 마이그레이션** (Oracle Critical #1, Mn8 + Oracle R-final Major #2) — M-5b-pre 에서 입증된 경로로 Django `accounts_socialaccount` 의 모든 row 를 마이그레이션. `provider` + `provider_id` + `user_id (mapped UUID)` + `identity_data` (M-5e). **Mn8: auth.identities 의 PK (UUID `id`) 정책 — Supabase 자동 생성. Django SocialAccount.id 는 보존 안 함 (Supabase 의 UUID 로 대체). FK 참조 없으므로 무방.**

## 의존성 (Mn5)
- 선행: `M-5b-pre`

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5b.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — (a) Django SocialAccount count == Supabase auth.identities count. (b) **실 OAuth/token exchange 검증 — migrated social test account 1건당 staging 환경에서 실제 Kakao/Google/Apple OAuth 진행 → `supabase.auth.getUser()` 결과의 `id` 가 `user_mapping[django_user_id]` 와 정확히 일치 (각 provider 1건 = 3건 + 무작위 5명 추가 = 8건 검증)**. (c) `auth.identities` 유니크 제약 검증: `(provider, provider_id)` 중복 0건, `(user_id, provider)` 중복 0건. row 존재만으로는 첫 로그인 시 새 빈 계정 생성 차단 불충분 — 실 token exchange 가 사전 매핑 UUID 와 연결되는지 동작 검증 의무

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
