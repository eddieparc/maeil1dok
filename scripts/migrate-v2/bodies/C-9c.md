## 슬라이스 / 작업
**슬라이스**: `slice:CUTOVER`  
**플랜**: docs/migration-v2/11-CUTOVER.md  
**작업 ID**: `C-9c`

## 작업 내용
**구 클라이언트 503 처리 역검증 + hotfix timeline** (Oracle R2 Major #4, Self-critique MAJOR M2) — 컷오버 전 사전 작업: 현재 배포된 Nuxt + 모바일 앱이 503 `app_updated` 응답을 받았을 때 (1) 사용자에게 안내 UI 표시 + (2) 앱스토어/Play 스토어로 유도하는 로직 **실제 존재 검증**. **없으면 hotfix 배포 필요 = 컷오버 +7d (iOS 리뷰 24~72h + Play Store 24~48h + 사용자 업데이트 propagation 며칠).** 사용자 사전 알림 의무.

## 의존성 (Mn5)
- 선행: `F-13 (Hotfix)`

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/CUTOVER-C-9c.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — grep 코드 + 모바일 실 디바이스 503 시나리오 테스트 + hotfix 시 컷오버 일정 조정 발표

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
