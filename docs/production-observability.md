# 프로덕션 관측성 운영

이 문서는 OCI의 현재 운영 스택에 대한 로그·오류·알림 SSOT다. 폐기된 Next/Vercel
이중 스택의 alert 계약은 현재 운영 문서에서 제거했다.

## 소유권과 알림 경로

- 1차 운영 소유자: `OPS_ALERT_EMAIL` 수신자
- 전송 경로: 기존 Resend 계정의 `RESEND_API_KEY`
- 발신자: `OPS_ALERT_FROM` (기본 `noreply@maeil1dok.app`)
- `alert-probe`는 60초마다 Django health/readiness, Nuxt health, Loki, Alloy, 최근 DB
  백업을 검사한다.
- `.github/workflows/uptime.yml`은 VM 밖의 GitHub Actions에서 15분마다 public health
  3개를 확인해 VM·터널·DNS 전체 장애를 잡는다. 1차 운영 소유자는 GitHub Actions 실패
  알림도 수신하도록 저장소 알림 설정을 유지한다.
- 같은 장애는 상태가 바뀔 때 한 번만 발송하며 정상화 시 recovery 메일을 발송한다.
- 배포마다 `--canary`를 실행해 HTTP 2xx와 Resend receipt id를 확인한다.

| 등급 | 조건 | 최초 대응 |
| --- | --- | --- |
| SEV1 | health/readiness 503, 중앙 로그 중단, 백업 30시간 초과 | 15분 내 확인, 최근 배포·컨테이너·DB/Redis 점검 |
| SEV2 | Sentry 오류 급증, 단일 비핵심 작업 실패 | 영업일 내 분류, release와 request id로 영향 범위 확인 |

## 저장과 보존

- Docker 로컬 `json-file`: 컨테이너당 `10m × 3` 파일. Loki 장애 시의 짧은 로컬 안전망이다.
- Loki: OCI의 `${OCI_DATA_ROOT}/loki`, TSDB schema v13, **30일(720시간)** 보존.
- alert-probe는 같은 파일시스템의 여유 공간이 15% 아래로 내려가면 `log_disk` SEV1을 보낸다.
- Alloy positions: `${OCI_DATA_ROOT}/alloy`.
- MySQL 백업: `${OCI_DATA_ROOT}/backups`, **14일** 보존. 성공할 때만
  `last-success.json`을 원자적으로 갱신한다.
- Loki·Alloy·Docker API proxy는 호스트 포트를 열지 않고 내부 전용
  `maeil1dok_observability`에서만 통신한다. alert-probe만 public health와 내부 로그
  구성요소를 함께 검사하기 위해 두 매일일독 network에 연결된다.
  urban-blanks의 network, nginx, 포트, 저장소를 사용하지 않는다.

## 로그 계약

백엔드 프로덕션 로그는 한 이벤트당 JSON 한 줄이며 최소 필드는 다음과 같다.

- `timestamp`, `level`, `logger`, `message`
- HTTP 요청은 `request_id`, `method`, `path`, `status_code`, `duration_ms`
- 분산 추적 문맥이 있으면 `trace_id`
- 인증 헤더, 쿠키, 토큰, 이메일, 비밀번호와 민감 query 값은 저장하지 않는다.

Alloy는 endpoint allowlist Docker proxy를 통해 Docker label
`com.docker.compose.project=maeil1dok`인 컨테이너만 수집한다.
`service`, `container`, `level`은 조회 label이고 `request_id`, `trace_id`, `logger`는
structured metadata다. request id를 인덱스 label로 만들지 않아 cardinality 폭증을 막는다.

## 운영 명령

```bash
cd /opt/maeil1dok
COMPOSE='docker compose -f docker-compose.oci.yml --env-file .env.oci'

# 서비스 상태
$COMPOSE ps
curl -fsS https://api.maeil1dok.app/health/
curl -fsS https://api.maeil1dok.app/ready/
curl -fsS https://maeil1dok.app/api/health

# 중앙 로그 구성요소
$COMPOSE logs --tail=100 loki alloy alert-probe

# 실제 이메일 canary. 출력의 ops.alert.delivered receipt_id와 수신함을 모두 확인한다.
$COMPOSE run --rm --entrypoint /app/run.sh alert-probe --canary
```

Loki는 앱 컨테이너와 외부에 노출하지 않는다. 두 관측성 network에 연결된
`alert-probe` 컨테이너에서 query API를 호출한다.

```bash
docker compose -f docker-compose.oci.yml --env-file .env.oci exec alert-probe \
  curl -fsSG http://loki:3100/loki/api/v1/query_range \
  --data-urlencode 'query={service="web"} | json | request_id="REQUEST_ID"' \
  --data-urlencode 'limit=20' | jq .
```

## 장애 대응

1. 메일의 실패 key(`django_health`, `django_ready`, `frontend_health`, `loki`, `alloy`,
   `backup`, `log_disk`)를 확인한다.
2. `docker compose ps`에서 재시작·unhealthy 상태를 확인한다.
3. 최근 배포 commit과 Sentry release를 맞춰 오류가 배포 이후 시작됐는지 확인한다.
4. request id가 있으면 Loki에서 동일 요청의 JSON 로그를 조회한다.
5. 백업 장애면 `last-success.json`, 최신 `.sql.gz`, cron 로그를 확인하고 수동 백업 후
   `gzip -t`를 통과시킨다.
6. 복구 뒤 recovery 메일을 확인한다. 알림 경로 자체가 의심되면 `--canary` receipt와
   실제 수신함을 함께 확인한다.

## 비밀값

아래 값은 VM `.env.oci` 또는 EAS 환경에만 두며 Git에 넣지 않는다.

- Backend/frontend Sentry: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Mobile Sentry: EAS production의 `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT`
- Email alert: `RESEND_API_KEY`, `OPS_ALERT_EMAIL`, `OPS_ALERT_FROM`
