# 11-PWA · PWA + OS Web Push

> **슬라이스 ID**: 11-PWA · **현재 구현 기준**: Nuxt 3 + Django Web Push(VAPID)

## 1. 목표
- PWA 매니페스트와 서비스워커를 통해 브라우저/설치형 PWA에서 OS 알림을 수신한다.
- 통독 리마인더, 하세나하시조 리마인더, 친구 활동 알림을 실제 Web Push로 발송한다.
- 사용자는 `/notifications/settings`에서 현재 기기의 푸시 구독을 켜고 끌 수 있다.

## 2. 현재 구현 자산
- Nuxt 서비스워커: `frontend/public/notification-sw.js`
- 기기 구독 런타임: `frontend/app/utils/devicePushRuntime.ts`
- 설정 UI: `frontend/app/components/notifications/DevicePushSetting.vue`
- Django 구독 모델: `todos.NotificationPushSubscription`
- Django 구독 API:
  - `GET /api/v1/todos/notifications/push/config/`
  - `POST /api/v1/todos/notifications/push/subscriptions/`
  - `POST /api/v1/todos/notifications/push/subscriptions/remove/`
- Django 발송 서비스: `backend/todos/services/push_notifications.py`
- 리마인더 스케줄러: Celery beat `send-due-notification-reminders`

## 3. 운영 환경 변수

```bash
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:admin@maeil1dok.app
```

- public key는 브라우저 PushSubscription 생성에 사용한다.
- private key는 Django 백엔드의 `pywebpush` 발송에만 사용한다.
- private key는 저장소에 커밋하지 않고 Railway/운영 환경 변수로만 관리한다.

## 4. DoD
- `frontend/public/notification-sw.js`가 프로덕션 빌드 산출물에 포함된다.
- 로그인 사용자가 `/notifications/settings`에서 현재 기기 푸시 알림을 켤 수 있다.
- 구독 정보가 Django API에 저장되고, 같은 endpoint 재등록 시 활성 상태로 갱신된다.
- 친구 활동 알림 생성 시 `Notification`과 Web Push 발송이 함께 수행된다.
- Celery beat가 5분마다 due reminder를 생성해 통독/하세나하시조 OS 알림을 발송한다.
- 만료된 Web Push endpoint(404/410)는 자동 비활성화된다.

## 5. 검증

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.test_settings SECRET_KEY=test KAKAO_CLIENT_ID=test KAKAO_REDIRECT_URI=http://localhost ../.venv/bin/python manage.py test todos.test_notifications

cd ../frontend
npm test -- notifications-contract.test.mjs
npm run build
```

수동 QA:
- HTTPS 운영 도메인 또는 localhost에서 로그인한다.
- `/notifications/settings`에서 현재 기기 푸시 알림을 켠다.
- 브라우저 권한을 허용하고 OS 알림 수신을 확인한다.
- iOS Safari는 홈 화면에 추가한 PWA에서 권한을 허용해야 OS 푸시가 동작한다.

## 6. 레거시 참고

`maeil1dok-next` 하위의 Firebase/FCM 파일과 Supabase FCM migration은 Next 전환 실험의 레거시 인벤토리다. 현재 운영 Nuxt/Django 앱의 OS 푸시는 FCM이 아니라 표준 Web Push(VAPID)를 기준으로 유지한다.
