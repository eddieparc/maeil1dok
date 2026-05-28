## 슬라이스 / 작업
**슬라이스**: `slice:CUTOVER`  
**플랜**: docs/migration-v2/11-CUTOVER.md  
**작업 ID**: `C-9d`

## 작업 내용
**Cache invalidation 5중 차단** (Oracle R-final Major #5) — Hard Block 503 이 cache/SW 경로로 우회될 수 있어 다음 모두 적용: (1) **Cloudflare full purge** — `cf-cli purge --zone maeil1dok.app --everything` (DNS 전환 직전 + 직후 2회). (2) **Service Worker version bump + auto-update** — Wave 6 진입 시 Nuxt SW 의 `cacheName` 버전 강제 갱신 + `skipWaiting()` + `clients.claim()` 적용한 hotfix 배포 (컷오버 -3d). 사용자 다음 접속 시 자동 SW 교체. (3) **`Cache-Control: no-store` on 503** — Nginx 측 503 응답 헤더에 `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` 강제. CDN / 브라우저 / SW 모두 캐싱 차단. (4) **HTML shell `<meta http-equiv="refresh" content="0; url=/maintenance">`** — 캐시된 구 Nuxt shell 이 떠도 즉시 maintenance 페이지로 리다이렉트 (사용자 무한 로딩 차단). (5) **컷오버 -2d 사전 검증 (재현 테스트)** — 다음 시나리오 staging 에서 실 검증: 모바일 Safari/Chrome 에서 구 SW 캐싱된 shell 진입 → 503 응답 → 사용자가 보는 화면이 maintenance + 새 SW 자동 인스톨.

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/CUTOVER-C-9d.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — (1) Cloudflare purge log + cache-status MISS 검증. (2) SW 버전 갱신 commit + Wave 6 -3d 배포 evidence. (3) `curl -I` 응답에 no-store 검증. (4) `<meta refresh>` HTML grep. (5) staging 재현 테스트 결과 (`.sisyphus/evidence/C-9d-cache-replay-{safari,chrome,sw}.txt`)

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
