## 슬라이스 / 작업
**슬라이스**: `slice:PWA`  
**플랜**: docs/migration-v2/11-PWA.md  
**작업 ID**: `PW-4`

## 작업 내용
FCM 토큰 발급 + Supabase 등록 — **Wave 1/2 에서는 Mock 만, 실 DB 기록은 11-MIGRATE 완료 후 (Wave 3 이상)**

## 의존성 (Mn5)
- 선행: `M-5`

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/PWA-PW-4.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — 로그인 후 토큰 row 존재

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
