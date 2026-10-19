# Isolated beta stack: configuration, not a deployment receipt

This is the tracked isolated runtime for `https://beta.maeil1dok.app`.
No provisioning, deployment, DNS change, image build, or live readiness is claimed
by this change. The parent/operator owns those actions after validation.

## Observed deployment history

The read-only release investigation on **2026-10-19** (`web.md`, section 2,
release evidence) recorded Vercel serving the public beta frontend and OCI serving
the isolated API through Caddy on port 8443. Beta worker and beat were running,
while tracked Compose lacked both and masked optional integration env values.
The observed local/remote Compose hashes differed. OCI frontend and tunnel
containers were still present; their presence did not prove public traffic used
them. API `/ready/` returned 200, but AI was not scheduled and web push was inactive.
These are prior observations, not a new remote inspection or deployment receipt.

This configuration completes the worker/env contract described by
`config.beta_settings` while retaining the existing API edge and tunnel fallback.
It does not establish byte-for-byte parity with the uninspected remote Compose,
Vercel project env, or Cloudflare Origin Rule. Reconcile those privately before
any future deployment; do not blindly overwrite the VM configuration.

`docker-compose.beta.yml`, `frontend/Dockerfile.beta`, and the historical account
in [beta-deployment.md](beta-deployment.md) remain baseline evidence. They connect
to production and MUST NOT be used for this cutover or rollback.

## Boundaries

Use `docker-compose.beta-isolated.yml` alone, project `maeil1dok-beta-isolated`, in
a new directory such as `/opt/maeil1dok-beta-isolated`. Do not merge it with an OCI,
development, or legacy-beta Compose file. Do not change primary tunnel config,
primary DNS records, containers, networks, env, users, or databases. Do not share
urban-blanks resources. Only `api-beta-edge` publishes host port **8443**; no other
service publishes ports, and ports 80/443, shared nginx, and external Docker
networks are not used. No new VM, paid tunnel plan, or paid OCI resource is required.

The free Cloudflare tunnel has its own UUID and credentials, and runs only
`cloudflared-beta`. Project-local `beta-app` connects the connector, frontend,
API edge, web, worker, and beat. Internal `beta-data` connects only web, worker,
beat, MySQL, and Redis. MySQL and Redis use project-local named volumes; neither
mounts production storage. Worker and beat share the reviewed beta backend image,
`.env.backend.beta`, `config.beta_settings`, and beta DB/Redis/signing-key overrides.
Both wait for healthy web, MySQL, and Redis; web alone runs migrations and
collectstatic. Their empty entrypoint overrides start Celery directly.

The worker uses concurrency **1**, a 600 MiB memory limit, and 0.75 CPU. Beat uses
one replica, a 300 MiB limit, and 0.5 CPU; do not scale it or run another scheduler
against this broker. Existing Celery schedules run according to beta settings and
configured integrations, without a separate cron container or fabricated heartbeat.

Fallback tunnel ingress in `ops/beta/cloudflared.yml.example`, in order:

| Request at beta hostname | Origin |
| --- | --- |
| `/api/v1/*` | `http://web-beta:8000` |
| exact `/health/` | `http://web-beta:8000` (real DB check) |
| everything else | `http://frontend-beta:3000` |
| any other hostname | 404 |

In particular `/admin/*`, `/auth/*` (including Apple POST callback), `/api/health`,
`/api/hasena/*`, and all assets stay on Nuxt. This does NOT expose Django admin.
`/ready/` remains a frontend route in this tunnel example, not a Django route.
The separate API edge uses `.beta-edge/Caddyfile`: TLS on 8443 proxies to
`web-beta:8000` with Host `beta.maeil1dok.app` and `X-Forwarded-Proto: https`.
It mounts only beta Caddy configuration/certificates read-only and joins only
`beta-app`. It can expose backend `/ready/`; inspect individual readiness fields
instead of treating HTTP 200 as evidence that AI or push delivery is configured.
Keep the web startup gate on `/health/`, not `/ready/`, to avoid a cycle where
worker/beat wait on a heartbeat they have not yet been allowed to produce.
MySQL health, Redis PING, Django `/health/`, and Nuxt `/api/health` are separate
checks, not evidence that OAuth, data, email, or every product journey is ready.

All eight containers have CPU/memory bounds and json-file logs of 10 MB x 3.
The runtime ceilings total 3,328 MiB and 4.5 CPUs; this is a cap, not a reservation
or proof the shared VM has capacity. The operator must check free memory, disk,
and CPU headroom including build/migration peaks without impacting primary.
The connector uses the repository's existing pinned cloudflared version
`2025.7.0`; confirm its availability/support before starting the new connector.

## Credentials, settings, and browser behavior

Create three FRESH, mode-600, beta-only files from the templates. Never source,
copy, interpolate from, or pass `/opt/maeil1dok/.env.oci` or `.env.frontend.oci`.

| Template | Host-local file | Purpose |
| --- | --- | --- |
| `.env.beta-isolated.example` | `.env.beta-isolated` | Reviewed SHA; NEW signing key; NEW MySQL user/root passwords |
| `.env.backend.beta.example` | `.env.backend.beta` | Reviewed beta OAuth/Bible keys and optional server integration values |
| `.env.frontend.beta.example` | `.env.frontend.beta` | Public beta OAuth IDs/JS key and optional private Nuxt integration values |

Empty required values intentionally fail validation/startup. Do not put secrets
in build arguments, source control, logs, or handoff evidence. Escape literal `$`
as `$$` for Compose. Supply a high-entropy `BETA_SECRET_KEY` unrelated to primary;
Compose supplies it to base settings as `SECRET_KEY` too. `config.beta_settings`
requires `BETA_SECRET_KEY` independently and configures JWT signing explicitly,
with no Django signing fallback keys. Primary-only env cannot start that profile.
MySQL host/name/user and Redis URLs are pinned to beta resources in both Compose
and settings. Never copy production users, plans with user progress, database
contents, or backups. Populate only reviewed public/static reference data and
synthetic beta accounts after migrations are validated; the schema starts fresh.

| Purpose | Primary default (unchanged) | Isolated beta |
| --- | --- | --- |
| Access | `access_token` | `beta_access_token` |
| Refresh | `refresh_token` | `beta_refresh_token` |
| Pending signup | `social_signup` | `beta_social_signup` |
| CSRF | `csrftoken` | `beta_csrftoken` |
| Django session | `sessionid` | `beta_sessionid` |

All beta cookies are host-only (no Domain attribute). Auth and session cookies
remain HttpOnly; CSRF stays JS-readable. HTTPS Secure, SameSite=Lax, path `/`, SSL
redirect, and the `X-Forwarded-Proto: https` proxy contract remain enforced.
CORS, CSRF trusted origins, email link base, and OAuth callback origins are beta
only. Existing bearer/body-token flows, cookie CSRF enforcement, refresh rotation,
and signup token contracts are unchanged. The schema's default cookie name stays
`access_token`; generated schema/type files are not part of this change.

A browser may still send primary parent-domain cookies to the beta hostname.
Beta never reads, clears, or falls back to them. Relabelled primary JWTs also fail
the independent signing key. Logout clears only beta access/refresh names using
the same host-only path/domain tuple; signup clearing is likewise beta-only.

Nuxt's `NUXT_PUBLIC_CSRF_COOKIE_NAME` defaults to `csrftoken`. Beta explicitly uses
`beta_csrftoken`; shared parsing compares the entire cookie name, not a substring.
Stored CSRF still takes precedence for primary (`csrfToken`). Beta uses
`csrfToken:beta_csrftoken`, never the former production-backed site's storage key.
The existing 403 -> CSRF bootstrap -> one retry recovery writes that same scoped
key. The public, Bible-cache, and SSR API bases all use the beta HTTPS origin.
Using the public HTTPS origin for SSR avoids internal HTTP redirect/Host changes;
no new SSR auth-cookie forwarding or legacy header/body-token contract is added.

Provider console callbacks must be verified by the operator before OAuth testing:
`https://beta.maeil1dok.app/auth/{kakao,google,apple}/callback`. Apple also requires
the beta web domain. Do not remove or change primary registrations. New scoped env
may contain explicitly reviewed existing provider client IDs if independently
approved; sharing an OAuth registration does not share the database or signing
key. It is NOT permission to inherit production env or secrets wholesale.

Optional `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `CRON_SECRET`, `HASENA_CRON_SECRET`,
and `WEB_PUSH_VAPID_*` values come from the reviewed beta backend env file.
Frontend cron/Gemini/YouTube values, including their `NUXT_*` runtime equivalents,
come from its beta env file. Compose does not redeclare these keys as empty
strings: an empty `environment` entry overrides and disables `env_file` values.
The templates are starting points, not proof these optional keys exist or that
external integrations work. Add only reviewed beta-specific values; never copy
production env wholesale or put private keys under `NUXT_PUBLIC_*`.

Real email remains disabled: all three Django services force an empty
`RESEND_API_KEY`, and `config.beta_settings` independently sets it to `None` and
selects `ACCOUNT_MAIL_TRANSPORT=beta-spool`. Sentry's existing empty overrides
remain unchanged. Beta account mail uses an
operator-only private capture spool, not Django EMAIL_BACKEND or a recipient
provider. Read [beta-test-mail.md](beta-test-mail.md) for required 0700 host
preparation, secure token-link retrieval, quota, and beta-only receipt semantics.
The UI labels it TEST MAIL; success means captured, not delivered. Do not inject a
production mail key. Only web and worker mount the same private beta spool,
with host-path auto-creation disabled; beat schedules work and has no spool mount.
Missing or unwritable spool storage fails mail capture without provider fallback.
Worker/beat configuration alone does not prove asynchronous execution or external
delivery. `/api/hasena/latest-video` remains the existing frontend public-source
lookup, not a production API.

## Operator-owned preflight and cutover (NOT executed by this task)

1. Finish model/migration coordination and isolated test-DB checks. Run the
   focused tests listed in `.omo/qa/lab127-beta-isolation.md`; later full
   frontend/backend/build and migration validation belong to the parent after
   frozen browser QA ends. Confirm capacity and a reviewed source SHA/pair digest.
2. Create the three fresh files above and review `docker compose -f
   docker-compose.beta-isolated.yml --env-file .env.beta-isolated config --quiet`
   in the isolated directory. Inspect the rendered config privately for accidental
   primary paths, endpoints, tokens, or networks. Do not print secret values.
3. For the API-edge path, prepare beta-only `.beta-edge/origin.pem` and `origin.key`
   and the tracked Caddyfile. Confirm exclusive use of port 8443 and the reviewed
   beta origin routing without changing shared ports or production DNS.
   Provision a separate **free** fallback tunnel only when required. Place its
   credentials at `.beta-tunnel/credentials.json`; render the example to
   `.beta-tunnel/config.yml` with the matching NEW UUID. These files are ignored
   by git and mounted read-only. Restrict host access, while ensuring the
   non-root cloudflared container user can read them. Validate ingress with that
   image/version and config. Never point these mounts at primary credentials.
4. Parent builds/starts only the new project and runs its normal migration
   entrypoint against the new MySQL volume. No production snapshot restore.
   Validate app/data network membership, only edge port 8443 published, beta cookie
   names/domains, genuine DB/Redis health, and synthetic-account auth flows.
   Verify one beat instance, worker consumption on beta Redis, task effects only
   in beta DB, optional integration settings, and private test-mail capture.
   If safe pre-cutover testing needs a temporary tunnel route, it must be
   separately approved: no implicit hostname or primary tunnel edits here.
5. Keep the selected beta serving path in maintenance until verified. Preserve
   Vercel/API-edge routing when that is the chosen path; enabling the fallback
   tunnel is a separate beta-only cutover, not an automatic DNS rewrite.
   No apex/www/api or primary-tunnel change is required. A stale beta rule on the
   primary connector is not a rollback target.
6. Validate externally through the selected path: `/health/`, `/api/health`,
   `/_build-marker.json`, versioned API, frontend admin routes, callbacks, assets,
   cookie coexistence, refresh/CSRF and synthetic-account sign-in/out. Check
   Secure/SameSite and HTTPS redirects with the real proxy, not only local HTTP.
   Record actual responses/digests; configuration tests are not live readiness.

The same hostname previously served production-backed JS/PWA resources. Before
acceptance, verify a fresh navigation/service-worker update is using the new
bundle and beta API base; retire beta-only stale CacheStorage/service-worker
artifacts if necessary. Do not clear parent-domain primary cookies. An already
open old tab can still call the production API directly until refreshed: changing
beta DNS cannot revoke that client, and this task does not modify production to
block it. Keep beta in maintenance if that residual client exposure is not yet
operationally acceptable.

## Rollback

Rollback is an atomic **isolated frontend/backend release**, including worker
and beat images, with compatible beta migrations and the same beta-only signing
key, networks, MySQL, Redis, API edge, and selected frontend/tunnel path.
Retain reviewed isolated image digests; assess migration compatibility before
reverting either image. If no known-good isolated pair exists or data migrations
are incompatible, serve beta-only maintenance instead. Do not restore primary
backups, run legacy `docker-compose.beta.yml`, change beta DNS back to the primary
tunnel, or roll back only the frontend to a production-backed image. Never run
`down -v` as a rollback; it destroys beta data. Primary/urban-blanks remain untouched.
