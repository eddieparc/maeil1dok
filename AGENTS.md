# AGENTS.md

에이전트용 리포 가이드. 상세 배포/운영은 **DEPLOY.md**, 디자인 토큰은 **DESIGN.md**.

## 프로젝트

매일일독(Maeil1Dok) — 성경 통독 트래킹 서비스. 모노레포:

| 디렉토리 | 스택 | 상태 |
|---|---|---|
| `backend/` | Django 5.2 + DRF + MySQL 8 + Celery/Redis, JWT + OAuth(Kakao/Google/Apple) | **프로덕션** (api.maeil1dok.app) |
| `frontend/` | Nuxt 4 SSR + Pinia + Tailwind | **프로덕션** (maeil1dok.app) |
| `mobile/` | Expo React Native (WebView 앱) | EAS로 별도 배포 |

v2 이전 시도(`maeil1dok-next/` Next.js+Supabase 및 계획 문서 `docs/migration-v2/`)는 폐기되어 리포에서 제거했다.

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
npm run api:generate         # OpenAPI 스키마 -> TS 타입 재생성
npm run typecheck:ratchet    # 타입 오류 래칫 (CI 게이트)

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
- **API 계약은 `backend/schema.yml`이 단일 원천이다.** 뷰·시리얼라이저를 바꾸면
  `manage.py spectacular --file schema.yml --validate`로 재생성해 **함께 커밋**한다 —
  안 하면 `tests.test_openapi_schema`가 바이트 비교로 CI를 떨어뜨린다.
  프론트 타입은 그 스키마에서 생성하므로(`npm run api:generate`) 스키마를 고쳤으면
  타입도 재생성한다. 자세한 것은 **backend/OPENAPI.md**.
- **프론트 API 호출은 생성 타입 기반 facade를 쓴다** — `api.GET('/api/v1/...')`,
  `api.POST(...)`, 경로 파라미터는 `api.path('/a/{id}/', { id })`, query는 `params` 객체로.
  구형 `api.get<T>(...)`처럼 **응답 타입을 손으로 주장하지 않는다**(스키마가 준다).
  모범 예시: `frontend/app/stores/groups.ts`, 열거형 처리는 `frontend/app/pages/bible/search.vue`.
- **타입체크는 래칫으로 강제한다.** 기존 오류는 `frontend/typecheck-baseline.json`에 고정돼 있고
  **신규 오류만 실패**한다. 기존 오류를 고쳤으면 `npm run typecheck:ratchet:update`로 기준선을
  낮춰 함께 커밋한다. **기준선을 올려서 통과시키지 않는다** — 부채는 줄기만 해야 한다.
- 안전망: `backend/tests/test_api_characterization.py`(라우트별 3페르소나 HTTP 골든)와
  `backend/tests/test_social_login_v2_contract.py`(모바일 셸이 의존하는 로그인 계약·쿠키 속성).
  응답이 바뀌면 **의도된 변경일 때만** 골든을 갱신한다(`backend/tests/CHARACTERIZATION.md`).
