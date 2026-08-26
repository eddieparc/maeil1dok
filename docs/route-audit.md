# 미사용 Django route 감사

조사일: 2026-08-26

## 결론

`docs/fe-api-inventory.md` §3.2의 canonical route 27개를 모두 확인했다.
판정은 **제거 8 / 유지 10 / 발전 7 / 확인 불가 2**다. 외부 호출 여부를
저장소만으로 확정할 수 없는 2개와 모바일 전용 2개는 제거하지 않았다.

- **제거:** 개인 읽기 기록 detail, 하세나 기록 detail, 구독 진도, 구독 취소
  별칭, `reading/` 별칭, 읽기 이력, 방문자 조회/증가
- **유지:** DRF API root, staff 플랜 action 3개, 명시적 하위 호환 인증 route
  4개, 모바일 세션 브리지 2개
- **발전:** 공개 플랜 통계 3개, 계정 이메일, CSRF bootstrap, 구형 알림 설정,
  인증 확인
- **확인 불가:** bible cache status, Hasena sync

## 조사 방법과 계수

- `frontend/app`, `frontend/server`, `mobile`의 실행 소스를 route suffix와 route
  name으로 전수 `rg`했다. 테스트, 생성된 `frontend/app/types/generated`, 주석,
  타입 문서, allowlist/guard 문자열은 소비로 세지 않았다.
- 아래의 **W0/M0**은 각각 web/mobile 실행 호출 0건이다. **W2**는 web 호출
  2곳, **M1**은 mobile 호출 1곳이라는 뜻이다.
- backend에서는 URLConf 밖의 함수 참조와 route name을 admin, management
  command, Celery task, service, 다른 view 전체에서 검색했다. 테스트는 제품
  소비자가 아니므로 소비 수에는 넣지 않았지만, 호환 의도를 판단하는 근거로
  별도 표기했다.
- `{auth|accounts}` 항목은 동일한 `accounts.urls`가 두 prefix에 mount되므로 두
  실제 URL을 함께 뜻한다.

## 27개 전수 판정

| # | canonical 경로 · view · 동작 | 소비자 grep / backend 내부 사용 / 대체 경로 | 인가 | 판정 · 근거 |
|---:|---|---|---|---|
| 1 | `/api/v1/bible-cache/<version>/<book>/<chapter>/status/` · `get_cache_status` · 캐시 row의 존재, 갱신 시각, fetch 성공 여부와 content type 조회 | W0/M0. HTTP 내부 호출 없음. `BibleContentCacheAdmin`과 `prefetch_bible` command는 모델/서비스를 직접 사용한다. 본문 endpoint는 cache hit 여부를 포함하지만 동일한 운영 상태 계약은 아니다. | 익명 GET | **확인 불가.** 외부 cache monitor가 호출할 수 있으나 저장소에서 배포 scheduler/monitor 설정을 확인할 수 없다. |
| 2 | `/api/v1/todos/` · DRF `APIRootView` · router의 등록 resource 링크 제공 | W0/M0. 내부 호출 없음. 대체 기능 경로는 없고 browsable API의 discovery surface다. | 전역 기본값상 인증 GET | **유지.** 제품 기능 호출은 아니지만 DRF 운영/탐색용 root로 의도된 framework route다. |
| 3 | `/api/v1/todos/bible-plans/<pk>/schedules/` · `BibleReadingPlanViewSet.schedules` · 한 플랜의 전체 schedule 직렬화 | W0/M0. admin/command/task/view 내부 호출 없음. FE admin은 `/schedules/?plan_id=...`를 사용한다. | 인증 + staff GET | **유지.** staff 전용 ViewSet action이며 운영자가 직접 사용할 수 있다. 공개/사용자용 대체 경로와 권한 목적도 다르다. |
| 4 | `/api/v1/todos/bible-plans/<pk>/set_default/` · `BibleReadingPlanViewSet.set_default` · transaction 안에서 유일한 기본 플랜으로 지정 | W0/M0. 내부 호출 없음. FE admin은 generic plan PATCH를 쓰며 같은 `_save_as_sole_default` invariant를 탄다. default 무결성 테스트가 action도 검사한다. | 인증 + staff POST | **유지.** 직접 운영 action이고 단일-default 보장을 명시적으로 수행한다. UI 버튼 부재만으로 제거하지 않는다. |
| 5 | `/api/v1/todos/bible-plans/<pk>/toggle_active/` · `BibleReadingPlanViewSet.toggle_active` · 플랜 활성 상태 반전 | W0/M0. 내부 호출 없음. FE admin은 generic plan PATCH를 쓴다. | 인증 + staff POST | **유지.** staff가 직접 호출할 수 있는 의도된 운영 action이다. |
| 6 | `/api/v1/todos/bible/personal-records/<pk>/` · 상속된 `retrieve` · 현재 사용자의 개인 읽기 기록 1건 조회 | W0/M0. 내부 사용 없음. 소비 중인 list/create, `by-book`, `dates`, `stats`, `home-stats`로 필요한 읽기 기능이 제공된다. | 인증 GET | **제거.** `ModelViewSet`의 과도한 기본 surface로 자동 생성됐고 detail 소비자나 고유 기능이 없다. list/create mixin ViewSet으로 좁혔다. |
| 7 | `/api/v1/todos/hasena/<pk>/` · `hasena_record_detail` · 본인 Hasena 기록 1건 GET 또는 DELETE | W0/M0. admin/command/task/view 내부 사용 없음. 기록 list와 소비 중인 date 기반 `hasena/update/`가 조회/완료 상태 변경을 담당한다. | 인증 GET/DELETE | **제거.** ID 기반 detail/delete 흐름은 어느 client에도 없고 현재 제품은 날짜 기반 upsert 계약을 사용한다. |
| 8 | `/api/v1/todos/hasena/sync/` · `sync_hasena_entries_from_cron` · 외부 Hasena 본문을 최대 80건 동기화 | W0/M0. 내부 Celery/command/view 호출 없음. `CRON_SECRET`/`HASENA_CRON_SECRET` 배포 설정과 전용 service가 존재한다. 대체 HTTP route는 없다. | DRF 인증 비활성 + cron secret POST | **확인 불가.** 저장소 밖 scheduler 사용 여부를 확인할 운영 로그/설정이 없어 제거할 수 없다. |
| 9 | `/api/v1/todos/plan/<pk>/progress/` · `plan_subscription_progress` · 본인 활성 구독의 진도 rows 조회 | W0/M0. 내부 사용 없음. W2인 `/schedules/month/`가 schedule과 로그인 사용자의 `is_completed`를 함께 반환한다. | 인증 GET | **제거.** 실제 client가 사용하는 월별 schedule 계약이 진도 read path를 대체한다. N+1 회귀 테스트도 그 소비 경로로 이전했다. |
| 10 | `/api/v1/todos/plan/<pk>/unsubscribe/` · `plan_subscription_unsubscribe` · 기본 플랜을 제외한 구독과 관련 사용자 artifact 삭제 | W0/M0. 내부 사용 없음. W1인 `DELETE /plan/<pk>/`가 동일한 `_delete_plan_subscription_with_artifacts`를 사용한다. | 인증 POST | **제거.** 완전히 중복된 파괴 동작의 미사용 POST 별칭이다. 삭제/rollback/profile 통계 테스트는 소비 중인 DELETE 계약으로 유지했다. |
| 11 | `/api/v1/todos/reading/` · `update_bible_progress` · schedule 완료/취소 처리 | W0/M0. 동일 callback의 `/reading/update/`는 W2이며 테스트도 그 경로를 쓴다. | 인증 POST | **제거.** view가 아니라 미사용 URL 별칭만 제거했다. callback과 소비 중인 route는 유지된다. |
| 12 | `/api/v1/todos/reading/history/` · `get_reading_history` · plan/month별 본인 `UserBibleProgress` rows 조회 | W0/M0. 내부 사용 없음. `/schedules/month/`가 FE가 실제 쓰는 schedule + completion read model이다. | 인증 GET | **제거.** #9와 중복된 구형 progress-only read surface다. 관련 성능/인가 테스트를 월별 schedule 경로로 이전했다. |
| 13 | `/api/v1/todos/stats/plan/` · `get_plan_stats` · 공개 활성 플랜명과 오늘 완료 사용자 수 조회 | W0/M0. 내부 사용과 동일 응답 대체 경로 없음; scoreboard/home stats에는 일부 원천 데이터만 있다. | 익명 GET | **발전.** 사회적 참여 지표로 가치가 있으나 현재 소비자, cache, 명확한 공개 계약이 없다. 아래 제안대로 통계 surface를 통합한다. |
| 14 | `/api/v1/todos/stats/progress/` · `get_progress_stats` · 플랜 이론 진도율과 로그인 사용자의 진도율 조회 | W0/M0. 내부 사용 없음. schedule/month 데이터로 client 계산은 가능하지만 동일 계약은 없다. | 익명 GET, 인증 시 개인값 포함 | **발전.** 익명/개인 응답이 섞인 계약을 분리하고 실제 dashboard 소비를 붙일 가치가 있다. |
| 15 | `/api/v1/todos/stats/users/` · `get_total_users` · 전체 활성 사용자 또는 활성 플랜 구독자 수 조회 | W0/M0. 내부 사용 없음. staff plan list의 subscriber count만 부분 대체한다. | 익명 GET | **발전.** 공개 social-proof 지표라면 privacy, cache, 명칭을 명확히 한 통합 통계 API로 제공해야 한다. |
| 16 | `/api/v1/todos/stats/visitors/` · `get_visitor_stats` · 오늘/누적 `VisitorCount` 조회 | W0/M0. admin/command/task/view 내부 사용 없음. 대체 route도 없고 모델은 migration utility와 model 무결성 테스트만 사용한다. | 익명 GET | **제거.** 어떤 client도 증가 endpoint를 호출하지 않아 값 자체가 제품 트래픽을 나타내지 않는 고립된 계수 surface다. 기존 DB model/data는 보존했다. |
| 17 | `/api/v1/todos/stats/visitors/increment/` · `increment_visitor_count` · session당 일 1회 방문자 수 증가 | W0/M0. 내부 사용과 대체 경로 없음. | 익명 POST | **제거.** 조회 route와 함께 완전히 고립됐고 현재 web 진입 시 호출되지 않는다. 제품 analytics로 발전시키기보다 전용 관측 도구가 적합하다. |
| 18 | `/api/v1/{auth|accounts}/account-email/` · `account_email` · 현재 이메일 조회, 비밀번호 재확인 후 이메일 변경/미인증 처리 | W0/M0. 내부 호출 없음. `linked-accounts/`는 현재 이메일을 읽지만 변경하지 않는다. 보안/transaction 테스트가 있다. | 인증 GET/PATCH | **발전.** 계정 설정에 필요한 고유 기능이고 보안 검증도 갖췄지만 UI가 없다. 실제 설정 flow와 재인증 UX를 연결한 뒤 운영한다. |
| 19 | `/api/v1/{auth|accounts}/complete-kakao-signup/` · `complete_kakao_signup` · provider token을 재검증하고 legacy Kakao 계정/기본 구독 생성 | W0/M0. `useApi` allowlist 문자열만 있고 호출은 아니다. 새 flow는 `/complete-social-signup/`; legacy provider-claim/rollback 테스트가 남아 있다. | 익명 POST, DRF 인증 비활성 | **유지.** `accounts.urls`의 명시적 하위 호환 인증군이고 별도 legacy payload 계약이다. 외부 구버전 client 단절 근거 없이 제거하지 않는다. |
| 20 | `/api/v1/{auth|accounts}/csrf/` · `get_csrf_token` · CSRF token 발급 및 cookie 설정 | W0/M0. 내부 호출 없음. token login/refresh도 `get_token`을 호출하고 header/cookie를 발급한다. | 익명 GET | **발전.** cookie session bootstrap에서 별도 endpoint가 필요한 조건을 정하고 client에서 사용하거나, 불필요하면 telemetry 후 제거해야 한다. |
| 21 | `/api/v1/{auth|accounts}/login/` · `CookieTokenObtainPairView` · username/password JWT cookie 로그인 | W0/M0. 동일 callback의 `/token/`은 W1이며 legacy route throttle 테스트가 있다. | 익명 POST | **유지.** URLConf가 명시한 하위 호환 alias다. 구버전 외부 client 사용을 배제할 근거가 없어 이번에는 유지한다. |
| 22 | `/api/v1/{auth|accounts}/notification-settings/` · `accounts.views.notification_settings` · `UserReadingSettings`의 daily/weekly/service 알림 필드 조회/변경 | W0/M0. 내부 서비스 사용 없음. W2인 `/todos/notifications/settings/`는 별도 `NotificationSettings` 모델과 실제 발송 설정을 사용한다. | 인증 GET/PATCH | **발전.** 두 설정 모델을 매핑/이관한 뒤 하나의 소비 계약으로 통합해야 한다. 지금 바로 제거하면 저장된 legacy 설정 관리 경로가 사라진다. |
| 23 | `/api/v1/{auth|accounts}/refresh/` · `CookieTokenRefreshView` · cookie/body refresh token으로 JWT 회전 | W0/M0. 동일 callback의 `/token/refresh/`는 W1/M1이고 legacy refresh payload가 characterization에 있다. | 익명 POST, cookie 사용 시 CSRF 검사 | **유지.** 명시적 하위 호환 alias이며 모바일을 포함한 현재 canonical callback과 구현을 공유한다. |
| 24 | `/api/v1/{auth|accounts}/register/` · `register` · username/password/nickname legacy 사용자와 기본 구독 생성 | W0/M0. `useApi` allowlist 문자열만 있다. email 가입은 `/email-register/`지만 payload/identity 계약이 다르고 legacy validator/rollback 테스트가 있다. | 익명 POST | **유지.** URLConf의 하위 호환 인증군이고 email 가입과 동일 계약이 아니다. 외부 구버전 client 종료 근거가 필요하다. |
| 25 | `/api/v1/{auth|accounts}/session/consume/` · `session_bridge_consume` · 1회용 code를 소비해 WebView auth cookie를 설정하고 redirect | W0/**M1** (`mobile/App.tsx`의 WebView 이동 URL). 다른 내부 호출/대체 경로 없음. | 익명 GET, single-use code guard | **유지.** 모바일 native → WebView 인증 동기화의 실제 소비 route다. |
| 26 | `/api/v1/{auth|accounts}/session/issue/` · `session_bridge_issue` · 인증 사용자에게 TTL 60초 1회용 bridge code 발급 | W0/**M1** (`mobile/App.tsx` fetch). 다른 내부 호출/대체 경로 없음. | 인증 POST | **유지.** 모바일 session bridge의 실제 첫 단계다. |
| 27 | `/api/v1/{auth|accounts}/verify/` · `verify_auth` · 인증 여부와 현재 사용자 payload 반환 | W0/M0. `useApi` auth guard 문자열만 있고 호출은 아니다. W1인 `/user/`가 현재 사용자 payload를 반환한다. | 인증 GET | **발전.** health-like auth probe와 user bootstrap을 하나의 canonical 계약으로 정리하고 guard 문자열도 후속 정리해야 한다. |

## 실제 제거와 코드 정리

제거한 canonical route는 8개다.

1. `/api/v1/todos/bible/personal-records/<pk>/`
2. `/api/v1/todos/hasena/<pk>/`
3. `/api/v1/todos/plan/<pk>/progress/`
4. `/api/v1/todos/plan/<pk>/unsubscribe/`
5. `/api/v1/todos/reading/`
6. `/api/v1/todos/reading/history/`
7. `/api/v1/todos/stats/visitors/`
8. `/api/v1/todos/stats/visitors/increment/`

함께 제거한 코드는 `get_reading_history`, `plan_subscription_progress`,
`hasena_record_detail`, `plan_subscription_unsubscribe`,
`get_visitor_stats`, `increment_visitor_count` view와 이 route들만 사용하던
`UserBibleProgressSerializer`, `UserBibleProgressResponseSerializer`,
`VisitorIncrementResponseSerializer`, `VisitorStatsResponseSerializer`다.
`reading/`은 URL 별칭만 제거했고 `update_bible_progress`와
`reading/update/`는 유지했다. 개인 읽기 기록은 `ModelViewSet`에서
list/create mixin ViewSet으로 좁혀 detail route만 없앴으며 serializer와 custom
action은 유지했다. `VisitorCount` 모델/기존 DB data와 공용 삭제 helper 및 공용
응답 serializer도 보존했다.

라우트 동작 테스트를 삭제하지 않았다. 구독 삭제/rollback/profile 통계 테스트는
실제 소비되는 `DELETE /plan/<pk>/`로, progress read의 인가/validation/N+1
테스트는 `/schedules/month/`로 옮겼다. `reading/`을 사용하던 catchup 동기화와
profile 통계 테스트도 동일 callback의 canonical `reading/update/`로 옮겨 같은
invariant를 계속 검사한다.

## 발전 제안

### `/stats/plan/` - Short

- `/stats/` 통합 응답에서 `today_completed_users`의 정의와 KST 기준일을 명시한다.
- 활성 공개 플랜만 노출하는 현재 정책을 유지하고 짧은 TTL cache를 적용한다.
- 홈/플랜 상세 중 실제 표시 위치를 정한 뒤 그 소비 계약에 맞춰 schema를 고정한다.

### `/stats/progress/` - Short

- 익명 이론 진도와 인증 사용자 진도를 별도 필드/operation으로 구분한다.
- 완료 schedule의 분모, 따라잡기 반영 여부, default plan fallback을 제품 규칙으로 문서화한다.
- `/schedules/month/`와 중복 계산하지 않도록 backend 집계 API를 실제 dashboard에 연결한다.

### `/stats/users/` - Quick

- `total_users`가 전체 활성 계정인지 플랜 활성 구독자인지 이름으로 분리한다.
- 공개할 최소 집계 단위와 cache/abuse 제한을 정하고 비활성 플랜 은닉을 유지한다.
- social-proof UI가 없으면 telemetry 기간 후 제거 대상으로 다시 감사한다.

### `/{auth|accounts}/account-email/` - Short

- account settings에 현재 이메일, 재인증 입력, 변경 후 재검증 안내를 연결한다.
- 변경 성공 후 verification mail 발송/재전송 flow와 session 표시를 일관되게 갱신한다.
- canonical `/auth/` prefix만 client에 노출하고 `/accounts/`는 호환 alias 정책을 따른다.

### `/{auth|accounts}/csrf/` - Quick

- 신규 cookie session에서 CSRF cookie가 없는 재현 조건을 먼저 정의한다.
- 그 조건이 있으면 auth bootstrap에서 1회 호출하고, 없으면 호출 telemetry 후 route를 제거한다.
- token refresh와의 책임을 중복시키지 말고 한 가지 CSRF 초기화 계약만 문서화한다.

### `/{auth|accounts}/notification-settings/` - Medium

- `UserReadingSettings` 알림 필드와 실제 발송에 쓰는 `todos.NotificationSettings`의 매핑을 확정한다.
- 기존 값을 데이터 migration한 뒤 `/todos/notifications/settings/`를 단일 source of truth로 만든다.
- migration/호환 기간 종료 후 account route와 구형 serializer를 별도 작업에서 제거한다.

### `/{auth|accounts}/verify/` - Quick

- `/user/`와 `verify/` 중 하나를 canonical auth bootstrap operation으로 선택한다.
- 선택한 응답에 인증 상태와 user shape를 명시하고 refresh interceptor가 그 operation만 사용하게 한다.
- 실제 client 전환과 telemetry 확인 후 남은 alias/guard 문자열을 함께 제거한다.

## schema와 characterization 갱신

- schema paths: **202 → 194** (canonical path 8개 제거)
- operations: **235 → 226** (GET 5, POST 3, DELETE 1 제거)
- API URL leaves: **225 → 216** (명시 route 7개와 personal detail의 기본/format route 2개 제거)
- DRF format aliases: **23 → 22** (personal detail format alias 제거)
- account prefix aliases: 저장소 기준선과 실측 모두 **47 → 47**. 작업 요청에 적힌 49는 현재
  `test_openapi_schema.py`/생성 schema에서 재현되지 않았고 account route는 제거하지 않았다.

`backend/tests/golden/api_characterization.json`은 route count **227 → 218**,
covered route count **204 → 195**, excluded route count **23 → 23**으로 갱신했다.
응답 shape는 변경하지 않았고 위에서 제거한 URL leaf 9개(개인 detail의 format alias 포함)의
관찰 항목만 사라졌다. 이는 route 제거를 반영하는 정당한 golden 갱신이다.
