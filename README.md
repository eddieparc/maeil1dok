# 매일일독 (Maeil1Dok)

성경 통독 일정과 진행 상황을 기록하고 공동체와 함께 관리하는 서비스입니다.

- 웹: [maeil1dok.app](https://maeil1dok.app)
- API: [api.maeil1dok.app](https://api.maeil1dok.app)
- 운영: OCI VM + Cloudflare Tunnel

## 주요 기능

- 성경 통독표와 일별 본문 안내
- 개인별 읽기 기록, 진도율, 따라잡기
- 하세나하시조 및 성경 개론 영상
- 이메일·Kakao·Google·Apple 인증
- 친구, 공개 프로필, 소그룹, 스코어보드
- PWA와 웹 푸시 알림

## 저장소 구조

| 디렉토리 | 스택 | 상태 |
|---|---|---|
| `backend/` | Django 5.2, DRF, MySQL 8, Celery/Redis | 프로덕션 |
| `frontend/` | Nuxt 4 SSR, Pinia, Tailwind | 프로덕션 |
| `mobile/` | Expo React Native WebView | EAS 배포 |

프로덕션은 `main` 브랜치 품질 게이트 통과 후 OCI에 자동 배포됩니다. 운영 구조와 수동 절차는 [DEPLOY.md](DEPLOY.md)를 따릅니다.

## 로컬 검증

```bash
# Backend
(cd backend && .venv/bin/python manage.py test accounts todos tests bible_cache)

# Frontend
(cd frontend && npm test && npm run build)

# Mobile
(cd mobile && npm test && npm run typecheck)

# Deployment contracts (repository root)
python3 -m unittest \
  tests.test_frontend_deployment_config \
  tests.test_backend_ci_config \
  tests.test_mobile_ci_config \
  tests.test_documentation_integrity
```

백엔드 테스트에는 `SECRET_KEY`, `KAKAO_CLIENT_ID`, `KAKAO_REDIRECT_URI`가 필요합니다. CI와 동일한 MySQL 검증 방법은 [AGENTS.md](AGENTS.md)를 참고합니다.

## 문서

- [AGENTS.md](AGENTS.md): 저장소 구조, 명령, 에이전트 규칙
- [DEPLOY.md](DEPLOY.md): OCI 배포와 운영
- [DESIGN.md](DESIGN.md): 디자인 토큰과 UI 규칙