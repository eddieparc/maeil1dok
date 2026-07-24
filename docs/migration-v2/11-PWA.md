# 11-PWA · PWA + FCM Push

> **슬라이스 ID**: 11-PWA · **Wave**: 2 (AUTH와 병렬) · **상태**: v1 Web Push 기준선에서 v2 FCM으로 전환

## 1. 목표

- 설치형 PWA와 일반 브라우저에서 알림 수신을 유지한다.
- 통독·하세나 리마인더와 친구 활동 알림을 FCM으로 발송한다.
- v1의 활성 Web Push 구독은 자동 이전이 불가능하므로 컷오버 후 재동의를 명시적으로 받는다.

## 2. 기준선과 v2 자산

v1 프로덕션 기준선:

- `frontend/public/notification-sw.js`
- `todos.NotificationPushSubscription`
- Celery beat `send-due-notification-reminders`
- Django Web Push(VAPID)

v2 구현:

- `maeil1dok-next/src/lib/firebase/config.ts`
- `maeil1dok-next/src/lib/firebase/messaging.ts`
- `maeil1dok-next/src/lib/firebase/send.ts`
- `maeil1dok-next/src/app/api/notifications/token/route.ts`
- `maeil1dok-next/src/app/api/cron/daily-reminder/route.ts`
- Supabase `fcm_tokens`, `notification_settings`

## 3. 설정

클라이언트에는 `NEXT_PUBLIC_FIREBASE_*`와 `NEXT_PUBLIC_FIREBASE_VAPID_KEY`만 노출합니다. `FIREBASE_SERVICE_ACCOUNT_KEY`는 서버 전용이며 저장소, 브라우저 번들, 로그, 응답에 포함하면 안 됩니다. 전체 변수 목록은 `maeil1dok-next/.env.local.example`을 따릅니다.

## 4. 작업

| ID | 작업 | 완료 조건 |
|---|---|---|
| PW-1 | manifest 아이콘·이름·색상·`start_url` 검증 | Lighthouse PWA 기준 통과 |
| PW-2 | 서비스 워커와 오프라인 fallback 검증 | 오프라인 fallback 동작 |
| PW-3 | iOS PWA 메타 태그와 status bar 검증 | iOS Safari 홈 화면 설치 확인 |
| PW-3b | Firebase SDK 초기화와 messaging 연결 | 초기화 오류 0건 |
| PW-4 | FCM 토큰 발급·등록·삭제 수명주기 검증 | 사용자·기기별 토큰 정합성 |
| PW-5 | 통독·하세나 리마인더 발송 검증 | 테스트 기기 수신 및 실패 가시성 |
| PW-6 | Apple 심사 요구사항 점검 | 심사 체크리스트 완료 |

## 5. DoD
- **CHANGE**: FCM service worker, 토큰 등록·삭제 API, 알림 설정 UI, 발송 cron
- **EVIDENCE**: Vitest 결과, Next 빌드 결과, 브라우저별 수신 영수증
- **REPRODUCE**: `(cd maeil1dok-next && npm test && npm run build)`
- **ASSERTION**:
  - 로그인 사용자가 현재 기기의 알림을 켜고 끌 수 있다.
  - 동일 토큰 재등록은 중복 행을 만들지 않는다.
  - 로그아웃 또는 설정 해제 시 해당 토큰을 삭제한다.
  - 만료·무효 토큰은 발송 결과에 따라 정리한다.
  - cron 인증 실패는 발송과 데이터 접근 전에 거부한다.
  - 서비스 계정과 FCM 토큰은 공개 응답이나 로그에 노출되지 않는다.

## 6. 수동 QA

- Chrome과 Android WebView에서 포그라운드·백그라운드 알림을 확인한다.
- iOS Safari 홈 화면 PWA에서 권한 요청과 알림 수신을 확인한다.
- 알림 클릭이 의도한 HTTPS 앱 경로로 이동하는지 확인한다.
- v1 사용자가 컷오버 후 재동의 안내를 받고 새 FCM 토큰을 등록하는지 확인한다.
