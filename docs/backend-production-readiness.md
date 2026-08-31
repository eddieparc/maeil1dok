# 백엔드 프로덕션 준비 상태 진단 (2026-08-30)

읽기 전용 진단. 소스 수정·커밋·배포·프로덕션 쓰기 없음. 유일한 예외는 **테스트가 결함을
실제로 잡는지 확인하기 위한 일시적 코드 변이**이며, 전부 `git checkout` 으로 원복하고
`git status` 로 확인했다(§8).

실행 계획은 `.omo/plans/backend-production-readiness-remediation.md`.

표기 규칙
- **[코드]** 코드를 읽어 추론한 것. **[동작]** 명령을 실행하거나 데이터를 질의해 확인한 것.
- **미확인** 은 확인하지 못한 것이다. 추측으로 채우지 않았다.
- 각 항목: (a) 주장 (b) 반증 조건 (c) 증거 (d) 현재 상태.

시각 표기: 프로덕션 MySQL 컨테이너는 UTC(`@@system_time_zone=UTC`), Django 는 naive KST.
이 문서의 시각은 명시하지 않으면 UTC.

---

## 0. 요약 — 거짓 초록으로 판명된 것

"통과하는 것처럼 보이지만 결함을 잡지 못하는" 검증을 변이 주입으로 확인한 목록이다.
변이 방법: 한 곳을 고치고 전체 스위트(백엔드 991개 + 루트 배포 계약 4모듈)를 돌려
실패 여부를 봤다. 실행 스크립트는 `/tmp` 에만 두었고 리포에 남기지 않았다.

| # | 변이 (무엇을 망가뜨렸나) | 결과 | 의미 |
|---|---|---|---|
| FG-1 | `settings.py` 전역 스로틀 `AnonRateThrottle`/`UserRateThrottle` 제거 | **못 잡음** | `test_settings.py:44` 가 `DEFAULT_THROTTLE_CLASSES: []` 로 덮어써 프로덕션 스로틀 동작은 어떤 테스트도 보지 않는다. §6 F-1(레디스 장애 시 전면 500)과 결합해 실제 위험. |
| FG-2 | `ACCESS_TOKEN_LIFETIME` 1시간 → 365일 | **못 잡음** | 쿠키 `max_age` 가 `accounts/authentication.py:145,154` 에 `60*60`, `60*60*24*30` 으로 **따로 하드코딩**돼 있다. JWT 수명과 쿠키 수명이 두 곳에서 독립적으로 정의되고, 어긋나도 아무 테스트도 실패하지 않는다. |
| FG-3 | `COOKIE_SAMESITE` `Lax` → `None` | **못 잡음** | 브라우저 쿠키 전송 규칙이 바뀌어도 계약 테스트가 없다. |
| FG-4 | `ci.yml` `deploy-oci.needs` 에서 `backend-ci` 제거 | **못 잡음** | 백엔드 테스트가 안 돌아도 배포되는 구성으로 바뀌어도 루트 계약 테스트(`tests/test_backend_ci_config.py`)가 통과한다. |
| FG-5 | `ci.yml` 배포 조건 `!cancelled() && !failure()` → `always()` | **못 잡음** | 게이트 실패 시에도 배포되는 구성이 통과한다. |
| FG-6 | `ci.yml` "Migration drift check" 스텝 삭제 | **못 잡음** | `makemigrations --check` 가 사라져도 아무 것도 실패하지 않는다. |
| FG-7 | `scripts/oci_mysql_backup.sh` 에서 `--single-transaction` 제거 | **못 잡음** | 백업 스크립트에는 테스트가 전혀 없다. 비일관 스냅샷이 돼도 모른다. |
| FG-8 | (변이 아님, 코드 확인) 특성화 하네스에 5xx 금지 규칙 없음 | 구조적 | `tests/api_characterization.py` 에 `500` 문자열이 없다. `UPDATE_CHARACTERIZATION_GOLDEN=1` 로 갱신하면 500 도 골든으로 승인된다. 2026-08-29 `.json` 별칭 22개 라우트 500 승인 사고의 근인. 현재 골든에는 500 이 0건 [동작: `grep -c '"status": 500'`]. |
| FG-9 | (변이 아님) 로컬 `--parallel 8` 스위트 비결정성 | 관측 | 무변경 스위트를 `--parallel 8` 로 6회 → **4회 실패**, 직렬 5회 → 0회 실패. 실패는 항상 같은 패밀리(`test_bible_reading_plan_n_plus_one` 3건: `response.json()['results']` 가 list, `test_api_characterization` 골든에서 페이지네이션 봉투 소실, `test_auth_probe_contract`, `test_openapi_schema`). 변이 검증 중 이 노이즈가 M13·M15 를 "잡았다"로 오판하게 만들었다(재실행으로 정정). CI 는 직렬·py3.12 라 영향 없음. **근인 미확인**(`tests` 패키지 단독 3회 중 2회 재현, `--parallel 2` 로는 미재현). |
| FG-10 | (변이 아님) `SENTRY_RELEASE` 고정값 | 관측 | VM `.env.oci` 의 `SENTRY_RELEASE=6a4582f9…` 는 2026-06-17 커밋이고 그 뒤 138 커밋이 배포됐다. Sentry 이벤트는 전부 두 달 전 릴리스로 태깅된다. `docs/observability-alert-coverage.md` 의 "release-correlated → rollback" 은 **처음부터 불가능**했다. 코드 폴백 `RAILWAY_GIT_COMMIT_SHA` (`config/observability.py:48`) 도 죽은 변수. |

잡은 변이(정상 동작 확인, 20건 중 15건 + 루트 5건): CSRF 무력화, token_version 무시,
회전 후 블랙리스트 생략, 쿠키 단독 refresh CSRF 생략, httponly/secure 해제, 로그아웃 후
핸드오프 코드 부활, authmetrics 미들웨어 침묵, `/ready/`·`/health/` 항상 200,
`BLACKLIST_AFTER_ROTATION` off, 로그인 스로틀 완화(스키마·골든이 잡음), refresh 수명 단축,
기본 권한 `AllowAny`, 지표 기록 예외 전파, 비활성 사용자 토큰 발급, `/ready/` 스모크 제거,
entrypoint 마이그레이션 생략, 테스트 앱 누락, celery 재생성 누락, `COMMIT_SHA` 미전달.

---

## 1. 거짓 초록 (관점 1) — §0 로 통합. 추가 사실

- 로컬 venv 는 Python **3.14.6**, CI·Docker 는 **3.12** [동작: `.venv/bin/python --version`,
  `Dockerfile:1`, `ci.yml python-version`]. 로컬 초록 ≠ CI 초록의 또 다른 축.
- `tests/test_parallel_safe_overrides.py` 는 `accounts/`, `todos/` 만 스캔하고 `tests/` 는
  스캔하지 않는다 [코드: `SCAN_DIRS`]. 현재 `tests/` 에 `REST_FRAMEWORK` 오버라이드는 없다.

## 2. 관측되지만 아무도 안 보는 신호 (관점 2) — [동작] 프로덕션 읽기 전용 질의

### S-1 refresh 403(csrf) 는 수정 배포 뒤에도 남아 있다
- 주장: 셸 CSRF 결함(be84428d) 배포 후에도 쿠키 단독 refresh 가 CSRF 로 거부되는 요청이 있고, 출처는 **iOS WKWebView**(앱 셸 안의 웹앱)다.
- 반증: 배포(08-30 01:17 UTC) 이후 web 로그에 `token/refresh/ … 403` 이 0건이면 틀림.
- 증거: `authmetrics_authmetriccounter` refresh_401 cause=csrf: 08-27 2건, 08-29 19건(10h 6, 22h 10, 23h 3), 08-30 4건(0h 1, 1h 3). 배포 후 컨테이너 로그에 403 1건, UA `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 …) Mobile/15E148` (Safari 토큰 없음 = WKWebView).
- 상태: 진행 중. 시간 단위 카운터라 배포 전후를 가를 수 없고, `client` 차원은 거의 전부 `unknown`/공백(`SHELL_UA_PATTERNS` 가 설계상 비어 있고 `X-Client` 는 web 2, shell 1 건만 도착). **원인 클라이언트 특정 불가** — 관측 차원이 없다.

### S-2 `token_blacklist` 증가
- 증거: outstanding **27,141** / blacklisted **20,935** / 만료된 outstanding **26,057 (96%)**. 최고 사용자 3,291행. 최근 14일 일 13~69행(≈40/일). 최초 행 2025-11-28. 크기 13.5 MB + 3.0 MB.
- 정리 작업: 리포·VM cron·beat 스케줄 어디에도 `flushexpiredtokens` 없음 [동작: `grep -rn`, `crontab -l`, `config/celery.py`]. `django_session` 1,365행 전부 만료(`clearsessions` 도 없음).
- 판단: **성능 피해는 없다**(jti 유니크 인덱스, 250 사용자, 연 1.5만 행). 무한 증가는 사실이나 우선순위는 낮다. 정리 시 `flushexpiredtokens` 는 `aware_utcnow()`(USE_TZ=False → naive UTC)와 `expires_at`(naive UTC)을 비교하므로 §4 의 9시간 어긋남에도 **안전하게 동작한다** [코드: simplejwt `flushexpiredtokens.py:12`, `utils.make_utc`].

### S-3 authmetrics 는 돌고 있고, 읽는 사람이 없다
- 증거: 카운터 157행, 08-27~08-30 만 존재(3일). outbox pending 0, 최근 2시간 aggregate 태스크 114회 성공. 코드에 카운터를 읽어 경보·보고하는 소비자 없음(관리 명령 3개뿐) [코드: `authmetrics/management/commands/`].
- 상태: 7일 기준선(문서가 요구)은 09-03 이후에야 존재. `auth_user 401 method=none` 하루 13~42건은 만료 쿠키 프로브로 보이나 **해석 기준 없음**.

### S-4 그 외 [동작]
- 5xx: 현재 컨테이너 로그(2h) + 회전 로그 3개 = 0건. 로그 보존은 10MB×3 이라 **수 시간~수 일**만 남는다.
- MySQL: `Max_used_connections` 4/151, `Aborted_connects` 13(32일), `Slow_queries` 0(`slow_query_log=0`, 임계 10s — 사실상 꺼짐).
- Redis: db1 17키(스로틀·핸드오프·하트비트), db0 1,009키(celery-task-meta), 메모리 9.8 MB.
- 컨테이너 재시작 0회, cloudflared 는 08-29 22:44 에 한 커넥션이 timeout 후 재등록(정상 동작).

## 3. 경보 부재 (관점 3)

| 깨지는 것 | 무엇이 알려주나 | 누가 언제 아나 |
|---|---|---|
| DB 다운 | `/health/` 503 | **배포 스모크 때만**. 외부 업타임 모니터는 리포·문서·VM 어디에도 흔적 없음(`grep -ri uptimerobot\|betterstack\|healthchecks\|pingdom` 0건). **존재 미확인**. |
| celery-beat/worker 사망 | `/ready/` 15분 후 503 | 위와 같음. 알림 리마인더 중단은 사용자 신고로만. |
| Redis 다운 | `/ready/` 503, **`/health/` 는 200** [코드: `health_views.py:health` 는 cache 를 건드리지 않음] | 같음. 사용자는 전 API 500(§6 F-1). |
| refresh 실패율 급증 | 카운터에 쌓임 | 아무도. 소비자 없음(S-3). |
| 백업 실패 | `/var/log/maeil1dok_mysql_backup.log` 에 ERROR | 아무도. cron 출력은 파일로만. |
| 예외 | Sentry(DSN 설정됨, env=production, traces 0.1) | 알림 규칙·수신자 **미확인**. 릴리스 태그는 무의미(FG-10). |
| 배포 후 회귀 | 스모크 3개 URL 200 | 상태코드만. 로그인·refresh 실경로는 안 본다. |

## 4. 경계 불일치 (관점 4)

### B-1 한 DB 안의 세 가지 시각 규약 [동작]
- MySQL 세션/시스템 TZ = UTC. Django `USE_TZ=False, TIME_ZONE=Asia/Seoul` → ORM 은 naive KST 를 쓴다. simplejwt 는 naive UTC 를 쓴다.
- 증거: `authmetrics_authmetriccounter.updated_at` 최대값 `2026-08-30 12:10`(KST) vs 같은 순간 `UTC_TIMESTAMP()=03:11`; `token_blacklist_outstandingtoken.created_at` 최대값 `03:09`(UTC). 9시간 차이가 같은 DB 에 공존.
- 영향 범위: 프로젝트 코드는 `OutstandingToken` 시각을 읽지 않는다(테스트의 patch 만) [코드: grep]. authmetrics 는 `to_utc_naive` 로 명시 정규화(변이 M13 은 골든이 잡음). 원시 SQL `NOW()`/`db_default` 없음. **현재 사용자 피해 없음**. 위험은 "누군가 admin 이나 SQL 로 토큰 시각을 읽고 KST 로 해석할 때".

### B-2 캐시에만 있는 상태 [코드]
Redis(AOF on) 에만 있는 것: 세션 브리지 코드(60s), 로그아웃 마커(24h), 핸드오프 세대 카운터, 스로틀 이력, beat 하트비트. 캐시가 **비면**: 코드는 `invalid_code` 로 fail-closed(`accounts/views.py:2088`), 로그아웃 마커 소실은 ≤60s 창의 코드 부활 가능(경미), 하트비트는 15분 grace 로 `unknown`→`/ready/` 200 유지. **비는 것은 안전**하다. 문제는 "죽는 것"(§6).

### B-3 refresh 회전은 트랜잭션이 아니다 [코드]
`cookie_views.py:224-231`: `refresh.blacklist()` 후 `get_tokens_for_user()`. 사이에서 실패하면 사용자는 이전 refresh 를 잃고 응답은 못 받는다 → 로그아웃. 관측된 사례 없음(카운터 `blacklisted` 08-29 1건이 동시 refresh 인지 이것인지 구분 불가).

### B-4 쿠키 수명 ≠ JWT 수명 (FG-2). 두 소스가 우연히 같은 값.

## 5. 부하와 성장 (관점 5) — [동작] 빈손에 가깝다
- 실규모: 사용자 250(전원 active), 진도 13,288행, 알림 4,930행, 가장 큰 테이블 `bible_cache_biblecontentcache` 277 MB 는 2025-12 에 8,323행 채워진 뒤 월 10~50행.
- 인덱스: `todos_userbibleprogress(subscription_id,is_completed)`, `(subscription_id,schedule_id)` 유니크, `todos_notification(recipient_id,created_at)`, `(recipient_id,read_at)` 존재. N+1 테스트 3종 존재(`tests/test_*_n_plus_one.py`).
- 무한 증가: `token_blacklist`(S-2), `authmetrics_autheventoutbox` 는 **처리된 행만** 22일 후 삭제 — worker 가 죽으면 미처리 행은 영원히 남는다 [코드: `recording.py:purge_expired`]. 현 유입 ≈150행/일이라 피해 없음.
- 커넥션: `CONN_MAX_AGE` 미설정(요청마다 연결), gunicorn 3 sync worker × timeout 60s. 외부 OAuth 10s timeout 이 3회 겹치면 그 동안 전 API 대기. 250 사용자에서는 이론적.

## 6. 실패 모드 (관점 6)

### F-1 Redis 가 죽으면 전 API 가 500, `/health/` 는 초록 [동작]
- 주장: DRF 스로틀(`SimpleRateThrottle.allow_request` → `cache.get`)이 `redis.exceptions.ConnectionError` 를 그대로 올리고, Django `RedisCache` 도 삼키지 않는다. 기본 스로틀이 모든 DRF 뷰에 걸려 있으므로(`settings.py:194`) 로그인·refresh 포함 전 엔드포인트가 500.
- 반증: 죽은 포트를 가리키는 `RedisCache` 로 `AnonRateThrottle().allow_request()` 를 호출했을 때 예외 없이 `True/False` 가 나오면 틀림.
- 증거: 독립 스크립트로 실행 → `RAISES redis.exceptions ConnectionError: Error 61 connecting to 127.0.0.1:6399`.
- 파급: `/health/`(DB only) 200 → 배포 스모크의 `/ready/` 는 503 으로 잡지만, 그 외 시점엔 아무도 모름. 사용자에겐 "전부 에러"이지 로그아웃은 아니다(쿠키는 살아 있음).
- 컨테이너 설정: `maxmemory 0` + `noeviction` + cgroup 300m → 메모리가 차면 축출 대신 **OOM kill → 재시작**(AOF 로 복구). 현재 9.8 MB 라 먼 위험.

### F-2 celery worker 사망 [코드]
리마인더 미발송, outbox 누적(§5), 하세나 요약 미생성. `/ready/` 는 15분 후 503. 알림 없음(§3).

### F-3 외부 OAuth 무응답 [코드]
`OAUTH_TIMEOUT=10`(`accounts/views.py:31`) 전 호출에 적용. HTTP 경계의 broad except 가 일반 오류 응답으로 바꾼다(`:345`, `:933`). 로그인 실패로 보이고 세션은 유지. 적절.

### F-4 배포 중 다운타임 [코드]
`up -d` 가 web 을 재생성 → entrypoint 가 `migrate`+`collectstatic` 후 gunicorn → healthcheck `start_period 90s`. 그 사이 cloudflared → `web:8000` 거부 → 사용자에게 502. **길이 미측정**. 마이그레이션 실패 시 재시작 루프, 자동 롤백 없음(DEPLOY.md 에 문서화됨).

### F-5 DB 다운 [코드]
`/health/` 503, 전 API 500. 예상대로.

## 7. 설정 정합성 (관점 7)

- C-1 Railway 잔재 [동작: VM `.env.oci` 값]: `ALLOWED_HOSTS` 에 `maeil1dok-backend-production.up.railway.app, healthcheck.railway.app`; `CORS_ALLOWED_ORIGINS`·`CSRF_TRUSTED_ORIGINS` 에 railway 프론트/백 오리진. 그 호스트를 지금 누가 쥐고 있는지 알 수 없다(Railway 프로젝트는 삭제됨). 코드 잔재: `RAILWAY_GIT_COMMIT_SHA`(FG-10), `HASENA_CRON_SECRET` 별칭(`settings.py:56`), `APPLE_TEAM_ID/KEY_ID/PRIVATE_KEY` 는 **코드 어디서도 안 읽는다**(`grep` 0건) — DEPLOY.md §3 의 "Apple 웹 로그인 서버 교환만 영향" 은 존재하지 않는 코드에 대한 설명.
- C-2 `SENTRY_RELEASE` 고정(FG-10). `SECURE_SSL_REDIRECT=False`(터널 종단, 타당). `COOKIE_DOMAIN=.maeil1dok.app`.
- C-3 의존성 [동작: 임시 venv 의 `pip-audit -r requirements.txt --no-deps`]: **Django 5.2.9 → PYSEC 고유 25건**, 전부 5.2.17 에서 수정. 나머지는 `>=` 로 열려 있어 감사 자체가 불가능하고, 프로덕션 이미지의 실제 버전이 로컬과 다르다: cryptography **50.0.1** vs 48.0.1, redis **8.1.0** vs 8.0.0, gunicorn **26.2.0** vs 26.0.0. 즉 **같은 커밋을 다시 빌드해도 같은 이미지가 나오지 않는다** — `git revert` 롤백이 "이전 상태"를 복원한다는 보장이 없다.
- C-4 자격증명 노출 경로: 로그에 토큰 전문을 찍는 곳 없음(`code[:8]` 절단, `[AUTH]` 는 debug). 백업 스크립트는 `-p"$PW"` 로 mysqldump 를 호출해 컨테이너 안 `ps` 에 잠깐 노출(경미, 경고 로그로 매일 남음).
- C-5 인가 테스트: `tests/test_authz_*`, 특성화 골든이 익명/소유자/비소유자 3 페르소나로 덮는다. 변이 M18(기본 권한 AllowAny) 을 골든이 잡았다.

## 8. 복구 가능성 (관점 8)

- R-1 백업 [동작]: 매일 **03:20 UTC(=12:20 KST, 낮 시간)** cron. DEPLOY.md·스크립트 주석은 "03:20 KST" 라고 쓰여 있다(문서 오류). 15개 파일 × 34 MB, 14일 보존, `gzip -t` 통과. **오프호스트 없음**(`OCI_BUCKET` 미설정) — 백업이 DB 와 **같은 디스크(`/dev/sda1`)** 에 있다. 디스크를 잃으면 7월 Railway 최종 스냅샷만 남는다.
- R-2 복원 리허설: 수행 기록 없음. **미확인** = 안 한 것으로 취급해야 한다.
- R-3 이미지 롤백 [동작: `docker images`]: `latest` 태그만 존재, 배포가 `docker image prune -f` 로 이전 이미지를 지운다. **VM 에서 즉시 되돌릴 이미지가 없다.** 롤백은 `git revert` → CI 전 게이트(프론트 e2e 포함) → 재배포. 그마저 C-3 때문에 동일 이미지가 아니다.
- R-4 마이그레이션: 배포마다 자동 실행, 사전 스냅샷 없음. `RunPython` 에 역방향이 없는 것 2개: `todos/migrations/0017_populate_existing_display_settings.py`, `todos/migrations/0033_notification_settings_absorb_legacy.py`. 나머지는 `noop`/reverse 있음.
- R-5 배포 게이트 자체가 FG-4/5/6 으로 관습에 의존.

## 9. 구조 (관점 9) — 결함을 숨긴 증거가 있는 것만

- ST-1 **CSRF 판정이 세 곳에 따로 있다**: `authentication.py:enforce_csrf`, `cookie_views.py:CookieTokenRefreshView.post`(쿠키 단독 분기), `cookie_views.py:cookie_logout`. 08-30 의 "모든 셸 refresh 403" 결함은 정확히 이 분기들이 서로 다른 규칙을 가진 데서 났고(커밋 be84428d 본문), 남은 403(S-1)도 같은 자리다.
- ST-2 **토큰 수명의 두 소스**(FG-2): `settings.SIMPLE_JWT` 와 `authentication.set_auth_cookies`.
- ST-3 `accounts/views.py` 2,143줄 — 위 둘을 넘어 결함을 숨긴 직접 증거는 없어 기록만 한다.

## 10. 사용자 피해 순 상위 후보 (반증 가능 형태)

1. **Redis 단일 장애 → 전 API 500, `/health/` 는 초록, 알리는 사람 없음** (F-1, FG-1, §3). 재현: 스로틀 프로브. 반증: 스로틀이 캐시 예외를 삼키는 코드가 있으면.
2. **깨져도 아무도 모른다** — 외부 모니터 미확인, 카운터 무소비, Sentry 릴리스 무의미 (§3, S-3, FG-10). 반증: 외부 모니터 계정과 Sentry 알림 규칙이 실재하면.
3. **복구 불가 시나리오** — 백업 동일 디스크·오프호스트 없음·복원 미리허설, 이전 이미지 없음, 의존성 비재현 (R-1~R-3, C-3). 반증: 오프호스트 사본과 복원 성공 기록이 있으면.
4. **Django 5.2.9 알려진 취약점 25건** (C-3). 반증: `pip-audit` 이 0건이면.
5. **refresh 403 이 WKWebView 에서 계속 난다** (S-1). 반증: 배포 후 로그에 0건이면.
6. **배포 게이트·백업 스크립트의 계약 테스트가 핵심 조건을 안 본다** (FG-4~7). 반증: 해당 변이가 실패하면.
7. **쿠키/스로틀/SameSite 설정이 무검증** (FG-1~3).
8. **`token_blacklist`·세션 무한 증가** (S-2) — 피해 낮음, 처리 쉬움.

포화 판단: 9관점 모두 실증으로 접근(5 는 빈손 기록). 마지막 두 웨이브(인덱스·slow log, 의존성 실버전)는 상위 후보를 바꾸지 않았다.

## 11. 미확인 목록 (다음 사람이 사실로 읽지 않도록)
- 외부 업타임 모니터 존재 여부, Sentry 알림 규칙·수신자.
- 백업 복원 가능 여부(리허설 미수행).
- 배포 다운타임 길이.
- 로컬 `--parallel` 비결정성의 근인(FG-9).
- S-1 잔여 403 의 정확한 클라이언트(OTA 미도달 셸의 WebView 인지, 웹앱 자체인지).
- Railway 호스트명의 현재 소유자.

## 12. 변이 원복 확인
모든 변이는 `git checkout -- <file>` 후 원본과 바이트 비교로 원복을 검증했다(스크립트 assert).
변이 스크립트 종료 시점의 `git status --short backend` = clean (스크립트 출력에 기록).
진단이 끝난 시점의 워킹트리에는 이 문서(미추적)와 `.omo/plans/…`(gitignore) 외에, **이 진단이
만들지 않은** 변경이 있다: 진단 시작 전부터 있던 `frontend/` 3파일 + 미추적 1파일, 그리고 진단
도중 다른 편집자가 추가한 `backend/accounts/handoff.py`(세대 advance 순서 변경),
`backend/tests/test_handoff_invalidation.py`, 미추적 `backend/tests/test_handoff_redis_integration.py`,
`frontend/app/composables/useAuthGuard.ts`, `frontend/tests/e2e/auth-offline-session.spec.ts`.
같은 워킹트리에서 동시에 작업이 진행 중이므로 이 문서의 `파일:줄` 참조 중 `handoff.py` 는
그 변경이 커밋되면 줄 번호가 몇 줄 밀릴 수 있다.
