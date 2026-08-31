# 매일일독 배포 가이드

**현재 운영 아키텍처: OCI 단일 VM + Cloudflare Tunnel (2026-07~).**
Railway 는 완전히 퇴역했다(프로젝트 삭제됨). 과거 이전 기록은 [docs/railway-migration-runbook.md](docs/railway-migration-runbook.md) 참조.

라이브 엔드포인트:
- `maeil1dok.app` / `www.maeil1dok.app` — Nuxt 4 SSR (frontend 컨테이너)
- `api.maeil1dok.app` — Django API (web 컨테이너)
- 헬스: `api.maeil1dok.app/health/` (DB), `api.maeil1dok.app/ready/` (beat/하세나 하트비트 포함)
- 관측성: Loki 30일 보존 + Alloy 수집 + Resend health/backup alert. 운영 명령과 대응은
  [docs/production-observability.md](docs/production-observability.md).

---

## 1. 아키텍처

```
maeil1dok.app · www · api.maeil1dok.app
    │  (Cloudflare 프록시)
    ▼
Cloudflare Tunnel 60dbaac7 (아웃바운드 전용 — VM 인바운드 포트 없음)
    ▼
OCI Ampere A1 VM (168.107.46.120, urban-blanks 와 공존) /opt/maeil1dok
    ├─ cloudflared      터널 커넥터 (ingress: api→web:8000, apex/www→frontend:3000)
    ├─ web              Django+Gunicorn :8000 (entrypoint: migrate→collectstatic→gunicorn)
    ├─ frontend         Nuxt 4 SSR :3000 (frontend/Dockerfile.oci)
    ├─ celery-worker    비동기 태스크
    ├─ celery-beat      스케줄러 — 반드시 단일 인스턴스
    ├─ mysql            MySQL 8.0 (utf8mb4) — /mnt/data/maeil1dok/mysql
    └─ redis            broker(db0)+cache(db1) — /mnt/data/maeil1dok/redis
```

⚠️ **공존 규칙**: 같은 VM 의 urban-blanks 스택과 **네트워크·포트·nginx 를 절대 공유하지 않는다.**
(과거 공유 edge 네트워크에서 `web` 서비스명 충돌로 urban-blanks 장애가 났던 이력이 있다.
maeil1dok 은 `maeil1dok_default` 네트워크만 사용하고, 외부 노출은 오직 터널이다.)

## 2. 자동 배포 (GitHub Actions)

`main` push 시 `.github/workflows/ci.yml`:

1. 품질 게이트 — `backend-ci`(**MySQL 8 서비스 컨테이너**로 풀스위트), `frontend-ci`,
   `mobile-ci`, `deployment-config-ci` (변경된 경로만)
2. `deploy-oci` — backend/frontend 변경 + 게이트 전부 그린일 때:
   rsync(`.env*` 제외) → `compose build web celery-worker celery-beat frontend` → `up -d` → **터널 경유 라이브 스모크**
   (`/health/` + `/ready/` + 프론트 200 확인, 실패 시 잡 실패)
3. 수동 배포: Actions 탭 → CI → **Run workflow** (`workflow_dispatch` → 곧장 deploy-oci)

리포지토리 시크릿: `OCI_HOST` / `OCI_SSH_USER` / `OCI_SSH_KEY` (배포 전용 SSH 키)

### 수동 배포 (VM 직접)

```bash
ssh -i ~/.ssh/oci_a1_deploy ubuntu@168.107.46.120
cd /opt/maeil1dok
./scripts/oci_compose.sh build web celery-worker celery-beat frontend
./scripts/oci_compose.sh up -d
curl -fsS https://api.maeil1dok.app/health/
curl -fsS https://api.maeil1dok.app/ready/
```

### 롤백

roll-forward 원칙(문제는 새 커밋으로 수정 후 재배포). 긴급 시 이전 커밋으로:
```bash
git revert <bad-sha> && git push   # 자동 배포가 이전 상태를 다시 냄
```

## 3. 환경변수 / 시크릿

시크릿 파일은 **VM 에만 상주**하며 git/CI 에 없다 (rsync 가 `.env*` 를 제외).

| 파일 (VM /opt/maeil1dok) | 용도 | 템플릿 |
|---|---|---|
| `.env.oci` | 백엔드 (SECRET_KEY, DB_*, OAuth, Gemini/YouTube, Resend, Sentry, CRON_SECRET) | `.env.oci.example` |
| `.env.frontend.oci` | 프론트 SSR 런타임 (NUXT_PUBLIC_*, OAuth 클라이언트, cron 시크릿) | — |

- ⚠️ **`$` 이스케이프**: compose 의 env_file 보간이 값 안의 `$` 를 잘라먹는다. 값에 `$` 가
  있으면 반드시 `$$` 로 (예: SECRET_KEY). 과거 이걸로 JWT 서명키가 손상된 이력 있음.
- `SECRET_KEY` 는 세션/JWT 서명 호환을 위해 변경 금지.
- `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY`는 settings에 과거 흔적만 있고 현재
  서버 교환 consumer가 없다. compose runtime에는 주입하지 않는다. 네이티브 Apple 로그인은
  모바일 SDK가 identity token을 발급하고 백엔드는 `APPLE_CLIENT_ID` 기반 검증만 수행한다.

터널 자격증명/ingress: `/mnt/data/maeil1dok/cloudflared/{config.yml, 60dbaac7-….json}` (600).
호스트명 추가·변경은 `config.yml` ingress 수정 후 `docker restart maeil1dok-cloudflared-1`.
DNS 는 `cloudflared tunnel route dns maeil1dok <hostname>` 또는 CF 대시보드.

## 4. DB 백업 / 복원

- `CRON_TZ=Asia/Seoul`을 명시한 매일 03:20 KST cron(ubuntu):
  `scripts/oci_mysql_backup.sh`
  → `/mnt/data/maeil1dok/backups/` (mysqldump --single-transaction … gzip, 14일 보존)
- 복원:
  ```bash
  zcat backups/maeil1dok_<STAMP>.sql.gz | \
    docker exec -i -e MYSQL_PWD=$DB_ROOT_PASSWORD maeil1dok-mysql-1 \
    mysql -uroot --default-character-set=utf8mb4 maeil1dok
  ```
- Railway 퇴역 시점 최종 스냅샷: VM `backups/railway_FINAL_preDelete_*.sql.gz` + 로컬 오프호스트 사본.

현재 일일 백업은 DB와 같은 VM 디스크의 장애에는 독립적이지 않다. `OCI_BUCKET`을 설정하면
스크립트가 Object Storage 업로드까지 성공한 뒤에만 receipt를 갱신하지만, OCI CLI 설치와
새 bucket 생성은 별도 운영 승인(무료 한도 확인 포함) 전에는 수행하지 않는다.

백업 성공 시 `backups/last-success.json`이 원자적으로 갱신된다. `alert-probe`는 이 receipt의
나이·파일 존재·크기를 60초마다 검사하며 30시간을 넘기면 운영 메일을 보낸다.

## 5. 로그 / 알림

- Docker 로컬 로그: 컨테이너당 10MB × 3.
- 중앙 로그: Loki filesystem TSDB 30일, Alloy가 이 compose project만 수집.
- 외부 포트 없음. Loki/Alloy/Docker API proxy는 내부 전용
  `maeil1dok_observability`에 격리하고 alert-probe만 public health 조회를 위해 앱망에도 연결한다.
- 알림: Django `/health/`, `/ready/`, Nuxt `/api/health`, Loki, Alloy, DB 백업.
- VM 전체 장애: GitHub Actions `Production uptime`이 15분마다 public route를 외부에서 검사.
- 배포 후 canary:
  ```bash
  ./scripts/oci_compose.sh run --rm --entrypoint /app/run.sh alert-probe --canary
  ```
- 전체 운영·조회·장애 대응: [docs/production-observability.md](docs/production-observability.md).

## 6. 트러블슈팅

| 증상 | 확인 |
|---|---|
| 5xx / 접속 불가 | `docker compose ps` (11서비스), `docker logs maeil1dok-cloudflared-1` 에 "Registered tunnel connection" 4개 |
| 마이그레이션 실패로 web 재시작 루프 | `docker logs maeil1dok-web-1` — 무결성 마이그레이션은 fail-closed. 데이터 정합 조치 후 재기동 |
| 로그인 전부 풀림 | `.env.oci` SECRET_KEY 손상 의심 (`$` 이스케이프 §3) |
| beat 미동작 | `/ready/` 의 하트비트 확인. beat 는 1개만 떠야 함 |
| urban-blanks 영향 의심 | `curl -s https://api.ublanks.com/api/v1/health/` — maeil1dok 작업은 urban 과 어떤 리소스도 공유하지 않아야 정상 |
| 운영 메일 미수신 | `alert-probe --canary`의 Resend receipt id, `.env.oci`의 `OPS_ALERT_*`, 실제 수신함을 함께 확인 |
