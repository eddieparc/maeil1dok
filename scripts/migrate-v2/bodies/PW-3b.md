## 슬라이스 / 작업
**슬라이스**: `slice:PWA`  
**플랜**: docs/migration-v2/11-PWA.md  
**작업 ID**: `PW-3b`

## 작업 내용
**Firebase SDK init (Wave 2 OK, Mn7)** — `firebase.initializeApp(config)` + `getMessaging()` 호출까지는 Wave 2 에서 진행. **`getToken()` (FCM token 발급+서버 등록) 만 Wave 3 으로 지연**. SDK init 자체는 사용자 데이터 미접촉이므로 안전

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/PWA-PW-3b.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — `firebase.initializeApp` 실행 + console error 0

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
