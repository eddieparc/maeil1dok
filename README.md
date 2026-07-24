# 매일일독 (Maeil1Dok)

매일일독은 성경통독표에 기반하여 매일매일 성경통독을 통해 완전한 성경일독을 체계적으로 진행할 수 있도록 돕는 서비스입니다.

## 🌐 서비스 접속하기
[매일일독(maeil1dok.app)](https://maeil1dok.app)

## 주요 기능

### 🎯 성경통독 관리
- 교회에서 제공하는 성경통독표를 기반으로 매일매일 읽을 본문을 가이드해드려요.
- 매일매일 업데이트되는 하세나하시조를 시청할 수 있어요.
- 개인별 통독 진행 상황을 기록하고, 통독표 진도율을 비교할 수 있어요(로그인 필요).
- (지원 예정)오늘의 본문을 몇 명이 읽었는지 확인할 수 있어요.
- (지원 예정)진행 상황을 공유하도록 설정하면, 매일일독에 참여 중인 사람들이 볼 수 있게 공개되어요.
- (지원 예정)인스타그램 스토리로 오늘 일독 인증을 할 수 있어요.
- (지원 예정)소그룹이나 공동체를 생성하고 참여할 수 있어요. 소그룹, 공동체별로 통독 현황 및 스코어보드를 확인할 수 있어요

### 📱 모바일 최적화 (지원 예정)
- (부분 지원 중)PWA(Progressive Web App) 지원
- OS 웹 푸시 알림을 통한 통독/하세나하시조 리마인더와 친구 활동 알림

### 🎥 미디어 콘텐츠
- 주일: 성경개론 영상
- 매일: 오디오 영상, 하세나하시조 영상, 오늘 성경 본문의 가이드(Notion 페이지)

## 기술 스택
- Backend: Django (Python), MariaDB
- Frontend: Vue.js, Nuxt.js
- Infrastructure: Docker, Docker Compose
- Authentication: OAuth 2.0 (Google, Kakao)
- Notification: Web Push (VAPID), PWA Service Worker, Celery Beat

## 개발 로드맵

### 1차 개발 (완료)
- [x] 프로젝트 기획 및 설계
- [x] Django 백엔드 및 MariaDB 모델링
- [x] Vue/Nuxt.js 프론트엔드 초기 화면
- [x] OCI + Cloudflare Tunnel 배포 (DEPLOY.md)
- [x] 유튜브 영상 등록 및 관리
- [x] 회원 기능 구현
- [x] 성경통독표 및 진행률 저장 기능

### 2차 개발(현재)
- [x] 소셜 로그인 (카카오)
- [x] 오늘의 본문 읽은 사람 수 표시
- [ ] 진행 상황 공유 설정 및 공개 기능
- [ ] 인스타그램 스토리 인증 기능
- [ ] 소그룹/공동체 생성 및 참여 기능
- [ ] 소그룹/공동체별 통독 현황 및 스코어보드

### 3차 개발
- [x] PWA 기반 OS 웹 푸시 알림
- [ ] 성능 최적화 및 테스트

## OS 웹 푸시 환경 변수

프로덕션에서 실제 OS 알림을 발송하려면 백엔드 환경에 다음 VAPID 값을 설정해야 합니다.

```bash
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:admin@example.com
```

`WEB_PUSH_VAPID_PUBLIC_KEY`는 브라우저 구독에 사용되고, private key는 서버 발송에만 사용합니다. private key는 저장소에 커밋하지 말고 운영 환경 변수(`.env.oci`, DEPLOY.md 참조)로만 관리하세요.

## 프로젝트 참여
하나님 제게 맡겨주신 달란트를 하나님께 영광돌리는데에 사용해보고 싶었습니다.
또한 개인의 자기 계발과 성장을 위해 매일일독을 사랑으로 개발하고 있습니다!
아직은 프로젝트 참여 요청은 받지 않는 점 양해 부탁드립니다!



## 라이선스
MIT License
