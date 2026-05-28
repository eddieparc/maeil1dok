## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5c`

## 작업 내용
**PBKDF2 → `password_verification_hook` 방식** (Oracle R2 Critical #1, 자가 R3 Self-1, Self-critique MAJOR M3) — Supabase `password_verification_hook` (Auth Hooks 카테고리) 으로 외부 검증. **선행 의무: F-17 (Supabase tier 사전 확인) 통과 후 진입.** F-17 결과 Pro tier 필요 + 사용자 비용 승인 시 (a) 경로, 불가 시 (b) 강제 reset 경로 자동 회귀.

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5c.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — (a): 5명 sample 로 첫 로그인 통과. (b): 강제 reset 발송 후 응답률 추적

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
