# 인증 마이그레이션 지표·게이트 증거

계획서 `.omo/plans/auth-session-ssot-migration.md` 의 게이트들이 **기록 대상으로 지목한 파일**이다.
관측값과 사람이 수행한 검증 결과를 여기 남긴다. 여기 기록이 없으면 그 게이트는 닫히지 않는다.

각 섹션 제목에 **누가 채우는지**를 달았다. 에이전트가 채울 수 없는 항목은 `사람` 으로 표시했다.

## 저장소와 질의

지표는 순환 로그가 아니라 **`authmetrics` 앱의 카운터 테이블**에 있다.
컨테이너 로그는 약 30MB(`json-file`, 10m x 3)에서 순환하므로 트래픽이 조금만 늘어도
배포 전 베이스라인이 밀려 사라진다 — 그 상태로는 롤백 판정 자체가 성립하지 않는다.

| 대상 | 수단 |
|---|---|
| grain | `(day, hour, event, method, outcome, status, route_bucket, cause, age_bucket)` — `hour` 는 **UTC** 0..23 |
| 일별 값 | 24개 시간의 합 (`authmetrics.recording.daily_total`) |
| 롤링 6시간 창 | 인접 6개 시간의 합 (`authmetrics.recording.rolling_window_total`) — UTC 자정을 걸치는 창도 정확히 계산한다 |
| 집계 | `manage.py aggregate_auth_metrics` (또는 celery `authmetrics.aggregate_auth_events`) |
| 보존 | 22일. `manage.py purge_auth_metrics` |
| 증거 고정 | `manage.py pin_auth_metrics --from YYYY-MM-DD --to YYYY-MM-DD` (해제는 `--unpin`) |

**시간대 주의**: 이 프로젝트는 `USE_TZ = False` · `TIME_ZONE = Asia/Seoul` 이라 ORM datetime 이
naive KST 다. 카운터의 `hour` 는 UTC 이므로 경계에서 `to_utc_naive()` 로 한 번 변환한다.
직접 SQL 로 질의할 때 이 차이를 잊으면 **모든 창이 9시간 밀린다.**

## 계측 배포 검증 (2026-08-27, 에이전트 실측)

계측 사슬이 프로덕션에서 끝까지 동작함을 확인했다. 배포 커밋 `bc869579`,
워크플로 실행 `33032464561`(workflow_dispatch — push 경로는 경로 필터에 걸려
`deploy-oci` 가 skip 됐다).

| 확인 | 결과 |
|---|---|
| 마이그레이션 | `todos 0033_notification_settings_absorb_legacy` `[X]`, `authmetrics 0001_initial` `[X]` |
| CI 스모크 | `attempt 1: /health/ 200, /ready/ 200, frontend 200` → `SMOKE OK` |
| 이벤트 기록 | 익명 `/auth/user/`(401) → `auth / none / auth_user / client=web` |
| 원인 분류 | 손상 refresh(401) → `refresh_401 / refresh-redemption / cause=malformed` |
| 클라이언트 분류 | `X-Client: web` 과 `shell` 이 각각 그대로 기록됨 (작업 1 CORS + 작업 2 분류기 동시 성립) |
| 집계 | `aggregate_pending()` → `FOLDED=3`, `PENDING_AFTER=0`, `COUNTERS=3` |
| **시간대** | 서버 로컬 11시(KST)의 이벤트가 카운터에 **`hour=2`(UTC)** 로 기록됨 |
| 세대 CAS | `GEN=0->1`, 로그아웃을 걸친 발급 `STRADDLE_REFUSED=True` (프로덕션 Redis) |

**시간대 항목이 특히 중요하다.** `to_utc_naive()` 경계 변환이 없으면 모든 롤링 창이
9시간 밀려 롤백 판정이 엉뚱한 시간대를 본다. `hour=2` 는 그 변환이 프로덕션에서 실제로
작동한다는 증거다.

celery beat 는 2분 주기로 `authmetrics.aggregate_auth_events` 를 보내고 worker 가
받는 것을 로그로 확인했다. 배포 직후 두 실행(11:16, 11:18)이 `0` 을 반환한 것은 그
시점에 이벤트가 아직 없었기 때문이며(프로브는 11:20), 직접 실행하니 3건 전부 접혔다.

---

## refresh 상환이 100% CSRF 403 이었다 (2026-08-30 실측, 수정·배포)

H1 판정 뒤 실기기 시험을 하다 드러났다. 프로덕션 이벤트를 열어 보니 **성공한 refresh
상환이 한 건도 없었다.**

```
refresh_401 / refresh-redemption  fail  status=403  cause=csrf   ← 예외 없이 전부
auth        / cookie-access-jwt   success status=200             ← 바로 뒤에 성공
```

### 원인

`cookie_views.CookieTokenRefreshView` 는 **refresh 쿠키가 보이면** CSRF 를 검사하고,
쿠키가 없을 때만 본문 토큰으로 폴백했다. 그런데 셸은 **둘 다** 보낸다 —
저장 토큰을 본문에 담고, `sharedCookiesEnabled` + `credentials: 'include'` 때문에
네이티브 `fetch` 가 refresh 쿠키까지 자동 첨부한다.

네이티브 `fetch` 에는 `Origin` 도 `Referer` 도 없다. Django 의 CSRF 검사는 그 요청에
대해 **절대 통과할 수 없다.** 그래서 본문 토큰은 읽히지도 못한 채 403 이 됐다.

웹은 다르다. `X-CSRFToken` 을 보내고 `CSRF_TRUSTED_ORIGINS` 에 `https://maeil1dok.app`
이 있어 통과한다. 계약 테스트의 `쿠키단독+유효헤더 → 200` 케이스가 그것을 증명한다.

### 결과

세션이 **1시간짜리 access 쿠키로만** 버텼다. 그 뒤에는 갱신이 불가능하므로 로그아웃된다.
사용자가 겪던 "로그인이 풀린다" 의 실제 근인으로 보인다 — `clearAll()` 제거는 그 뒤의
피해(유효한 쿠키까지 파괴)를 줄였을 뿐 갱신 자체는 막혀 있었다.

**같은 날 실기기 재시작 시험(Android 3회, iOS 4회)이 통과한 것도 이것으로 설명된다.**
로그인 후 1시간 안에 했으므로 access 쿠키가 살아 있었고, **refresh 경로는 한 번도
실행되지 않았다.** 통과가 아니라 시험이 일어나지 않은 것이다.

### 수정

본문에 토큰을 제시한 요청은 CSRF 대상에서 뺀다. CSRF 가 막는 것은 브라우저의 주변
권한(쿠키)으로 공격자가 요청을 일으키는 것인데, 공격자는 `HttpOnly` refresh 쿠키를
읽을 수 없어 그 본문을 만들 수 없다. **쿠키 단독 상환의 보호는 그대로 둔다.**

반대 설계(쿠키 값을 쓰되 본문 토큰으로 CSRF 만 면제)는 거부했다 — 공격자가 자기 소유의
유효한 토큰으로 검사를 면제시키고 피해자의 쿠키를 회전시킬 수 있다.

우선순위가 쿠키→본문에서 **본문→쿠키**로 뒤집혔다. 두 번째 이유가 있다: 쿠키 우선은
셸의 낡은 저장 토큰을 쿠키 뒤에 숨겨 **북극성 신호(`refresh_401{cause=blacklisted}`)가
영원히 뜨지 않게** 했다.

로그아웃도 같은 병이었다(`cookie_logout` 도 쿠키가 있으면 CSRF 검사). 본문이 없어 서버로는
못 풀고, 셸이 공유 쿠키 저장소의 `csrftoken` 을 헤더로 싣도록 고쳤다 — 다음 스토어 빌드로 간다.

### 시간대 함정 (이번에 나를 속인 것)

`OutstandingToken.created_at` 은 **UTC** 로 저장되는데(simplejwt 내부가 UTC 사용)
`timezone.now()` 는 **KST** 를 반환한다(`USE_TZ=False`, `TIME_ZONE=Asia/Seoul`).
같은 DB 의 두 시각이 **9시간 어긋난다.** 임시 질의로 토큰 나이를 계산하다 547분을
얻어 계정 판정을 잘못할 뻔했다.

**우리 코드는 영향받지 않는다** — `OutstandingToken` 은 simplejwt 내부에서만 쓰이고,
`refresh_age_seconds` 는 JWT `iat` 와 `time.time()`(둘 다 UTC epoch)으로 계산한다.
다만 **애드혹 질의를 쓸 때는 반드시 이 차이를 기억할 것.**

---

## 롤업 쿼리 (작업 7 — 에이전트, 2026-08-29 프로덕션 실행)

게이트가 읽는 네 질의를 여기 고정한다. **요청 비율 기반 게이트는 금지한다** — 한 기기가
재시도로 요청을 부풀리면 코호트가 통째로 왜곡된다. 분모는 항상 명시된 것만 쓴다.

```python
from datetime import timedelta
from django.db.models import Sum
from authmetrics.models import AuthMetricCounter, EventKind, Outcome, AgeBucket
from authmetrics.recording import utc_now_naive

today = utc_now_naive().date()
base = AuthMetricCounter.objects.filter(day__gte=today - timedelta(days=7))
def total(**f):
    return base.filter(**f).aggregate(t=Sum("count"))["t"] or 0

# (a) 북극성 — 30일 미만 자격증명으로 성공한 인증의 비율
a_num = total(event=EventKind.AUTH, outcome=Outcome.SUCCESS, age_bucket=AgeBucket.LT_30D)
a_den = total(event=EventKind.AUTH, outcome=Outcome.SUCCESS)

# (b) 로그인 성공률 — 분모는 로그인 "시도"
b_num = total(event=EventKind.LOGIN, outcome=Outcome.SUCCESS)
b_den = total(event=EventKind.LOGIN)

# (c) 인증 401률
c_num = total(event=EventKind.AUTH, status=401)
c_den = total(event=EventKind.AUTH)

# (d) 클라이언트 코호트 크기
d = list(base.values("client").annotate(t=Sum("count")).order_by("-t"))
```

**실행 결과 (2026-08-29, 최근 7일, 프로덕션)**

| 질의 | 값 |
|---|---|
| (a) 북극성 | `0 / 132` |
| (b) 로그인 성공률 | `4 / 6` |
| (c) 인증 401률 | `70 / 204` |
| (d) 코호트 | 실행 시점 **질의 실패** → 수정·배포 후 성립 (아래 참조) |

### (a) 가 0 인 것은 결함이 아니다

`age_bucket` 은 **refresh 상환 경로에서만** 실제 나이를 안다. 쿠키·헤더 access-JWT 인증은
자격증명 발급 시각을 알 수 없어 `unknown` 으로 들어간다. 따라서 현재 분모 132 는 거의 전부
access-JWT 경로이고 `lt_30d` 는 0 이 맞다. **북극성을 이 분모로 읽으면 안 된다** —
`method=refresh-redemption` 으로 좁혀야 의미가 생긴다. 셸 코호트가 식별되기 전(H2)까지는
이 지표를 판정에 쓰지 않는다.

### (d) 는 카운터에서 답할 수 없었다 — 실측으로 드러난 결함

2026-08-29 프로덕션 실행에서 (d) 만 실패했다. 원인은 **`client` 가 카운터 grain 에 없고
아웃박스에만 있었다**는 것이다. 아웃박스는 집계 후 배수되고 보존 기한이 지나면 삭제되므로,
며칠 뒤에 묻는 코호트 질문에 **구조적으로 답할 수 없는** 상태였다.

더 나쁜 것은 손실이었다. grain 에 `client` 가 없으면 **서로 다른 클라이언트의 이벤트가
같은 카운터 행으로 접힌다** — 회귀 테스트가 `1 != 2` 로 이것을 잡았다
(`tests.test_auth_metrics_store.ClientCohortSurvivesAggregationTests`).

`authmetrics/migrations/0002_counter_client_dimension.py` 가 expand-only 로 컬럼을 더하고
grain 유니크 제약을 새로 건다. 기존 행은 `client=''` 로 남으므로 충돌하지 않는다.

**배포 직전 아웃박스 스냅샷** (이 값은 배포 후 카운터에서 계속 읽을 수 있어야 한다):

| client | 건수 |
|---|---|
| `unknown` | 208 |
| `shell` | 2 |
| (빈 값) | 2 |
| `web` | 1 |

`unknown` 이 압도적인 것은 **H2(식별 문자열 실측)가 아직 안 끝났기 때문**이며 의도된 상태다
(`SHELL_UA_PATTERNS` 를 비워 둔 채 추측하지 않는다). H2 완료 전 코호트 비율은 판정에 쓰지 않는다.

**배포 후 실측 (2026-08-29, 실행 `33244274160`)**

`0002_counter_client_dimension` 이 프로덕션에 적용됐다(`[X]`). 기존 카운터 행은 기본값
`client=''` 로 backfill 되므로 **소급 분해는 되지 않는다** — 배포 시점 이전 구간의 코호트는
영구히 알 수 없고, 그 구간을 코호트 게이트에 쓰면 안 된다.

새 이벤트는 갈린다. `X-Client: web` 두 번과 `X-Client: shell` 한 번을 프로덕션에 보내고
집계한 결과:

| client | count |
|---|---|
| (빈 값, 배포 전 누적) | 132 |
| `web` | 2 |
| `shell` | 1 |

세 프로브가 `web=2` · `shell=1` 로 정확히 갈렸다. 수정 전이었다면 grain 이 같아
**단일 행 `3` 으로 접혔을** 값이며, 이것이 이 결함이 단순 누락이 아니라 손실이었다는
직접 증거다.

---

## 식별 문자열 실측 (작업 2 — 사람)

작업 2 의 `client` 분류기는 `X-Client` 헤더가 없는 구버전 셸을 User-Agent 로 판정한다.
iOS 웹뷰 / Android 웹뷰 / iOS 네이티브 / Android 네이티브는 **서로 다른 시그니처**를 가지므로
하나만 보고 만들면 나머지 셋이 조용히 `unknown` 으로 새어 코호트 지표가 왜곡된다.

**이 채집이 끝나기 전에는 베이스라인 수집을 시작하지 않는다.**

| # | 대상 | 관측된 User-Agent | 채집자 | 날짜 |
|---|---|---|---|---|
| 1 | iOS 웹뷰 문서 로드 | (미기록) | | |
| 2 | Android 웹뷰 문서 로드 | (미기록) | | |
| 3 | iOS 네이티브 `fetch` | (미기록) | | |
| 4 | Android 네이티브 `fetch` | (미기록) | | |

절차: 실기기에서 (a) 웹뷰 문서 로드, (b) 셸의 네이티브 `fetch`(로그아웃 또는 상환)를 각각 1회
발생시키고, 서버 로그의 `ua` 필드 값을 위 표에 그대로 붙인다.

## 배포 전 베이스라인 7일 (작업 3 완료 후 — 에이전트)

작업 1·2·3 이 배포되고 분류기가 실측값으로 완성된 뒤 7일간 축적한다.
**일별 값을 스냅샷으로 고정하고 이후 재계산하지 않는다** — 나중에 다시 계산하면
같은 데이터로 다른 결론이 나온다.

| 날짜(UTC) | 로그인 시도 | 로그인 성공 | 성공률 | 인증 요청 | 인증 401 | 401률 |
|---|---|---|---|---|---|---|
| (미수집) | | | | | | |

7일 평균: 로그인 성공률 `—` / 인증 401률 `—`

## 쿠키 영속성 검증 (작업 8 — 사람)

**평소 쓰는 앱으로 하면 안 된다.** 현재 앱에는 고치려는 그 버그가 있어서, 그냥 24시간을 돌리면
버그로 인한 로그아웃을 "기기가 로그인 정보를 보관하지 못한다"로 잘못 읽게 된다.
`eas.json` 의 `diagnostic` 프로필로 빌드한 **확인 전용 앱**을 담당자 기기에만 설치해 관찰한다.

| 기기 | OS | 시작 시각 | 24시간 후 로그인 유지 | 판정 | 기록자 |
|---|---|---|---|---|---|
| (미기록) | | | | | |

## 호환 격리 테스트 (6-b — 사람)

네 조합을 **각각** 판정한다. 두 번째 조합(신 셸 + 옛 웹)은 브라우저에 옛 화면이 남은 사용자에게
실제로 생길 수 있는 상태인데 다른 실기기 검증으로는 시험되지 않는다.

| # | 조합 | 로그아웃 | 재시작 | 판정 | 기록자 |
|---|---|---|---|---|---|
| a | 신 셸 + 신 웹 | | | | |
| b | 신 셸 + 옛 웹 | | | | |
| c-1 | 옛 셸 + 신 웹 | | | | |
| c-2 | 옛 셸 + 신 웹, 로그인 흔적 삭제 상태 | | | | |

## 애플 계정 전환 예외 승인 (4-b — 사람)

"다른 계정으로 로그인" 에서 계정 선택 화면이 실제로 뜨는지는 제공자마다 다르다.
구글만 보장되고, 카카오는 최선 노력, **애플은 기술적 방법이 없어 예외**다.
배포를 다 한 뒤에 승인이 나지 않으면 되돌려야 하므로 **배포 전에** 받는다.

| 항목 | 값 |
|---|---|
| 승인자 | (미기록) |
| 승인 날짜 | |
| 승인 범위 | 애플 로그인에서 계정 전환 화면을 제공하지 않는 것 |

## 스토어 제출 자격 (S1-b — 사람)

작업 5 가 (3-b)로 판정되어 스토어 경로를 타는 경우에만 필요하다.
**S2 의 내부 트랙 업로드 자체가 제출 자격을 요구**하므로 S2 보다 먼저 끝낸다.

| # | 항목 | 확인 방법 | 결과 | 기록자 |
|---|---|---|---|---|
| i | iOS 제출 자격(`appleId`·`ascAppId`·`appleTeamId`) | ASC API 키로 `GET /v1/apps?filter[bundleId]=<번들ID>` 읽기 전용 조회 → 응답 앱 id 가 `ascAppId` 와 같은지 | | |
| ii | Android 서비스 계정 키 배치 + 제출 프로필 분리 | `submit.internal` / `submit.production` 유효성 | | |
| iii | 제출 대상 앱이 현재 배포된 그 앱인지 | 두 플랫폼 식별자 대조 | | |

`npx eas submit` 으로 자격을 검증하지 않는다 — 인증만 확인하는 모드가 없어 실제로 제출되거나
아티팩트 없이 실패한다. `eas credentials` 도 쓰지 않는다(대화형이며 변경을 일으킬 수 있다).

## 부분 실패 기록

배포·검증 중 일부만 성공한 경우 **남는 상태와 취한 조치**를 남긴다.
"실패했다"만 적으면 다음 사람이 현재 상태를 알 수 없다.

| 날짜 | 무엇이 실패했나 | 남는 상태 | 조치 |
|---|---|---|---|
| (없음) | | | |

## 승격과 도달 확인 (8단계 — 사람)

> **2026-08-29 (2차) — 가정이 실측으로 대체됐다. 아래 '도달 실측' 절을 본다.**
> Android 는 에뮬레이터에서 **도달이 확정**됐고, iOS 는 **사상 첫 업데이트가 게시**됐다.
> 남은 미확정은 **스토어 바이너리의 런타임**뿐이며 실기기로만 답할 수 있다.

> ~~2026-08-29 — H1 을 (3-a) 로 가정하고 후속 작업을 진행했다 (사용자 지시).~~
> ~~실기기 검증은 수행되지 않았다.~~ 아래 표는 여전히 비어 있으며, 이 가정은 **셸 OTA 를
> 실제로 게시하기 전에 반드시 실측으로 대체해야 한다.** 가정이 틀렸다면(=OTA 미도달)
> 셸 변경(작업 9·11·36 셸부분·38 과 이번 작업 5 관측면)은 **스토어 제출로만** 나갈 수 있고
> H7(제출 자격)이 선행 조건이 된다. 서버·웹 변경은 이 가정과 무관하게 이미 유효하다.
>
> 가정을 실측으로 바꾸는 비용은 낮아졌다 — 이번 변경이 `Updates.updateId` 를 **콘솔 1줄과
> 로그인 화면 하단** 두 곳에 노출하므로, 종전의 "관측 수단이 없어 확인 자체가 불가능"
> (게이트 M49 MAJOR) 순환이 해소됐다.

| 항목 | 값 |
|---|---|
| 검증한 업데이트 그룹 id | (미기록 — H1 가정 처리) |
| 재게시로 생긴 새 그룹 id | |
| 내용 일치 확인 방법 | |
| 대표 기기 도달 확인 | **가정 (3-a), 실기기 미검증** |

**`eas update` 는 새 번들을 새로 게시한다** — 검증한 그 그룹이 아니라 다시 번들한 다른 내용이
나갈 수 있으므로 `update:republish` 로 승격하고, 재게시가 **새 그룹 id 를 만든다**는 사실을
전제로 내용 일치를 따로 확인한다.

## 도달 실측 (2026-08-29, 에이전트 — 에뮬레이터 + 서버 질의)

### 게시 전 상태 — iOS 는 OTA 를 한 번도 받은 적이 없었다

업데이트 서버(`u.expo.dev/d5d66055-...`)에 프로토콜 헤더로 직접 질의했다.
기기 없이, 코드 추측 없이 답이 나온다.

| runtime | platform | 응답 | 매니페스트 |
|---|---|---|---|
| 1.2.2 | android | 200 | **있음** (6038 B) — 2026-08-24 게시분 |
| 1.2.2 | ios | 200 | **없음** (0 B) |
| 1.2.1 | ios / android | 204 | 없음 |
| 1.0.4 | ios / android | 204 | 없음 |

**즉 iOS 에는 게시된 업데이트가 존재하지 않았다.** 2026-08-24 의 `hasena 첫 진입 에러`
수정은 **Android 에만** 나갔다. iOS 에서 "OTA 로 고쳤다"고 믿은 것이 있었다면 전부
거짓이다 — 받을 것이 없었다.

### 게시 후 — 양 플랫폼 매니페스트 성립

```
rt=1.2.2 ios      http=200 bytes=6134 id=01a04cda-e039-7ac6-bf29-c637e1c2172d
rt=1.2.2 android  http=200 bytes=6134 id=01a04cda-099c-7127-9b82-620ca2fd6b3b
rt=1.2.1 ios/and  http=204
```

| 항목 | 값 |
|---|---|
| 업데이트 그룹 (android) | `a3b959bd-df3b-4aa9-8756-e6ee13736d97` |
| 업데이트 그룹 (ios) | `12d1f021-d324-4d3f-b0b5-df0bf7ba7624` |
| 게시 커밋 | `fa7de57d01ac2f3432af7ac1c048344ad3da9942` |
| 게이트 | `publish-ota.mjs --requires-web 2c9201da...` → `web marker OK` |

### Android 도달 확정 (3-a)

에뮬레이터(`Medium_Phone_API_36.1`)에 런타임 `1.2.2` · 채널 `production` 로컬 릴리스
빌드를 설치하고 콜드스타트 2회를 관측했다.

```
1차  [BundleIdentity] updateId=251d5f1a-... embedded=true  runtime=1.2.2 channel=production
     dev.expo.updates: NEW_UPDATE_LOADED / isUpdateAvailable=true isUpdatePending=true
2차  [BundleIdentity] updateId=01a04cda-099c-7127-9b82-620ca2fd6b3b embedded=false
```

2차 실행의 `updateId` 가 **게시한 그 ID 와 정확히 일치**한다. 게시 → 다운로드 → 적용
사슬 전체가 성립한다.

### iOS 도달 확정 (3-a, 시뮬레이터)

iOS 는 **게시 이력 자체가 없던** 쪽이므로 별도로 확인했다. `iPhone 17` 시뮬레이터에
런타임 `1.2.2` · 채널 `production` 릴리스 빌드를 설치하고 콜드스타트 2회를 관측했다.

첫 시도는 **적용되지 않았다** — 로컬 빌드를 게시보다 나중에 만들어 임베디드 번들이
게시분보다 최신이었기 때문이다(적용 대상 아님). 이것은 도달 실패가 아니라 **측정 설계
오류**이며, 스토어 바이너리에는 해당하지 않는다(그쪽 임베디드는 항상 더 오래됐다).
빌드 후 다시 게시하고 반복했다.

```
업데이트 저장소  .../Library/Application Support/.expo-internal/expo-v11.db
id                                status  last_accessed
01a04ce6484c7bf1ac212fb0b665666d  1       2026-08-29 18:42:26   ← 게시분, 최신 구동
eda9a39ac67644ec9bc4f267d58b7bb2  1       2026-08-29 18:42:25   ← 임베디드
```

게시한 iOS update ID `01a04ce6-484c-7bf1-ac21-2fb0b665666d` 가 **다운로드되고 실제로
구동됐다**. 업데이트 그룹 `980e86c6-528c-4a92-88bf-bbd7c09098ca`, 커밋 `6efb3ee7`.

> iOS 릴리스 빌드는 JS `console.log` 를 시스템 로그로 넘기지 않아 `[BundleIdentity]`
> 줄이 콘솔에 안 보인다. 그래서 판정을 업데이트 저장소 DB 로 했다. **로그인 화면 하단
> 표시는 그대로 동작하며 실기기 판정 수단은 그쪽이다** — 두 관측 수단을 둔 이유가 이것이다.

### H1 판정 = (3-b) 도달 실패 — 근본원인은 런타임이 아니라 **채널 부재**

실기기(iOS, 스토어 설치본)에서 계정 설정 하단이 **`앱 구버전 — 업데이트 미도달`** 로
나왔다. 즉 앱 안이지만 새 셸이 아니다. 런타임 후보를 좁히려 `1.2.1` 로도 게시했으나
결과는 동일했다.

원인은 런타임이 아니었다. 업데이트 서버에 **채널 헤더 없이** 물어보면 이렇게 답한다.

```
$ curl -H 'expo-protocol-version: 1' -H 'expo-platform: ios' \
       -H 'expo-runtime-version: 1.2.1' -H 'accept: multipart/mixed' \
       https://u.expo.dev/<projectId>
HTTP 400
"channel-name": Required. The headers "expo-runtime-version",
"expo-channel-name", and "expo-platform" are required.
```

그리고 이 프로젝트에 존재하는 채널은 **`production` 하나뿐**이다(`eas channel:list`).

**`expo prebuild` 는 채널을 심지 않는다.** 채널 주입은 EAS Build 가 하는 일이다.
실측 증거 둘: (1) 2026-08-29 에 새로 돌린 prebuild 의 `ios/app/Supporting/Expo.plist`
에 `EXUpdatesRequestHeaders` 가 **없어서** 도달 시험을 하려고 손으로 넣어야 했다.
(2) 스토어 빌드의 출처인 낡은 로컬 `ios/` 의 `Expo.plist`(런타임 `1.2.1`)에도 **없었다**.

**그리고 그 로컬 빌드 경로가 리포에 있다** (2026-08-29 추가 실측 — 처음엔 `eas build:list`
가 비었다는 간접 추론만 댔는데, 직접 증거가 나왔다).

`mobile/scripts/build.sh` 는 빌드할 때 이렇게 묻는다.

```
빌드 환경 선택:
  1) 클라우드 (EAS Build)
  2) 로컬              <- 이걸 고르면 채널 없는 바이너리가 나온다
```

`2` 를 고르면 `run_prebuild()` 가 `npx expo prebuild --clean` 을 돌리고 `build_local()` 이
Android 는 `./gradlew bundleRelease`, iOS 는 `open ios/*.xcworkspace`(Xcode 에서 손으로
Archive)를 한다. **prebuild·gradlew·Xcode 어느 것도 채널을 심지 않는다.**

보강 증거 둘:

- **리포에 로컬 서명 자격증명이 있다** — `credentials/android/keystore.jks`,
  `credentials/ios/dist-cert.p12`, `credentials/ios/profile.mobileprovision`.
  EAS 클라우드 빌드만 썼다면 필요 없는 것들이다(EAS 가 자격을 관리한다).
- **`build.sh:update_app_json()` 이 `version`·`versionCode`·`buildNumber` 를 `sed` 로 직접
  박는다.** `app.json` 에 `buildNumber: "3"`, `versionCode: 8` 이 손으로 적혀 있는 이유다.

`eas build:list` 가 2026-01 의 `1.0.1` 에서 멈춘 것은 이 그림의 결과이지 근거가 아니다.

### 버전 소스가 이중화돼 있다 (같은 뿌리의 두 번째 결함)

`build.sh` 는 `app.json` 을 직접 고치는데 `eas.json` 은 `appVersionSource: remote` 라
**EAS 는 그 값을 무시한다**(`eas build:version:get` 이 경고까지 출력한다). 두 워크플로가
서로 다른 버전 소스를 본다.

| 소스 | Android versionCode |
|---|---|
| `app.json` (build.sh 가 sed 로 갱신) | **8** |
| EAS 원격 카운터 | **16** |
| 실기기에 설치돼 있던 앱 | **17** |

세 값이 전부 다르다. 새 스토어 빌드 전에 반드시 맞춰야 한다(인계 H8 런북 3단계).

**결론: 현재 스토어 바이너리는 업데이트 확인 때마다 400 을 받는다. 어떤 런타임으로
게시해도 도달하지 않는다. OTA 경로는 이 바이너리에 대해 폐기다.**

#### 따라서 셸 변경의 배포 경로

셸 수정(작업 9·11·36 셸부분·38, 번들 신원 노출)은 **새 스토어 빌드로만** 나갈 수 있다.
그 빌드는 **채널을 반드시 실어야** 한다.

- 권장: `eas build --profile production --platform <p>` — `eas.json` 의
  `production.channel = "production"` 을 EAS 가 바이너리에 심는다.
**[2026-08-29 정밀화 — 위험한 것은 "로컬 빌드"가 아니다]** `eas build --local` 을 실제로
돌려 보고 갈렸다. 그 빌드 로그에 이 줄이 있다.

```
[PREPARE_CREDENTIALS] Injecting signing config into build.gradle
[CONFIGURE_EXPO_UPDATES] Setting the update request headers in 'AndroidManifest.xml'
                          to '{"expo-channel-name":"production"}'
```

**`--local` 은 EAS 빌드 파이프라인을 이 맥에서 돌리는 것이므로 채널을 심는다.** 클라우드
크레딧도 쓰지 않는다. 사고를 낸 것은 로컬 빌드 자체가 아니라 **EAS 파이프라인을 거치지 않은
생짜 빌드** — `build.sh:build_local()` 의 `gradlew` 직접 호출과 Xcode Archive 다.

| 경로 | 채널 | 서명 | 클라우드 크레딧 |
|---|---|---|---|
| `eas build` (클라우드) | 심긴다 | EAS 원격 자격 | **소모** |
| **`eas build --local`** | **심긴다** | `credentials.json` | **미소모** ← 이 프로젝트의 경로 |
| `expo prebuild` + `gradlew`/Xcode | **안 심긴다** | 직접 설정해야 함 | 미소모 ← **사고 원인** |

- 세 번째 경로는 이제 **채널을 자동으로 심는다**. `build.sh` 의 `run_prebuild()` 가
  prebuild 직후 `scripts/inject-update-channel.mjs` 로 채널을 넣고
  `scripts/verify-store-artifact.mjs --native` 로 확인하며, Android 산출물은 빌드 직후에도
  검증한다(채널이 없으면 `exit 1` 로 멎는다). iOS 는 Xcode 로 Archive 하므로 산출물을
  스크립트가 볼 수 없어, 제출 전에 `npm run verify:store -- --artifact <경로.ipa>` 를
  직접 돌리라고 안내한다.
- 그래도 **`eas build --local` 을 권장한다.** Expo 유료 구독이 없어 클라우드 빌드는 이
  프로젝트의 경로가 아니고, `--local` 이 크레딧 없이 같은 보장을 준다. 자동 주입은 이 리포의
  스크립트를 거칠 때만 동작하므로 Xcode 나 gradlew 를 직접 부르면 우회된다.

그 빌드가 스토어에 올라간 뒤에는 **이미 게시된 업데이트들이 그대로 적용된다** —
`production` 채널 `1.2.2` 에 Part A 셸이 올라가 있다.

#### Android 도 같은 상태로 보아야 한다

`eas build:list` 에 Android 1.2.x 프로덕션 빌드도 없고, 낡은 로컬 `android/` 는
`versionName 1.0.4` 였다. 2026-08-24 게시분(runtime 1.2.2)이 **Android 실기기에
도달했다는 증거는 어디에도 없다.** 같은 절차로 확인해야 한다.

### 새 스토어 빌드의 선행 위험 — 버전 카운터가 거꾸로다 (실측)

`eas.json` 이 `appVersionSource: remote` 라서 buildNumber/versionCode 를 EAS 원격 카운터가
관리하는데, 마지막 EAS 프로덕션 빌드가 2026-01 의 `1.0.1` 이라 카운터가 그 시점에 멈춰 있다.

| 값 | 실측 |
|---|---|
| EAS 원격 iOS `buildNumber` | **10** (`eas build:version:get`) |
| EAS 원격 Android `versionCode` | **16** (`eas build:version:get`) |
| 로컬 에뮬레이터에 설치돼 있던 앱 | **versionCode 17** (`INSTALL_FAILED_VERSION_DOWNGRADE: Update version code 8 is older than current 17`) |
| iOS 스토어 공개 버전 | **1.2.2** (App Store 조회) |

**원격 카운터가 실제 배포분보다 낮다.** 그대로 `eas build` 하면 versionCode 17 이 나오는데
그 값이 이미 쓰였다면 Play 가 업로드를 거부한다. 새 빌드 전에 두 스토어의 현재 값을 확인하고
`eas build:version:set` 으로 올려야 한다. 절차는 인계 문서 H8 런북 3단계.

### 참고 — 게시 이력 (모두 도달하지 못했다)

| 플랫폼 | runtime | update ID | 비고 |
|---|---|---|---|
| android | 1.2.2 | `01a04d10-c30e-7eb8-b1a5-7e753f68567f` | Part A 셸 |
| ios | 1.2.2 | `01a04d11-2155-7b8b-8d63-4154b8e11ad5` | Part A 셸 |
| ios | 1.2.1 | `01a04d18-6ec5-7b8a-a855-86197b38f0c2` | 런타임 후보 탐색 |

### 시뮬레이터·에뮬레이터에서는 왜 도달했나

우리가 **채널을 직접 심어서** 빌드했기 때문이다. 그 실험이 증명한 것은 "게시→다운로드
→적용 사슬이 정상"이라는 것이고, **스토어 바이너리가 그 사슬에 올라타 있다는 것은
증명하지 못했다.** 그 차이가 이번 판정의 전부다.

---

### (이전 절) 스토어 바이너리의 런타임

에뮬레이터·시뮬레이터는 **우리가 런타임을 정해서 빌드**하므로 스토어에 깔린 바이너리의
런타임을 증명하지 못한다. 로컬 `mobile/ios`·`mobile/android` 는 gitignore 된 prebuild
잔여물이었고 각각 `1.2.1` · `1.0.4` 에서 멈춰 있어 **증거가 되지 못한다**(재생성 후 1.2.2).

따라서 남은 판정은 하나다: **스토어 앱의 런타임이 1.2.2 인가.**
`1.2.2` 이면 방금 게시분이 도달하고, 아니면 도달하지 않는다.
실기기 절차는 인계 문서 H1 을 본다 — 이제 관측면이 있어 30초면 끝난다.

---

## 롤백 판정 기록 (§4)

판정 규칙(계획서 §4 확정본):

- **비교 기준** — 배포 전 7일 베이스라인의 일별 값 평균(위 스냅샷, 재계산 금지)
- **평가 창** — UTC 정시 경계로 정렬된 겹치지 않는 6시간 창 4개(`00-06`·`06-12`·`12-18`·`18-24`)
- **부분 창** — 배포 시각을 포함하는 창은 **판정하지 않고 기록만** 한다. 배포 이후 처음 오는
  완전한 창부터 판정한다(예: 03:30 배포면 `06-12` 가 첫 판정 창)
- **최소 분모** — 로그인 성공률은 시도 30건 이상, 401률은 인증 요청 200건 이상. 미달 창은
  판정하지 않고 기록만 한다(0/0 을 악화로 읽지 않는다)
- **연속 조건** — 분모를 충족한 창에서 임계값 초과가 **연속 2회**(=인접 두 창, 12시간)면 롤백
- **즉시 롤백** — 401률이 베이스라인 대비 **+5%p** 를 넘으면 분모만 충족하면 **1회로** 롤백
- 임계값: 로그인 성공률 **-2%p**, 인증 401률 **+1%p**

| 창(UTC) | 로그인 시도 | 성공률 | Δ | 인증 요청 | 401률 | Δ | 분모 충족 | 판정 |
|---|---|---|---|---|---|---|---|---|
| (없음) | | | | | | | | |
