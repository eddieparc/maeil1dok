# 11-PWA · PWA + FCM 푸시

> **슬라이스 ID**: 11-PWA · **Wave**: 2 (병렬, 인프라만 선행) · **의존**: 11-FOUND · **크기**: M

## 1. 목표
- PWA 매니페스트/서비스워커 정상 (홈 화면 추가, 오프라인 fallback)
- FCM 푸시 토큰 등록 + 통독 리마인더 발송 (Nuxt 미완 상태였음)
- Apple Sign In 리뷰 통과 흔적 ([docs/APPLE_SIGN_IN_SETUP.md](file:///Users/jgp/GitHub/maeil1dok/docs/APPLE_SIGN_IN_SETUP.md)) 검증

## 2. 자산
- Nuxt: [plugins/native-app.client.ts](file:///Users/jgp/GitHub/maeil1dok/frontend/app/plugins/native-app.client.ts), public/ 매니페스트
- Django: FCM 토큰 등록 엔드포인트 위치 — 03a 확인
- Supabase migration: `20260227000001_plan_e_avatar_fcm_notifications.sql` — FCM 토큰 테이블 존재
- Next: 02 §3 의 컴포넌트 + 02 §12 의 환경변수 (FCM 키)

## 3. 작업 — Wave 2 (인프라 부분, Mn7: SDK init OK, token register 만 Wave 3 지연)
| # | 작업 | DoD |
|---|---|---|
| PW-1 | manifest.webmanifest — 아이콘/이름/색상/start_url | Lighthouse PWA score |
| PW-2 | 서비스 워커 — Next 의 next-pwa 또는 수동 | offline fallback 페이지 동작 |
| PW-3 | iOS PWA 호환 (메타 태그 + status bar) | iOS Safari 홈 추가 검증 |
| **PW-3b** | **Firebase SDK init (Wave 2 OK, Mn7)** — `firebase.initializeApp(config)` + `getMessaging()` 호출까지는 Wave 2 에서 진행. **`getToken()` (FCM token 발급+서버 등록) 만 Wave 3 으로 지연**. SDK init 자체는 사용자 데이터 미접촉이므로 안전 | `firebase.initializeApp` 실행 + console error 0 |
| PW-6 | Apple Sign In 리뷰 호환성 (Apple은 Sign In 시 push 표시 요구사항 있음) | Apple 리뷰 가이드 체크리스트 |

## 4. 작업 — Wave 3+ (FCM 실 등록은 사용자 사전 생성 후로 지연 — Momus R1 Minor #3)
| # | 작업 | DoD |
|---|---|---|
| PW-4 | FCM 토큰 발급 + Supabase 등록 — **Wave 1/2 에서는 Mock 만, 실 DB 기록은 11-MIGRATE 완료 후 (Wave 3 이상)** | 로그인 후 토큰 row 존재 |
| PW-5 | 통독 리마인더 푸시 (Edge function 또는 cron) | 테스트 디바이스 수신 |

## 4. 결정
- PWD-1: 푸시 발송 인프라 — Supabase Edge function / Vercel Cron / 외부 큐
- PWD-2: 리마인더 시간/빈도 정책

## 5. DoD (Oracle R-final Major #6 + Momus #3 4-tuple 보강)
- **CHANGE**: public/manifest.webmanifest, public/sw.js (또는 next-pwa config), src/lib/firebase/init.ts, src/lib/fcm/register.ts, src/app/api/fcm/register/route.ts
- **EVIDENCE**: `.sisyphus/evidence/11-PWA-lighthouse.json` (PWA score), `.sisyphus/evidence/11-PWA-fcm-register.txt` (토큰 등록 row), `.sisyphus/evidence/11-PWA-ios-screenshot.png` (iOS 홈 추가), `.sisyphus/evidence/11-PWA-push-receive-{ios,android}.png` (실 디바이스 수신)
- **REPRODUCE**: `npx lighthouse https://maeil1dok.app --only-categories=pwa --output=json --output-path=.sisyphus/evidence/11-PWA-lighthouse.json && npx playwright test tests/e2e/pwa/*.spec.ts`
- **ASSERTION**:
  - Lighthouse PWA score: >= 90
  - FCM 토큰 등록 성공률: 100% (실 디바이스 5대 sample)
  - iOS Safari 홈 추가 동작 검증 (manual screenshot)
  - 푸시 수신 latency: < 5s (테스트 디바이스)
