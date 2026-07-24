# AGENTS.md

에이전트용 리포 가이드. 상세 배포/운영은 **DEPLOY.md**, 디자인 토큰은 **DESIGN.md**.

## 프로젝트

매일일독(Maeil1Dok) — 성경 통독 트래킹 서비스. 모노레포:

| 디렉토리 | 스택 | 상태 |
|---|---|---|
| `backend/` | Django 5.2 + DRF + MySQL 8 + Celery/Redis, JWT + OAuth(Kakao/Google/Apple) | **프로덕션** (api.maeil1dok.app) |
| `frontend/` | Nuxt 4 SSR + Pinia + Tailwind | **프로덕션** (maeil1dok.app) |
| `maeil1dok-next/` | Next.js + Supabase | v2 WIP (미배포, 계획: `docs/migration-v2/`) |
| `mobile/` | Expo React Native (WebView 앱) | EAS로 별도 배포 |

## 프로덕션 / 배포

OCI 단일 VM + **Cloudflare Tunnel** (인바운드 포트 없음). urban-blanks 와 VM 공존 —
**네트워크·포트·nginx 절대 공유 금지** (과거 장애 이력).
`main` push → GitHub Actions 품질 게이트(백엔드는 실제 MySQL 8) → `deploy-oci` 자동 배포 → 라이브 스모크.
시크릿(`.env.oci` 등)은 VM에만 존재. `$` 값은 `$$` 이스케이프 필수. 전부 **DEPLOY.md** 참조.

## 명령어

```bash
# backend (backend/, .venv 사용)
.venv/bin/python manage.py test accounts todos tests bible_cache   # SQLite 빠른 실행
TEST_DB_ENGINE=mysql DB_HOST=... manage.py test ...                # CI와 동일(실 MySQL)
# 필수 env: SECRET_KEY, KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI (테스트: DJANGO_SETTINGS_MODULE=config.test_settings)

# frontend (frontend/)
npm run dev | npm run test | npm run build

# maeil1dok-next (maeil1dok-next/)
npm run test        # vitest
npm run build

# mobile (mobile/)
npm test            # node --test
npm run typecheck

# 배포 계약 테스트 (루트)
python3 -m unittest \
  tests.test_frontend_deployment_config \
  tests.test_backend_ci_config \
  tests.test_mobile_ci_config \
  tests.test_documentation_integrity
```

로컬 풀스택은 루트 `docker-compose.yml`(개발 전용 — 프로덕션 배포와 무관).

## 컨벤션

- 백엔드: 앱 단위 구조(`accounts/`, `todos/`, `bible_cache/`). 무결성은 DB 제약(fail-closed
  마이그레이션) + 테스트로 강제. 헬스: `/health/`(DB), `/ready/`(beat 하트비트).
- 프론트 모달: 개별 모달 컴포넌트 만들지 말고 통합 모달 사용 —
  `const modal = useModal()` → `await modal.confirm({...})` / `await modal.alert({...})`
  (구현: `frontend/app/components/ui/modal/`, `composables/useModal.ts`).
- 시크릿/키는 커밋 금지(.env.oci 계열은 gitignore).
