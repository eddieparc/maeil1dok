# 현재 인가 모델 인벤토리

> 조사 기준: 2026-08-26 현재 작업 트리의 프로덕션 URLConf, DRF view, 모델, 전역 설정을 정적으로 읽고 Django resolver로 교차 확인했다. 이 문서는 **현재 동작의 기술**이지 원하는 정책의 선언이 아니다. `추정` 표시는 코드만으로 제품 의도를 확정할 수 없는 항목에만 붙였다.

## 0. 범위와 계수 재확인

### 0.1 출발점의 숫자는 그대로는 엔드포인트 수가 아니다

`path(`의 텍스트 출현을 세면 제시된 `todos 82 + accounts 47 + config 10 + bible_cache 4 = 143`이 재현된다. 그러나 `config/urls.py`의 10건 중 3건은 모듈 docstring 안의 Django 사용 예이고, 등록된 패턴이 아니다. 반대로 `todos`의 `DefaultRouter`가 만드는 23개 논리 라우트 이름은 이 텍스트 계수에서 빠진다. 근거는 `backend/config/urls.py:4-15,21-28`, `backend/todos/urls.py:5-13`, router 결과를 고정한 `backend/tests/test_route_authorization_coverage.py:61-154,182-212`다.

| 측정 대상 | 관측값 | 해석 |
|---|---:|---|
| `todos/urls.py`의 `path()` 호출 | 82 | 직접 API path 81개 + `include(router.urls)` mount 1개 (`backend/todos/urls.py:13-116`) |
| `accounts/urls.py`의 `path()` 호출 | 47 | 직접 API path 47개 (`backend/accounts/urls.py:7-97`) |
| `config/urls.py`의 문자열 `path(` 출현 | 10 | 실제 pattern 7개 + docstring 예제 3개 (`backend/config/urls.py:4-15,21-28`) |
| `bible_cache/urls.py`의 `path()` 호출 | 4 | 직접 API path 4개 (`backend/bible_cache/urls.py:4-24`) |
| 직접 선언된 앱 API URL 템플릿 | 132 | todos 81 + accounts 47 + bible_cache 4 |
| router가 추가하는 논리 URL 템플릿 | 23 | API root 1 + 5개 ViewSet의 list/detail/action 22 (`backend/todos/urls.py:5-13`, `backend/todos/views.py:1172-1258,3447-3805`) |
| 이 문서가 다루는 논리 API URL 템플릿 | **155** | 이름은 154개. `reading/`과 `reading/update/`가 같은 `update_bible_progress` 이름/콜백을 공유한다 (`backend/todos/urls.py:21-22`). |
| resolver에 등록되는 API `URLPattern` | **225** | `/auth/`와 `/accounts/`에 같은 47개 account URL이 각각 mount되고, `DefaultRouter`의 format-suffix 변형도 등록된 결과 (`backend/config/urls.py:25-28`, `backend/todos/urls.py:5-13`). |

따라서 아래 표는 사실이 아닌 143이라는 경계를 맞추기 위해 router endpoint를 버리지 않는다. **실제 논리 라우트 이름 154개와 URL alias 1개를 전부 포함**한다. accounts의 각 항목은 동일 콜백이 두 prefix에 mount되므로 한 번만 적고, router format-suffix 변형은 같은 인가 규칙이므로 별도 endpoint로 중복 기재하지 않는다.

### 0.2 검색 출발점 재확인

정확한 원래 검색식/포함 범위가 없어서 `644`와 `27`은 현재 tracked source에서 재현되지 않았다.

- tracked 전체에서 exact-word `permission_classes|has_perm|is_staff|is_superuser|role`은 197개 **matching line**, tracked Python만 보면 185개 line이었다.
- migrations/tests를 뺀 프로덕션 Python에서는 179개 matching line이었다.
- `role`을 부분 문자열로 세거나 테스트·문서·생성물·가상환경을 포함하면 값이 크게 변하므로 644는 검색 범위 없이는 검증 가능한 기준선이 아니다.
- todos view 모듈의 소유권 후보도 단순 문자열식에 따라 9건(`created_by|owner|!= request.user`)부터 97건(`user=request.user`, relation filter까지 포함)까지 달라졌다. 아래 표는 문자열 수 대신 실제 queryset scope와 분기문을 endpoint별로 판독했다.
- 프로젝트 프로덕션 코드에서 `has_perm()` 직접 호출은 0건, `is_superuser` 직접 인가 분기는 0건이다. `is_superuser`는 API 응답의 `is_staff` 계산에만 쓰인다 (`backend/accounts/serializers.py:18-27`).

## 1. Endpoint x 현재 인가 규칙

### 표 읽는 법

- `A/…`는 **두 경로 모두**를 뜻한다: `/api/v1/auth/…`와 `/api/v1/accounts/…` (`backend/config/urls.py:25-26`).
- `T/…`는 `/api/v1/todos/…`, `B/…`는 `/api/v1/bible-cache/…`다.
- `permission_classes=[]`는 SimpleJWT의 token view가 명시적으로 빈 permission tuple을 상속한 유효 동작이다. 전역 default 의존과 다르다 (`backend/accounts/cookie_views.py:35-82`).
- `IsAdminUser`의 실제 판정 기준은 DRF 의미상 `user.is_staff`; 이 코드에는 별도 superuser 우회가 없다.
- 익명 `조건부`는 일부 HTTP method/query action만 익명에게 열리고 나머지는 inline gate가 있다는 뜻이다.

### 1.1 Accounts: 47개 논리 라우트 이름 (두 prefix에 각각 mount)

| # | endpoint (method) | `permission_classes` | view 안의 추가 인가/관계 검사 | 익명 | 근거 |
|---:|---|---|---|---|---|
| A01 | `A/token/`, `A/login/` (POST) | 상속 `[]` | 제출한 username/password를 serializer가 인증한다. | 예 | `backend/accounts/urls.py:9,17`; `backend/accounts/cookie_views.py:35-73` |
| A02 | `A/token/refresh/`, `A/refresh/` (POST) | 상속 `[]` | refresh token이 유효하고 그 token의 user가 active이며 `token_version`이 현재 값이어야 한다. cookie token이면 CSRF도 검사한다. | 유효 refresh 보유자 | `backend/accounts/urls.py:10,18`; `backend/accounts/cookie_views.py:75-171` |
| A03 | `A/logout/` (POST) | `AllowAny` | refresh cookie가 있으면 CSRF 검사 후 blacklist; 없어도 cookie 삭제. | 예 | `backend/accounts/cookie_views.py:174-207` |
| A04 | `A/csrf/` (GET) | `AllowAny` | 없음. | 예 | `backend/accounts/cookie_views.py:209-218` |
| A05 | `A/verify/`, `A/user/` (GET) | `IsAuthenticated` | 응답 대상은 `request.user` 자신. | 아니오 | `backend/accounts/cookie_views.py:221-232`; `backend/accounts/views.py:249-253` |
| A06 | `A/register/`, `A/email-register/` (POST) | `AllowAny` | 별도 기존 사용자 권한 없음; 새 계정과 기본 구독을 생성한다. | 예 | `backend/accounts/views.py:230-247,592-629` |
| A07 | `A/social-login/`, `A/social-login/v2/` (POST) | `AllowAny`, authn class `[]` | provider의 OAuth code/access/id token 검증 결과가 주체 증명이다. | provider 증명 보유자 | `backend/accounts/views.py:258-322,679-899` |
| A08 | `A/complete-kakao-signup/`, `A/complete-social-signup/` (POST) | `AllowAny`, authn class `[]` | Kakao access token 재검증 또는 서명된 signup token/provider token이 요청의 provider id와 일치해야 한다. | 해당 증명 보유자 | `backend/accounts/views.py:532-590,899-998` |
| A09 | `A/email-login/` (POST) | `AllowAny`, authn class `[]` | 제출한 identifier/password 일치 및 계정 상태 검사. | 자격증명 보유자 | `backend/accounts/views.py:631-676` |
| A10 | `A/check-username/`, `A/check-nickname/` (POST) | `AllowAny` | 없음. 존재 여부를 공개한다. | 예 | `backend/accounts/views.py:514-530` |
| A11 | `A/profile/<user_id>/`, `A/profile/<user_id>/calendar/`, `A/profile/<user_id>/achievements/` (GET) | `AllowAny` | 대상 live user의 profile이 public이거나 요청자가 대상 본인이어야 한다. 아니면 404로 숨긴다. | public profile만 | `backend/accounts/profile_views.py:28-53,143-168,194-315,514-552` |
| A12 | `A/profile/` (PUT) | `IsAuthenticated` | `request.user`의 profile만 get/create/update한다. | 아니오 | `backend/accounts/profile_views.py:168-192` |
| A13 | `A/followers/<user_id>/`, `A/following/<user_id>/` (GET) | `AllowAny` | 대상 profile은 public 또는 본인; 반환 사용자도 public profile 또는 요청자 본인으로 제한한다. | public 대상/사용자만 | `backend/accounts/profile_views.py:39-60,388-448` |
| A14 | `A/search/` (GET) | `AllowAny` | public profile 또는 요청자 본인만 후보로 삼고 요청자 자신은 결과에서 제외한다. | public profile 검색 | `backend/accounts/profile_views.py:55-60,478-512` |
| A15 | `A/follow/` (POST), `A/unfollow/<user_id>/` (DELETE) | `IsAuthenticated` | follow는 public/live 대상만, 자기 자신은 금지. unfollow는 `follower=request.user` 관계만 삭제한다. | 아니오 | `backend/accounts/profile_views.py:62-77,317-386` |
| A16 | `A/friends/` (GET) | `IsAuthenticated` | `request.user`의 상호 follow 관계만 조회하고 public profile 또는 본인으로 제한한다. | 아니오 | `backend/accounts/profile_views.py:450-476` |
| A17 | `A/reading-settings/` (GET), `A/reading-settings/update/` (PATCH) | `IsAuthenticated` | `user=request.user` 설정만 조회/수정한다. | 아니오 | `backend/accounts/profile_views.py:554-583` |
| A18 | `A/linked-accounts/` (GET), `A/account-email/` (GET/PATCH), `A/notification-settings/` (GET/PATCH), `A/oauth/link-state/` (POST), `A/link-social/` (POST), `A/unlink-social/` (POST), `A/logout-all/` (POST) | `IsAuthenticated` | 모두 현재 `request.user` 계정/설정/연동만 대상. link는 현재 user에 묶인 서명 state와 provider 증명을, unlink는 최소 한 로그인 수단 잔존을 추가 검사한다. | 아니오 | `backend/accounts/views.py:999-1099,1102-1258,1296-1311` |
| A19 | `A/set-password/` (POST) | `IsAuthenticated` | 현재 user에게 기존 password가 있으면 current password 재확인 후 변경한다. | 아니오 | `backend/accounts/views.py:1260-1294` |
| A20 | `A/merge-accounts/` (POST) | `IsAuthenticated` | 대상 계정의 password/provider proof/현재 user에 묶인 merge token 중 해당 경로의 증명을 요구한다. 다른 계정을 유지하면 현재 계정 password도 요구한다. | 아니오 | `backend/accounts/views.py:1313-1496,1533-1541` |
| A21 | `A/delete-account/` (POST) | `IsAuthenticated` | 현재 user의 password와 `confirm_delete is True`를 요구하고 현재 계정만 비활성화한다. | 아니오 | `backend/accounts/views.py:1823-1882` |
| A22 | `A/send-verification/`, `A/request-password-reset/` (POST) | `AllowAny`, authn class `[]` | 이메일 소유 증명 전에는 generic 응답만 주고 메일을 발송한다. | 예 | `backend/accounts/views.py:1609-1646,1712-1746` |
| A23 | `A/verify-email/` (POST) | `AllowAny`, authn class `[]` | 유효·미사용·미만료 email verification token이 주체 증명이다. | token 보유자 | `backend/accounts/views.py:1648-1685` |
| A24 | `A/resend-verification/` (POST) | `IsAuthenticated` | 현재 user의 미인증 email에 대해서만 재발송한다. | 아니오 | `backend/accounts/views.py:1687-1710` |
| A25 | `A/verify-reset-token/`, `A/reset-password/` (POST) | `AllowAny`, authn class `[]` | 유효·미사용·미만료 password reset token을 검사하고 해당 token user만 변경한다. | token 보유자 | `backend/accounts/views.py:1748-1820` |
| A26 | `A/session/issue/` (POST) | `IsAuthenticated` | 현재 user가 active이고 삭제 예정/병합 계정이 아니어야 하며, 현재 user id에 묶인 1회용 code를 발급한다. | 아니오 | `backend/accounts/views.py:78-80,1884-1910` |
| A27 | `A/session/consume/` (GET) | `AllowAny` | 유효·미사용 session bridge code에 묶인 eligible user에게만 cookie를 발급한다. | code 보유자 | `backend/accounts/views.py:52-80,1912-1969` |

### 1.2 Todos: 103개 논리 라우트 이름, 104개 URL 템플릿

| # | endpoint (method) | `permission_classes` | view 안의 추가 인가/관계 검사 | 익명 | 근거 |
|---:|---|---|---|---|---|
| T01 | `T/` (GET, router API root) | **전역 default `IsAuthenticated` 의존** | 없음. router의 `APIRootView`가 `APIView.permission_classes`를 그대로 사용한다. | 아니오 | `backend/todos/urls.py:5-13`; `backend/config/settings.py:216-223`; `backend/tests/test_route_authorization_coverage.py:225-230,298-305` |
| T02 | `T/bible-plans/` (GET/POST), `T/bible-plans/<pk>/` (GET/PUT/PATCH/DELETE), `…/<pk>/toggle-active/` (POST), `…/<pk>/set-default/` (POST), `…/<pk>/schedules/` (GET) | `IsAuthenticated + IsAdminUser` | 모든 동작이 staff 전용. `created_by` 소유권은 판정하지 않으며 staff는 모든 plan을 조회/변경한다. | 아니오 | `backend/todos/views.py:1172-1258` |
| T03 | `T/bible/bookmarks/`, `…/<pk>/`, `…/by-chapter/`, `…/delete-all/`; 같은 4개 형태의 `T/bible/notes/*`, `T/bible/highlights/*`; `T/bible/personal-records/`, `…/<pk>/`, `…/stats/`, `…/by-book/`, `…/dates/` | `IsAuthenticated` | 각 ViewSet queryset을 `user=self.request.user`로 제한하고 create에도 현재 user를 강제한다. | 아니오 | `backend/todos/views.py:3447-3665,3675-3805`; route 이름 `backend/tests/test_route_authorization_coverage.py:63-83,130-150` |
| T04 | `T/schedules/` (GET/POST) | `IsAuthenticated` | GET은 staff면 전체, 아니면 active plan의 현재 user active subscription만. POST는 inline `request.user.is_staff` 추가 검사. | 아니오 | `backend/todos/views.py:369-389,2423-2446` |
| T05 | `T/schedules/<pk>/` (GET/PUT/DELETE) | `IsAuthenticated` | 객체 조회부터 T04의 readable scope. PUT/DELETE는 inline staff 추가 검사. | 아니오 | `backend/todos/views.py:2448-2476` |
| T06 | `T/schedules/month/`, `T/schedules/today/` (GET) | `AllowAny` | active plan만 조회. 인증+active subscription이면 자신의 완료 상태를 덧붙인다. | 예 | `backend/todos/views.py:778-853,1535-1641` |
| T07 | `T/schedules/upload-excel/` (POST) | `IsAuthenticated + IsAdminUser` | staff 전용; plan 소유권 검사는 없음. | 아니오 | `backend/todos/views.py:2478-2585` |
| T08 | `T/reading/`, `T/reading/update/` (POST, 같은 이름/콜백) | `IsAuthenticated` | active한 현재 user subscription과 그 plan의 schedule만 진도 변경. staff의 schedule read 우회가 있어도 최종 subscription은 자기 것이어야 한다. | 아니오 | `backend/todos/urls.py:21-22`; `backend/todos/views.py:426-573` |
| T09 | `T/reading/history/` (GET) | `IsAuthenticated` | non-staff는 active own subscription이 있어야 하며 결과는 항상 `subscription__user=request.user`; staff는 plan 존재성만 우회한다. | 아니오 | `backend/todos/views.py:381-389,575-627` |
| T10 | `T/certification/progress/` (GET) | `IsAuthenticated` | 현재 user의 active subscription 중 선택한 것과 그 plan schedule만 조회한다. | 아니오 | `backend/todos/views.py:660-761` |
| T11 | `T/notifications/`, `…/settings/`, `…/<id>/read/`, `…/mark-all-read/`, `…/push/config/`, `…/push/subscriptions/`, `…/push/subscriptions/remove/` | `IsAuthenticated` | inbox/read/settings/subscription mutation은 각각 `recipient` 또는 `user=request.user`로 scope. push config는 인증 외 객체 관계 없음. | 아니오 | `backend/todos/notification_views.py:21-158` |
| T12 | `T/plans/` (GET) | `AllowAny` | active plan만 반환. | 예 | `backend/todos/views.py:1676-1689` |
| T13 | `T/plans/user/` (GET) | `IsAuthenticated` | 현재 user의 subscriptions와 아직 구독하지 않은 active plans만 반환. | 아니오 | `backend/todos/views.py:1644-1674` |
| T14 | `T/plan/` (GET/POST) | `AllowAny` | 익명 GET은 active plan 목록; 익명 POST는 inline 401. 인증 GET/POST는 현재 user의 subscription 조회/생성. | GET만 | `backend/todos/views.py:1260-1330` |
| T15 | `T/plan/<pk>/` (GET/PUT/DELETE), `…/toggle-active/` (POST), `…/progress/` (GET), `…/unsubscribe/` (POST) | `IsAuthenticated` | 모든 lookup이 `user=request.user`; default plan 삭제/비활성화 제한과 inactive plan 재활성화 제한이 추가된다. | 아니오 | `backend/todos/views.py:1332-1409,2397-2421` |
| T16 | `T/detail/`, `T/next-position/` (GET) | `AllowAny` | active plan만. 인증+own active subscription이면 자신의 완료/다음 미완료 정보를 추가한다. | 예 | `backend/todos/views.py:1411-1533,1691-1897` |
| T17 | `T/video/intro/` (GET/POST), `T/video/intro/<pk>/` (GET/DELETE) | `AllowAny` | GET은 active plan intro만. POST/DELETE는 inline authenticated+staff 검사. DELETE staff는 inactive plan intro도 조회 가능. | GET만 | `backend/todos/views.py:1899-1987` |
| T18 | `T/video/intro/upload/` (POST) | `IsAuthenticated + IsAdminUser` | staff 전용; plan/intro 소유권 없음. | 아니오 | `backend/todos/views.py:1989-2203` |
| T19 | `T/user/video/intro/` (GET), `T/video/intro/progress/` (POST) | `IsAuthenticated` | 현재 user의 active subscription plan intro만 조회/진도 변경하고 progress owner를 현재 user로 강제한다. | 아니오 | `backend/todos/views.py:2205-2255,2336-2395` |
| T20 | `T/hasena/` (GET/POST), `T/hasena/<pk>/` (GET/DELETE), `T/hasena/update/` (POST), `T/hasena/status/`, `T/hasena/stats/` (GET) | `IsAuthenticated` | 모든 record 조회/upsert/delete/stat가 `user=request.user`로 scope. | 아니오 | `backend/todos/views.py:2257-2334,2837-2904,3318-3389` |
| T21 | `T/hasena/day/`, `T/hasena/calendar/` (GET) | `AllowAny` | 본문/entry는 공개; 인증 시 `user=request.user`의 completion만 덧붙인다. | 예 | `backend/todos/views.py:2906-2998` |
| T22 | `T/hasena/sync/` (POST) | `AllowAny`, authn class `[]` | `X-Cron-Secret` 또는 Bearer secret가 설정의 `HASENA_CRON_SECRET`과 constant-time 일치해야 한다. | secret 없이는 아니오 | `backend/todos/views.py:41-63,3000-3024` |
| T23 | `T/hasena/summary/` (GET) | `AllowAny` | 기존 summary 조회는 공개. `generate=true`는 authenticated+staff inline 검사. | 조회만 | `backend/todos/views.py:3026-3079` |
| T24 | `T/hasena/summary/cron/` (POST) | `AllowAny`, authn class `[]` | T22와 같은 cron secret 검사. | secret 없이는 아니오 | `backend/todos/views.py:41-63,3081-3207` |
| T25 | `T/hasena/summaries/` (GET), `…/regenerate/` (POST), `…/<video_id>/` (PUT) | `IsAuthenticated` | 각 view가 inline `request.user.is_staff`를 추가 검사한다. | 아니오 | `backend/todos/views.py:3209-3316` |
| T26 | `T/stats/users/`, `T/stats/plan/`, `T/stats/progress/` (GET) | `AllowAny` | active plan만 집계. progress는 익명에게 이론값+`user_progress=0`, 인증+own active subscription이면 자기 진행률을 추가한다. | 예 | `backend/todos/views.py:2588-2775` |
| T27 | `T/stats/visitors/` (GET), `T/stats/visitors/increment/` (POST) | `AllowAny` | increment는 session의 날짜로 일 1회만 계수; user 권한 없음. | 예 | `backend/todos/views.py:2777-2835` |
| T28 | `T/scoreboard/` (GET) | `AllowAny` | 익명은 live+public profile만, 인증자는 public profile+본인을 조회한다. | 예 | `backend/todos/scoreboard_views.py:437-541` |
| T29 | `T/scoreboard/friends/`, `T/scoreboard/my-ranking/` (GET) | `IsAuthenticated` | 현재 user의 following/mutual 집합 또는 본인 ranking을 계산하며 타인은 public profile만 포함한다. | 아니오 | `backend/todos/scoreboard_views.py:543-646,819-922` |
| T30 | `T/scoreboard/group/<group_id>/` (GET) | `AllowAny` | public group은 공개; private group은 현재 user의 active membership 필수. 멤버 결과도 public profile 또는 요청자 본인만 포함한다. | public group만 | `backend/todos/scoreboard_views.py:648-817` |
| T31 | `T/groups/`, `T/groups/<group_id>/`, `T/groups/<group_id>/members/` (GET) | `AllowAny` | public group은 공개, private group은 active member만. member 목록은 public profile 또는 요청자 본인만 노출한다. | public group만 | `backend/todos/group_views.py:25-33,105-115,431-509,623-712` |
| T32 | `T/groups/create/` (POST) | `IsAuthenticated` | 현재 user를 `creator`이자 active `role='admin'` membership으로 만든다. | 아니오 | `backend/todos/group_views.py:368-429` |
| T33 | `T/groups/<group_id>/join/` (POST) | `IsAuthenticated` | public group은 정원 내 가입 가능. private group은 현재 user 대상 pending invitation이 필요; role은 member로 생성/복원한다. | 아니오 | `backend/todos/group_views.py:511-578` |
| T34 | `T/groups/<group_id>/leave/` (POST) | `IsAuthenticated` | 현재 user의 active membership만 비활성화; `group.creator == request.user`이면 탈퇴 금지. | 아니오 | `backend/todos/group_views.py:580-621` |
| T35 | `T/groups/<group_id>/invite/` (POST) | `IsAuthenticated` | 현재 user의 active membership이면서 `role == 'admin'`이어야 한다. | 아니오 | `backend/todos/group_views.py:714-794` |
| T36 | `T/invitations/` (GET), `T/invitations/<invitation_id>/respond/` (POST) | `IsAuthenticated` | `invitee=request.user`, pending인 invitation만 조회/응답. 수락 시 member membership을 생성/복원한다. | 아니오 | `backend/todos/group_views.py:796-899` |
| T37 | `T/users/<user_id>/groups/` (GET) | `AllowAny` | target profile이 public이거나 요청자 본인. 본인은 모든 active membership, 타인은 public group+`show_in_profile=True`만. | public profile/group만 | `backend/todos/group_views.py:92-102,901-950` |
| T38 | `T/groups/<group_id>/visibility/` (PATCH) | `IsAuthenticated` | 현재 user의 active membership만 찾아 **그 membership의** `show_in_profile`을 수정한다. group의 `is_public`은 수정하지 않는다. | 아니오 | `backend/todos/group_views.py:952-982` |
| T39 | `T/groups/<group_id>/member-progress/` (GET) | `IsAuthenticated` | 현재 user가 어떤 role이든 active group member여야 한다. 반환 member도 public profile 또는 요청자 본인으로 제한한다. | 아니오 | `backend/todos/group_views.py:986-1209` |
| T40 | `T/calendar/settings/` (GET), `…/settings/<pk>/` (PATCH), `…/settings/reorder/` (POST), `…/month/`, `…/last-incomplete/` (GET) | `IsAuthenticated` | setting/subscription/progress queryset을 모두 현재 user와 active subscription으로 scope한다. | 아니오 | `backend/todos/calendar_views.py:29-42,55-166,222-301,303-385` |
| T41 | `T/subscriptions/<id>/catchup-status/`, `…/catchup/preview/`, `…/catchup/`; `T/catchup-sessions/active/`, `T/catchup-sessions/<id>/`, `…/update/`, `…/schedules/`, `…/complete/`, `…/abandon/`; `T/catchup-schedules/<id>/toggle/` | `IsAuthenticated` | 모든 subscription/session/schedule lookup이 직접 또는 relation을 따라 `user=request.user`; mutation은 active subscription+active plan/session 조건도 요구한다. | 아니오 | `backend/todos/urls.py:103-112`; `backend/todos/catchup_views.py:124-593` |
| T42 | `T/bible/reading-position/` (GET/POST), `T/bible/home-stats/` (GET) | `IsAuthenticated` | position/bookmark/note/highlight/personal record를 `user=request.user`로만 조회·저장·집계한다. | 아니오 | `backend/todos/views.py:3406-3444,3809-3853` |

### 1.3 Bible cache: 4개 논리 라우트 이름

| # | endpoint (method) | `permission_classes` | view 안의 추가 인가/관계 검사 | 익명 | 근거 |
|---:|---|---|---|---|---|
| B01 | `B/versions/`, `B/search/`, `B/<version>/<book>/<chapter>/status/` (GET) | `AllowAny` | 없음. | 예 | `backend/bible_cache/views.py:122-251`; `backend/bible_cache/urls.py:4-24` |
| B02 | `B/<version>/<book>/<chapter>/` (GET) | `AllowAny` | 일반 조회는 공개; `force_refresh=true`만 authenticated+staff inline 검사. | 일반 조회만 | `backend/bible_cache/views.py:21-118` |

### 1.4 Config가 직접 노출하는 surface

`api/v1/*` 네 항목은 endpoint가 아니라 위 URLConf의 mount다 (`backend/config/urls.py:25-28`). 실제 직접 surface는 다음 3개다.

| # | endpoint | permission 체계 | 추가 인가 | 익명 | 근거 |
|---:|---|---|---|---|---|
| C01 | `/health/`, `/ready/` (GET) | plain Django view; DRF `permission_classes` 없음 | 없음. DB/cache/push 상태를 공개 응답한다. | 예 | `backend/config/urls.py:23-24`; `backend/config/health_views.py:206-218,249-282` |
| C02 | `/admin/` | Django admin 자체 authz | admin login surface는 공개; admin index는 active+staff, 개별 모델 작업은 Django admin/model permission 체계를 따른다. 프로젝트 view의 DRF 규칙은 적용되지 않는다. | login만 | `backend/config/urls.py:21-22` |

**인가 규칙 표 행 수:** accounts 27 + todos 42 + bible_cache 2 + config 2 = **73개 grouped rule row**. 이 73행 안에 API 논리 route name 154개와 `reading` alias 1개가 모두 들어 있다.

## 2. 역할·주체 목록

### 2.1 코드가 실제로 판별하는 주체/관계

요청된 user taxonomy를 펼치면 7개 label(익명, 인증 user, owner/self, group member, group admin, staff, superuser)이지만, `superuser`는 현재 인가 판정에 참여하지 않는다. 반대로 user가 아닌 cron-secret bearer가 실제 gate다. 따라서 **실효 인가 주체/관계는 7종**(아래 1-7)이고, superuser는 별도의 관측 label(8번)이다. 이들은 상호 배타적 role이 아니라 한 user에게 겹치는 속성/관계다. 프로덕션 모델의 유일한 명시적 role field는 `GroupMembership.role`이고 실제 choices는 `admin`, `member` 두 값이다 (`backend/todos/models.py:521-542`).

| # | 주체/관계 | 현재 할 수 있는 일 | 경계/근거 |
|---:|---|---|---|
| 1 | 익명 | active plan/schedule/video/본문, public profile/group/scoreboard, aggregate stats를 읽고 register/login/reset flow를 시작한다. 공개 endpoint 중에도 credential/secret가 필요한 action은 별도다. | 표 A01-A14, A22-A25, A27, T06/T12/T14/T16/T17/T21-T24/T26-T28/T30-T31/T37, B01-B02 |
| 2 | 인증 사용자 | 구독·follow·group 생성/가입, 자기 account/settings/reading data를 관리한다. 인증만으로 타인의 개인 객체를 읽는 일반 권리는 없다. | 전역 default `backend/config/settings.py:216-223`; 각 `IsAuthenticated` 표 행 |
| 3 | 리소스 owner/self | `request.user` 또는 relation filter로 profile, subscription, progress, hasena, notification, catchup, bookmark/note/highlight/personal record 등 자기 객체를 읽고 변경한다. owner는 DB role 필드가 아니라 queryset 관계다. | 예: `backend/todos/views.py:1337,2318,3452-3456,3681-3685`; `backend/todos/catchup_views.py:124-134`; `backend/accounts/profile_views.py:28-29` |
| 4 | active group member (`role='member'`) | private group/detail/member/scoreboard를 읽고, group member progress를 읽고, 자신의 profile 표시를 바꾸고, 탈퇴할 수 있다. invite 권한은 없다. | role 값 `backend/todos/models.py:521-542`; membership gate `backend/todos/group_views.py:130-137,986-1043`; scoreboard `backend/todos/scoreboard_views.py:660-668` |
| 5 | active group admin (`role='admin'`) | member 권리 + user 초대. 코드상 admin 전용인 group action은 invite 하나다. | `backend/todos/group_views.py:714-750`; 생성 시 부여 `backend/todos/group_views.py:400-417` |
| 6 | staff (`user.is_staff`) | 모든 BibleReadingPlan CRUD/action, schedule/video intro 쓰기·upload, Hasena summary 관리/생성, Bible cache force refresh, 모든 schedule/plan 존재성 read 우회를 한다. staff라도 다른 user의 subscription/progress/catchup owner scope는 우회하지 않는다. | `backend/todos/views.py:369-389,1172-1258,2438-2474,3039,3209-3316`; `backend/bible_cache/views.py:80-88` |
| 7 | cron-secret bearer (비-user system subject) | Hasena entry sync와 summary cron generation 두 POST를 호출한다. 해당 view는 일반 authentication을 비운다. | `backend/todos/views.py:41-63,3000-3024,3081-3087` |
| 8 | superuser flag (관측되지만 독립 인가 주체 아님) | 프로젝트 authz code에서 직접 허용되는 action은 **없다**. API serializer는 `is_superuser or is_staff`를 `is_staff` 응답값으로 보이지만 DRF `IsAdminUser`/inline gate는 실제 `is_staff`를 본다. | `backend/accounts/serializers.py:18-27`; production `is_superuser` 인가 분기 0건 |

### 2.2 group creator는 role과 별도인 owner 관계

`ReadingGroup.creator`는 별도 role field가 아니지만 탈퇴 금지 판정에서만 직접 사용된다. 생성 시 creator에게 admin membership을 같이 만들지만, 이후 두 값의 동기화를 보장하는 모델 constraint는 보이지 않는다 (`backend/todos/group_views.py:400-417,604-610`; `backend/todos/models.py:471-519,521-557`). 따라서 정책 입력에는 `resource.creator_id == subject.id`와 `membership.role`을 별도 관계로 담아야 현재 동작을 손실 없이 표현할 수 있다.

## 3. 불일치·구멍·정책 공백

여기서 **확인됨**은 현재 코드 경로가 서로 다르다는 뜻이며, 제품상 취약점이라는 뜻까지 포함하지 않는다. 제품 의도가 필요한 평가는 `추정`으로 표시했다.

1. **[확인됨] 출발점 143은 등록 endpoint 수가 아니다.** config docstring 3건을 endpoint로 세고 router 23건을 누락한다. 실제 inventory는 위 0.1의 154 logical names/155 templates다 (`backend/config/urls.py:4-15`, `backend/todos/urls.py:5-13`).
2. **[확인됨] 테스트의 route 분류와 실제 permission이 어긋난다.** `verify_auth`와 `schedule-detail`은 `PUBLIC_ROUTE_NAMES`인데 실제 `IsAuthenticated`; `schedule-list`는 `MIXED_AUTH_ROUTE_NAMES`인데 실제 GET/POST 모두 `IsAuthenticated`; `register`는 mixed로 분류됐지만 route의 유일한 POST는 `AllowAny`다. 현재 테스트는 protected가 `AllowAny`인지와 명시 선언만 검사하고 public/mixed의 실제 동작은 검사하지 않아 이 drift를 허용한다 (`backend/tests/test_route_authorization_coverage.py:8-59,156-168,274-307`; `backend/accounts/cookie_views.py:221-232`; `backend/todos/views.py:2423-2476`; `backend/accounts/views.py:230-247`).
3. **[확인됨] 명시적 permission 없이 `DEFAULT_PERMISSION_CLASSES`에만 의존하는 실제 API route가 1개다.** `DefaultRouter`의 API root `T/`가 그것이다. 모든 function-based DRF route와 등록된 5개 ViewSet은 명시 선언이 있고 이를 검증하는 테스트도 있다 (`backend/config/settings.py:216-223`; `backend/todos/urls.py:5-13`; `backend/tests/test_route_authorization_coverage.py:287-321`). Cookie token view 두 개의 빈 permission은 SimpleJWT 상속값이므로 default 의존이 아니다 (`backend/accounts/cookie_views.py:35-82`).
4. **[확인됨] active plan 가시성 규칙이 group scoreboard의 명시적 `plan_id` 경로에서 다르다.** 대부분의 public plan/schedule/video/stat read는 `is_active=True`를 강제하지만, group scoreboard는 caller가 `plan_id`를 주면 `group.plans.get(id=plan_id)`로 inactive plan도 선택한다. plan_id를 생략한 경로만 active를 필터한다 (`backend/todos/views.py:871-875`; `backend/todos/group_views.py:263-275`; `backend/todos/scoreboard_views.py:682-694`). public group이면 익명도 이 경로에 도달한다 (`backend/todos/scoreboard_views.py:660-668`).
5. **[확인됨] superuser와 staff의 외부 표현/실제 gate가 다르다.** serializer는 superuser를 `is_staff: true`로 응답하지만 프로젝트 gate는 `is_staff`만 검사한다 (`backend/accounts/serializers.py:25-27`; 예: `backend/todos/views.py:1136,3039,3212`). **추정:** DB에 `is_superuser=True, is_staff=False` 상태가 가능하다면 client는 staff로 보지만 admin API는 거부된다. 일반적인 `create_superuser`가 두 flag를 함께 세우는지는 이 불일치 자체를 제거하지 않는다.
6. **[확인됨] staff 우회 범위가 같은 plan/schedule 도메인 안에서도 균일하지 않다.** staff는 모든 schedule을 읽고 어떤 plan의 존재성도 통과하지만, reading history 결과와 progress mutation은 끝내 `request.user`의 subscription/progress로 제한된다 (`backend/todos/views.py:369-389,470-505,590-615`). 이는 “staff는 모든 사용자 진도를 볼 수 있다”도 “staff는 일반 사용자와 같다”도 아닌 중간 정책이다. **추정:** 의도된 운영자 범위인지 확인이 필요하다.
7. **[확인됨] group 권한의 source of truth가 `creator`와 membership role로 나뉜다.** 탈퇴 금지는 `group.creator`, 초대 허용은 active `membership.role == 'admin'`이다 (`backend/todos/group_views.py:589-610,724-741`). 생성 시 둘을 맞추지만 이후 불변 constraint는 없다. **추정:** admin role 변경/비활성화를 admin UI나 데이터 작업으로 허용하면 creator가 초대는 못하면서 탈퇴도 못 하거나, creator가 아닌 admin이 초대하는 상태가 생긴다.
8. **[확인됨] method/query별 다른 권한을 `AllowAny` + inline 분기로 표현한다.** plan subscription list(anonymous GET/authenticated POST), video intro(GET public, write staff), Hasena summary(read public, generate staff), Bible content(read public, force refresh staff)가 같은 패턴이다 (`backend/todos/views.py:1260-1330,1899-1987,3026-3045`; `backend/bible_cache/views.py:80-88`). 현재 분기는 존재하지만 permission metadata만 읽는 도구는 실제 action 권한을 알 수 없다.
9. **[확인됨] `group-visibility` 이름과 실제 resource가 다르다.** endpoint는 group의 `is_public`을 바꾸지 않고 현재 member의 `show_in_profile`만 바꾼다. active member라면 role 무관하게 자기 membership을 수정한다 (`backend/todos/urls.py:90`; `backend/todos/group_views.py:952-982`). authz resource 이름을 `group_membership_profile_visibility`처럼 정규화해야 오판을 피할 수 있다.
10. **[정책 공백, 추정] plan의 `created_by`는 인가 관계로 쓰이지 않는다.** plan 생성 시 기록하고 serializer가 노출하지만, 등록된 plan ViewSet은 모든 staff에게 모든 plan CRUD/action을 허용한다 (`backend/todos/views.py:1172-1225`; `backend/todos/models.py:21-31`). “staff 공동 관리”가 의도라면 구멍이 아니고, “staff 작성자만 수정”이 의도라면 소유권 검사가 빠진 것이다.
11. **[정책 공백, 추정] public aggregate 범위가 제품 정책으로 명시되어 있지 않다.** 전체 active user 수, plan 완료 사용자 수, visitor 수는 `AllowAny`이고 주석상 과거 admin/authenticated에서 공개로 바뀌었다 (`backend/todos/views.py:2588-2680,2681-2775,2815-2835`). 코드상 확실히 공개지만 공개해야 하는지는 코드만으로 판단할 수 없다.
12. **[확인됨] account URL 전체가 두 prefix로 중복 노출된다.** 동일 callback이라 권한 차이는 없지만 `/api/v1/auth/*`와 `/api/v1/accounts/*`가 모두 유효해 route surface와 로그/정책 key가 두 배다 (`backend/config/urls.py:25-26`). authz key를 raw path로 만들면 같은 action에 정책 두 벌이 생긴다.
13. **[확인됨] 프로젝트 production view에는 직접 `has_perm()` 기반 판정이 없다.** Django admin만 framework의 model permission 체계를 별도 사용하며 API의 staff gate와 통합되어 있지 않다 (`backend/config/urls.py:21-22`). 향후 `authz.can`으로 수렴할 때 admin까지 포함할지 경계를 먼저 정해야 한다.

### 소유권 누락 판독 결과

등록된 user-owned mutation을 추적한 범위에서는 plan의 `created_by` 정책 공백(10번) 외에 **확인된 타 사용자 객체 mutation bypass는 찾지 못했다**. subscription, progress, notification, calendar setting, catchup, personal Bible artifact, invitation response는 모두 lookup/queryset/create 중 한 곳 이상에서 현재 user relation을 강제한다. “소유권 검사 27건” 같은 문자열 개수보다 이 endpoint-level 판독을 기준선으로 삼는 편이 안전하다.

## 4. `(subject, action, resource)` 정규화 초안

### 4.1 최소 입력 스키마

현재 동작을 보존하려면 단순 RBAC의 `user.role` 하나로는 부족하다. 아래처럼 subject 속성, action, resource 및 관계를 함께 전달해야 한다.

```text
subject = {
  kind: anonymous | user | system,
  user_id?: int,
  is_authenticated: bool,
  is_staff: bool,
  is_superuser: bool,          # 유지 여부는 정책 결정 필요
  credential?: cron_secret | email_token | reset_token | bridge_code | oauth_proof
}

action = domain verb
  # read, list, create, update, delete보다 필요한 곳은 더 구체화
  # subscribe, update_progress, invite, join, leave, respond_invitation,
  # generate_summary, force_refresh, set_default, toggle_active 등

resource = {
  type: string,
  id?: int,
  owner_id?: int,
  creator_id?: int,
  is_active?: bool,
  is_public?: bool,
  profile_is_public?: bool,
  subscription_user_id?: int,
  group_membership?: {is_active: bool, role: admin | member},
  parent?: resource reference
}
```

owner/membership를 호출자가 boolean으로 미리 계산해 넘기면 편하지만, 서로 다른 view가 다른 방식으로 계산하는 현재 문제를 반복할 수 있다. 가능한 경우 policy layer가 id/relation을 같은 repository 함수로 조회하거나, 검증된 relation snapshot을 명시적으로 받는 편이 낫다.

### 4.2 현재 규칙을 tuple로 옮긴 예

| subject | action | resource | 현재 allow 조건 | 근거 |
|---|---|---|---|---|
| anonymous | `plan.read` | `bible_plan(is_active)` | `resource.is_active` | `backend/todos/views.py:871-875,1676-1689` |
| user | `subscription.read/update/delete` | `plan_subscription(owner_id)` | `subject.user_id == owner_id` | `backend/todos/views.py:1332-1409,2397-2421` |
| user | `progress.update` | `schedule(parent_plan)` | subject의 active subscription이 parent plan에 존재 | `backend/todos/views.py:470-505` |
| staff | `plan.manage` | `bible_plan(*)` | `subject.is_staff` | `backend/todos/views.py:1172-1258` |
| anonymous/user | `profile.read` | `user_profile(owner_id,is_public)` | public 또는 self | `backend/accounts/profile_views.py:28-53` |
| user | `group.read` | `reading_group(is_public)` | public 또는 active member | `backend/todos/group_views.py:25-33,105-115` |
| user | `group.invite` | `reading_group` | active membership role가 admin | `backend/todos/group_views.py:724-741` |
| user | `group.leave` | `reading_group(creator_id)` | active member이고 creator는 아님 | `backend/todos/group_views.py:589-610` |
| user | `group_member_progress.read` | `reading_group` | active member(role 무관) | `backend/todos/group_views.py:1029-1043` |
| system | `hasena.sync` | `hasena_entry_collection` | 유효한 cron secret | `backend/todos/views.py:41-63,3000-3024` |
| anonymous/user/staff | `bible_content.read` | `bible_content` | 항상 allow | `backend/bible_cache/views.py:21-79` |
| staff | `bible_content.force_refresh` | `bible_content` | authenticated + staff | `backend/bible_cache/views.py:80-88` |

### 4.3 모델 선택지와 trade-off

#### 선택지 A: global RBAC 중심

`authenticated`, `staff`, `superuser` role과 action matrix를 두고 owner/group 조건은 view에 남긴다.

- 장점: staff 관리 API부터 빠르게 중앙화할 수 있고 구현이 단순하다.
- 단점: 현재 규칙 대부분인 owner, active subscription, profile visibility, group membership을 표현하지 못해 “코드 곳곳의 inline 인가” 문제가 상당 부분 남는다.

#### 선택지 B: relation/attribute 기반 policy (ReBAC + ABAC)

`authz.can(subject, action, resource)`가 owner, subscription, group membership role, public/active 속성을 함께 평가한다.

- 장점: 현재 동작을 가장 충실히 표현하고 profile/group/plan의 public/private 규칙을 재사용할 수 있다.
- 단점: relation 조회의 N+1, transaction 중 stale relation, 404로 숨길지 403을 줄지까지 policy contract에 포함해야 한다. resource hydration/cache 경계를 설계해야 한다.

#### 선택지 C: hybrid

Django/DRF permission은 coarse gate(anonymous/authenticated/staff), `authz.can`은 object/action relation gate로 둔다. cron/email/reset/bridge proof는 별도 authenticator가 system/ephemeral subject를 만든다.

- 장점: 점진 이행이 쉽고 DRF의 401/403 처리와 기존 admin을 유지할 수 있다.
- 단점: coarse gate와 object policy 두 층이 drift할 수 있다. 이 문서에서 확인된 route classification drift를 막으려면 endpoint-action registry와 policy test를 같은 machine-consumed source에서 생성해야 한다.

### 4.4 결정을 미뤄야 하는 정책 질문

1. superuser를 staff의 상위로 자동 허용할지, Django처럼 `is_staff`도 반드시 요구할지.
2. staff가 user-owned subscription/progress/catchup을 읽거나 변경할 수 있어야 하는지.
3. plan `created_by`를 실제 owner 권한으로 사용할지, 모든 staff 공동 관리로 둘지.
4. group creator와 admin role을 하나로 수렴할지, creator의 불변 권리/금지를 별도 유지할지.
5. inactive plan의 group scoreboard를 공개할지(T30의 현재 예외를 유지할지).
6. user/plan/visitor aggregate를 계속 anonymous 공개할지.
7. 존재를 숨기는 404(private profile/group)와 명시적 403을 action별로 어떻게 표준화할지.
8. mixed endpoint를 HTTP method/query flag가 아니라 별도 action(`summary.read`/`summary.generate`, `content.read`/`content.force_refresh`)으로 분리할지.

이 질문을 결정하기 전에도 action name을 HTTP method가 아닌 domain verb로 기록하고, path alias(`/auth`/`accounts`, `reading`/`reading/update`)를 하나의 policy key에 매핑하는 작업은 현재 사실을 손실 없이 진행할 수 있다.

---

## 5. 설계 결정 (2단계 착수 시점)

### 5.1 모델: **선택지 C (hybrid)**

DRF permission은 **coarse gate**(익명/인증/staff)로 두고, `authz.can(subject, action, resource)`가
**object·relation gate**를 맡는다. cron secret·이메일 토큰·재설정 토큰·bridge code는 별도
authenticator가 system/ephemeral subject를 만든다.

**A를 고르지 않는 이유**: 현재 규칙의 대부분이 owner·active subscription·profile 공개 여부·
group membership이다. global RBAC으로는 표현되지 않아 "코드 곳곳의 inline 인가"라는 문제가
거의 그대로 남는다. 문제를 옮기기만 하고 풀지 못한다.

**B를 고르지 않는 이유**: 전면 ReBAC은 이 리포에서 한 번에 갈아엎어야 하고, 프로덕션에
실사용자가 있는데 스테이징이 없다. 점진 이행이 불가능한 설계는 이 프로젝트에서 채택할 수 없다.

**C의 단점(두 층의 drift)을 어떻게 막는가** — 이것이 C를 고른 실질적 근거다. 이미 그 수단이 있다:
- `backend/schema.yml`(계약 단일 원천) + 바이트 비교 드리프트 게이트
- `backend/tests/golden/api_characterization.json`(라우트별 3페르소나 HTTP 관측)

여기에 **endpoint→action 레지스트리**를 더해, coarse gate와 object policy가 같은
machine-consumed 원천에서 검사되게 한다. 이 문서 §3의 불일치 2번(테스트 분류와 실제 permission이
어긋남)이 바로 drift가 이미 발생했다는 증거이며, 레지스트리는 그것을 기계로 잡는 장치다.

### 5.2 정책 질문 8개의 기본값: **현재 동작 보존**

리팩터링은 **동작 중립**이어야 한다. 인가 규칙을 바꾸는 것은 별개의 제품 결정이고, 구조 변경과
섞으면 사고가 났을 때 원인을 가릴 수 없다. 따라서 8개 모두 **현재 동작을 그대로 표현**하는 것을
기본값으로 삼고, 바꾸는 것은 별도 작업으로 올린다.

| # | 질문 | 이번 처리 |
|---|---|---|
| 1 | superuser 자동 상위 허용? | **현행 유지** — `is_staff`만 검사. serializer 표시와 게이트가 다른 것은 §3-5 불일치로 남겨 별도 판단 |
| 2 | staff가 user-owned 자원 접근? | **현행 유지** — 읽기는 일부 허용, 변경은 본인 것만(중간 정책). 그대로 표현 |
| 3 | plan `created_by`를 owner 권한으로? | **현행 유지** — 모든 staff 공동 관리 |
| 4 | group creator와 admin role 수렴? | **현행 유지** — creator의 불변 권리(탈퇴 금지)를 별도로 표현 |
| 5 | inactive plan의 group scoreboard 공개? | **현행 유지** — 단 §3-4의 불일치이므로 제품 판단 대상으로 올림 |
| 6 | aggregate anonymous 공개? | **현행 유지** |
| 7 | 404(존재 숨김) vs 403 표준화? | **현행 유지** — action별 현재 동작을 그대로 policy에 기록. 표준화는 후속 |
| 8 | mixed endpoint를 별도 action으로 분리? | **분리한다** — 이건 동작 변경이 아니라 **기록 방식**이다. `summary.read`/`summary.generate`처럼 나눠야 policy가 실제 권한을 표현할 수 있다 |

**제품 판단이 필요한 것은 둘뿐이다**: 5번(비활성 플랜이 익명에게 보이는 것이 의도인가)과
1번(superuser 표시/게이트 불일치). 나머지는 현행 보존으로 충분하다.

### 5.3 착수 순서

1. **endpoint→action 레지스트리**를 만든다. action은 HTTP 메서드가 아니라 **도메인 동사**로 적고,
   path alias(`/auth`↔`/accounts`, `reading`↔`reading/update`)를 **하나의 policy key**로 묶는다.
   이 작업은 정책 질문의 답과 무관하게 지금 손실 없이 할 수 있다.
2. 레지스트리와 실제 permission이 어긋나면 실패하는 **검사**를 붙인다(§3 불일치 2번이 재발하지 않게).
3. `authz.can`을 도입하고 **object gate가 있는 곳부터** 옮긴다. coarse gate는 DRF에 남긴다.
4. 옮길 때마다 골든 특성화 테스트가 통과해야 한다 — **응답과 상태 코드가 바뀌면 동작을 바꾼 것이다.**

---

## 6. 이관 진척과 검증 절차

### 6.1 도메인별 진척

`authz.can` 으로 옮긴 도메인과 남은 것. 한 번에 전부 옮기지 않는다 — 프로덕션에
실사용자가 있고 스테이징이 없으므로 **도메인 단위로 작게, 매번 변이로 증명**한다.

| 도메인 | 정책 파일 | 상태 |
|---|---|---|
| 플랜 구독 | `plan_subscription.py` | 완료 |
| 읽기 진도 | `reading_progress.py` | 완료 |
| 성경 북마크 | `bible_bookmark.py` | 완료 |
| 성경 하이라이트 | `bible_highlight.py` | 완료 |
| 성경 노트 | `bible_note.py` | 완료 |
| 읽기 위치 | `bible_reading_position.py` | 완료 |
| 개인 읽기 기록 | `bible_personal_record.py` | 완료 |
| 그룹 | `reading_group.py` + `reading_group_types.py` | 완료 |
| 캐치업 | — | 진행 |
| 알림 | — | 진행 |
| 프로필·소셜 | — | 진행 |
| 캘린더 | — | 진행 |

### 6.2 이관 절차 (검증된 순서)

1. 레지스트리의 기존 action·resource type 을 그대로 쓴다. **새 이름을 지어내지 않는다.**
2. 뷰가 소유권 boolean 을 계산해 넘기지 않는다. **ID 기반 resource** 를 넘기고
   **관계 조회는 정책이 ORM 으로** 한다. 뷰마다 다르게 계산하던 문제를 정책 계층에서
   반복하지 않기 위해서다.
3. **DRF `permission_classes` 는 손대지 않는다.** 거친 게이트로 남는다.
   건드리면 `tests.test_authz_registry` 가 실패하는데 그게 정상 동작이다.
4. **404/403 차이를 현재 동작 그대로 보존한다.** 표준화는 별도 제품 결정이다.

### 6.3 안전망 — 골든만으로는 부족하다 (실측)

특성화 골든은 라우트마다 **한 번, 일반화된 최소 본문**으로 호출한다. 그래서
**입력 검증이 인가보다 먼저 걸리는 쓰기 엔드포인트에서는 인가 분기에 도달하지 못한다.**

확인된 사례: `POST /api/v1/todos/reading/update/` 의 골든 기록은
`owner 400 · non_owner 400` 으로 두 페르소나가 같다. 빈 본문이 검증에서 걸리기 때문이다.
실제로 뷰의 인가 분기를 통째로 무력화해도 **골든이 통과했다.**

그래서 `backend/tests/test_authz_write_endpoints.py` 가 따로 있다. 규칙:

- **유효한 본문**으로 호출한다.
- **허용 케이스가 먼저 성공**해야 한다. 그래야 거부가 "검증 실패"가 아니라 "인가 거부"임이
  증명된다. 허용 케이스 없는 거부 단언은 왜 통과하는지 알 수 없는 공허한 테스트다.
- 거부 시 **데이터가 실제로 안 바뀌었는지**도 확인한다.

정책 단위 테스트(`test_authz_policy.py`)는 **"정책이 옳게 판정하는가"** 를 보고,
위 HTTP 테스트는 **"뷰가 그 판정을 따르는가"** 를 본다. 둘 다 필요하다.

### 6.4 변이 주입 — 하중을 받는 줄을 골라라

이관마다 변이로 안전망을 확인한다. **단 변이 전에 그 줄이 실제로 결과를 가르는지
확인해야 한다.**

실제로 겪은 함정: `_create_bookmark` 의 `subject.user_id != resource.owner_id` 를
지웠는데 아무것도 안 잡혔다. 그 줄은 **하중을 받지 않는 중복 방어선**이었다 —
생성 시 `resource.owner_id` 는 뷰가 `request.user` 로 채우므로 그 비교는 정상 흐름에서
거짓이 될 수 없다. 하중 지점(`_owned_bookmark` 의 소유자 비교)을 다시 찾아 변이하니
두 층이 모두 잡았다.

**하중을 받지 않는 줄을 변이하면 "테스트가 약하다"는 잘못된 결론에 이른다.**

원복은 **`git checkout` 이 아니라 사전 바이트 백업 + `shasum -a 256` 대조**로 한다.
이 리포에는 추적되지 않는 파일이 많아 `git checkout` 이 복원하지 못하는 경우가 있다(실제 발생).
