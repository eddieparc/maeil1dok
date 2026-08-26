# OpenAPI contract

`schema.yml` is the committed OpenAPI 3.0.3 contract. It is generated with
`drf-spectacular==0.30.0`; that version is pinned in `requirements.txt`.
`drf-spectacular` was selected because it discovers the project's DRF
`@api_view` functions, ViewSets, custom `@action`s, and `DefaultRouter` routes.
Its response inference for function-based views is intentionally not treated as
complete (see the characterization audit below).

## Generate and validate

```sh
cd backend
DJANGO_SETTINGS_MODULE=config.test_settings \
SECRET_KEY=x KAKAO_CLIENT_ID=x KAKAO_REDIRECT_URI=http://x \
.venv/bin/python manage.py spectacular --file schema.yml --validate
```

`SORT_OPERATIONS` and `SORT_OPERATION_PARAMETERS` are enabled. The only path
inserted by post-processing is sorted with the other paths. Database-derived
full-range `IntegerField` limits are removed because DRF otherwise emits
backend-dependent SQLite/MySQL bounds. Two consecutive runs from the same
source produce byte-identical output under either database setting.

The drift gate is `tests.test_openapi_schema`. It generates into a temporary
file, validates it, and compares the exact bytes with `schema.yml`. It also
checks URL-leaf coverage and the duplicate-prefix deprecation invariant. CI
runs the gate in the `backend-ci` job.

## Route coverage

The active test URLconf has 225 API URL leaves:

| Prefix | URL leaves |
| --- | ---: |
| `/api/v1/auth/` | 47 |
| `/api/v1/accounts/` | 47 |
| `/api/v1/todos/` | 127 |
| `/api/v1/bible-cache/` | 4 |
| **Total** | **225** |

The schema contains 202 path items and 235 operations. All 225 leaves are
accounted for:

- 201 non-format path items are discovered by drf-spectacular.
- `/api/v1/todos/` is added by `config.openapi.add_router_api_root` because
  drf-spectacular deliberately excludes DRF's generated `APIRootView`.
- 23 DRF format-suffix leaves (for example, `.json`) are media-format aliases
  represented by their corresponding canonical path item rather than duplicate
  OpenAPI paths. Nine have a known runtime discrepancy recorded below.
- Collapsing the 47 auth/accounts compatibility pairs leaves the measured 155
  logical path templates.

There are therefore **no unreported API URL omissions**: the 23 physical
format-suffix leaves omitted as separate path items are counted above, and their
nine behavioral mismatches are listed below. The generated schema still reports
112 unique response-inference errors: these are operations that remain present
but have `No response body`, not omitted paths.

## Authentication

`accounts.spectacular.CookieJWTAuthenticationScheme` records the two real
alternatives implemented by `CookieJWTAuthentication`:

- the HttpOnly `access_token` cookie (unsafe methods also need CSRF), or
- an `Authorization: Bearer <JWT>` header.

## Duplicate `/auth/` and `/accounts/` prefixes

No URL was removed. Each of the 47 path pairs remains in the schema, and exactly
one copy of every operation is marked `deprecated` with its canonical target.
There are 49 operations because `account-email` and `notification-settings`
accept two methods.

The canonical split follows current clients:

- `/api/v1/accounts/` is canonical for `profile/`, `follow/`, `unfollow/`,
  `followers/`, `following/`, `friends/`, `search/`, and `reading-settings/`.
  Frontend usages include `app/stores/profile.ts`, `app/stores/social.ts`, and
  `app/stores/readingSettings.ts`.
- `/api/v1/auth/` is canonical for all other account URL suffixes. Frontend
  authentication usages are in `app/composables/useAuthService.ts`, login and
  registration pages, and account settings. Mobile uses only `/api/v1/auth/`
  for login, refresh, logout, social login, and session bridge calls in
  `mobile/App.tsx`.
- Repository searches found no frontend/mobile use of profile/social routes
  through `/auth/`, and no authentication route use through `/accounts/`.

This preserves compatibility while telling generators which path to prefer.

## HTTP characterization comparison

The comparison used `tests/golden/api_characterization.json`, collapsing the
prefix aliases and format aliases before comparing. Its 155 logical templates
break down as follows:

- 143 are captured by the golden suite.
- 12 are explicitly excluded because they call external OAuth, email, content,
  YouTube, or AI services.
- Of the 143 captured templates, 118 observed an HTTP 200 JSON shape for at
  least one persona and 25 did not. The golden records structure only for HTTP
  200, so the latter cannot be response-shape compared.
- The schema has 186 canonical HTTP operations because several templates accept
  more than the one method selected by characterization.

After corrections, 22 of the 118 observed-200 operations structurally match the
golden observation. The corrected low-risk cases are:

- all four bible-cache responses and their query parameters;
- the DefaultRouter API-root response;
- bookmark/note/highlight `by-chapter` and `delete-all` responses;
- personal-record `by-book`, `dates`, and `stats` responses;
- cookie token/login and refresh responses (source-verified; see the golden
  normalization limitation below).

The ordinary list/detail operations for bookmark, note, highlight, and personal
record ViewSets were already correctly inferred.

### Known incomplete response schemas (94 observed-200 operations)

Every operation below returned structured HTTP 200 JSON in the golden but has
no response-body schema because it is a function-based view without an
`@extend_schema` response. The path and operation remain in `schema.yml`.

#### Accounts canonical paths (10)

- GET `/api/v1/accounts/followers/{user_id}/`
- GET `/api/v1/accounts/following/{user_id}/`
- GET `/api/v1/accounts/friends/`
- PUT `/api/v1/accounts/profile/`
- GET `/api/v1/accounts/profile/{user_id}/`
- GET `/api/v1/accounts/profile/{user_id}/achievements/`
- GET `/api/v1/accounts/profile/{user_id}/calendar/`
- GET `/api/v1/accounts/reading-settings/`
- PATCH `/api/v1/accounts/reading-settings/update/`
- GET `/api/v1/accounts/search/`

#### Auth canonical paths (17)

- GET `/api/v1/auth/account-email/`
- POST `/api/v1/auth/check-nickname/`
- POST `/api/v1/auth/check-username/`
- GET `/api/v1/auth/csrf/`
- POST `/api/v1/auth/delete-account/`
- POST `/api/v1/auth/email-login/`
- POST `/api/v1/auth/email-register/`
- GET `/api/v1/auth/linked-accounts/`
- POST `/api/v1/auth/logout-all/`
- POST `/api/v1/auth/logout/`
- GET `/api/v1/auth/notification-settings/`
- POST `/api/v1/auth/oauth/link-state/`
- POST `/api/v1/auth/session/issue/`
- POST `/api/v1/auth/unlink-social/`
- GET `/api/v1/auth/user/`
- POST `/api/v1/auth/verify-reset-token/`
- GET `/api/v1/auth/verify/`

#### Todos canonical paths (67)

- GET `/api/v1/todos/bible/home-stats/`
- GET `/api/v1/todos/bible/reading-position/`
- GET `/api/v1/todos/calendar/last-incomplete/`
- GET `/api/v1/todos/calendar/month/`
- GET `/api/v1/todos/calendar/settings/`
- PATCH `/api/v1/todos/calendar/settings/{id}/`
- POST `/api/v1/todos/calendar/settings/reorder/`
- POST `/api/v1/todos/catchup-schedules/{schedule_id}/toggle/`
- GET `/api/v1/todos/catchup-sessions/{session_id}/`
- POST `/api/v1/todos/catchup-sessions/{session_id}/abandon/`
- POST `/api/v1/todos/catchup-sessions/{session_id}/complete/`
- GET `/api/v1/todos/catchup-sessions/{session_id}/schedules/`
- PATCH `/api/v1/todos/catchup-sessions/{session_id}/update/`
- GET `/api/v1/todos/catchup-sessions/active/`
- GET `/api/v1/todos/certification/progress/`
- GET `/api/v1/todos/detail/`
- GET `/api/v1/todos/groups/`
- GET `/api/v1/todos/groups/{group_id}/`
- GET `/api/v1/todos/groups/{group_id}/member-progress/`
- GET `/api/v1/todos/groups/{group_id}/members/`
- PATCH `/api/v1/todos/groups/{group_id}/visibility/`
- GET `/api/v1/todos/hasena/`
- GET `/api/v1/todos/hasena/{id}/`
- GET `/api/v1/todos/hasena/calendar/`
- GET `/api/v1/todos/hasena/day/`
- GET `/api/v1/todos/hasena/stats/`
- GET `/api/v1/todos/hasena/status/`
- GET `/api/v1/todos/hasena/summary/`
- POST `/api/v1/todos/hasena/update/`
- GET `/api/v1/todos/invitations/`
- POST `/api/v1/todos/invitations/{invitation_id}/respond/`
- GET `/api/v1/todos/next-position/`
- GET `/api/v1/todos/notifications/`
- PATCH `/api/v1/todos/notifications/{notification_id}/read/`
- POST `/api/v1/todos/notifications/mark-all-read/`
- GET `/api/v1/todos/notifications/push/config/`
- POST `/api/v1/todos/notifications/push/subscriptions/`
- POST `/api/v1/todos/notifications/push/subscriptions/remove/`
- GET `/api/v1/todos/notifications/settings/`
- GET `/api/v1/todos/plan/`
- GET `/api/v1/todos/plan/{id}/`
- GET `/api/v1/todos/plan/{id}/progress/`
- POST `/api/v1/todos/plan/{id}/toggle-active/`
- POST `/api/v1/todos/plan/{id}/unsubscribe/`
- GET `/api/v1/todos/plans/`
- GET `/api/v1/todos/plans/user/`
- GET `/api/v1/todos/reading/history/`
- GET `/api/v1/todos/schedules/`
- GET `/api/v1/todos/schedules/{id}/`
- GET `/api/v1/todos/schedules/month/`
- GET `/api/v1/todos/schedules/today/`
- GET `/api/v1/todos/scoreboard/`
- GET `/api/v1/todos/scoreboard/friends/`
- GET `/api/v1/todos/scoreboard/group/{group_id}/`
- GET `/api/v1/todos/scoreboard/my-ranking/`
- GET `/api/v1/todos/stats/plan/`
- GET `/api/v1/todos/stats/progress/`
- GET `/api/v1/todos/stats/users/`
- GET `/api/v1/todos/stats/visitors/`
- POST `/api/v1/todos/stats/visitors/increment/`
- GET `/api/v1/todos/subscriptions/{subscription_id}/catchup-status/`
- POST `/api/v1/todos/subscriptions/{subscription_id}/catchup/preview/`
- GET `/api/v1/todos/user/video/intro/`
- GET `/api/v1/todos/users/{user_id}/groups/`
- GET `/api/v1/todos/video/intro/`
- GET `/api/v1/todos/video/intro/{id}/`
- POST `/api/v1/todos/video/intro/progress/`

### Format-suffix discrepancy (9 physical routes)

The schema represents each `.json` URL with its non-suffix path item, as
OpenAPI normally models content negotiation. The golden proves that nine custom
ViewSet actions are not currently equivalent: anonymous requests return 401,
but both authenticated personas receive 500 because the action method does not
accept DRF's `format` keyword. The canonical non-suffix route returns 200. This
pre-existing runtime behavior was not fixed or hidden in the golden:

- GET `/api/v1/todos/bible/bookmarks/by-chapter.json/`
- DELETE `/api/v1/todos/bible/bookmarks/delete-all.json/`
- GET `/api/v1/todos/bible/highlights/by-chapter.json/`
- DELETE `/api/v1/todos/bible/highlights/delete-all.json/`
- GET `/api/v1/todos/bible/notes/by-chapter.json/`
- DELETE `/api/v1/todos/bible/notes/delete-all.json/`
- GET `/api/v1/todos/bible/personal-records/by-book.json/`
- GET `/api/v1/todos/bible/personal-records/dates.json/`
- GET `/api/v1/todos/bible/personal-records/stats.json/`

These physical variants are known schema inaccuracies until the runtime accepts
`format` or they are represented as separate OpenAPI paths.

### Golden limitations and unassessed responses

The golden normalizer treats any value under a key named `user` as an ID. The
actual `/api/v1/auth/token/` and `/api/v1/auth/login/` responses contain a
`UserSerializer` object. Their new OpenAPI response is source-accurate, but a
mechanical golden comparison reports the object as `<id>`; this is an audit
false positive, not a schema mismatch.

The following 12 canonical routes (22 physical routes after auth/accounts
aliases) are explicit golden exclusions, so no success response shape was
observed:

- `/api/v1/auth/social-login/` - Kakao OAuth call.
- `/api/v1/auth/complete-kakao-signup/` - Kakao credential validation.
- `/api/v1/auth/social-login/v2/` - Kakao/Google/Apple OAuth call.
- `/api/v1/auth/complete-social-signup/` - external credential validation.
- `/api/v1/auth/link-social/` - external provider call.
- `/api/v1/auth/merge-accounts/` - external provider call.
- `/api/v1/auth/send-verification/` - production email.
- `/api/v1/auth/verify-email/` - production welcome email on success.
- `/api/v1/auth/resend-verification/` - production email.
- `/api/v1/auth/request-password-reset/` - production email.
- `/api/v1/todos/hasena/sync/` - external content fetch.
- `/api/v1/todos/hasena/summary/cron/` - YouTube and AI providers.

Another 25 characterized logical routes did not return HTTP 200 for any of the
three personas (they returned redirects, 201, 400, 401, 403, or 404), so the
current golden contains statuses but no response shape for them. No accuracy
claim is made for those success bodies or for additional methods not selected by
the one-method-per-route characterization harness.

## Remaining generator warnings

Schema validation succeeds. drf-spectacular emits five warnings for colliding
auto-generated operation IDs on function-based list/detail pairs (`groups`,
`hasena`, `plan`, `schedules`, and `video/intro`). It resolves them with stable
numeric suffixes after sorted generation; paths and methods are unaffected.
