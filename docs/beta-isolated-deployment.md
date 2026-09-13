# Isolated beta pair (LAB-127): configuration, not a deployment receipt

This is the replacement design for `https://beta.maeil1dok.app` on the existing VM.
No provisioning, deployment, DNS change, image build, or live readiness is claimed
by this change. The parent/operator owns those actions after validation.

`docker-compose.beta.yml`, `frontend/Dockerfile.beta`, and the historical account
in [beta-deployment.md](beta-deployment.md) remain baseline evidence. They connect
to production and MUST NOT be used for this cutover or rollback.

## Boundaries

Use `docker-compose.beta-isolated.yml` alone, project `maeil1dok-beta-isolated`, in
a new directory such as `/opt/maeil1dok-beta-isolated`. Do not merge it with an OCI,
development, or legacy-beta Compose file. Do not change primary tunnel config,
primary DNS records, containers, networks, env, users, or databases. Do not share
urban-blanks resources. No host ports, nginx, external Docker networks, new VM,
paid tunnel plan, or paid OCI resource is required.

The new, free Cloudflare tunnel has its own UUID and credentials, and runs only
`cloudflared-beta`. Its networks are project-local `beta-app` (connector, frontend,
web) and internal `beta-data` (web, MySQL, Redis). MySQL and Redis have new,
project-local named volumes; neither mounts production storage. There is no
worker, beat, cron service, AI schedule, or fabricated heartbeat.

Ingress in `ops/beta/cloudflared.yml.example`, in order:

| Request at beta hostname | Origin |
| --- | --- |
| `/api/v1/*` | `http://web-beta:8000` |
| exact `/health/` | `http://web-beta:8000` (real DB check) |
| everything else | `http://frontend-beta:3000` |
| any other hostname | 404 |

In particular `/admin/*`, `/auth/*` (including Apple POST callback), `/api/health`,
`/api/hasena/*`, and all assets stay on Nuxt. This does NOT expose Django admin.
`/ready/` is not a backend beta route and must not be used as a success gate:
production readiness expects beat/AI heartbeats that beta deliberately lacks.
MySQL health, Redis PING, Django `/health/`, and Nuxt `/api/health` are separate
checks, not evidence that OAuth, data, email, or every product journey is ready.

All five containers have CPU/memory bounds and json-file logs of 10 MB x 3.
The runtime ceilings total 2,108 MiB and 3 CPUs; this is a cap, not a reservation
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
| `.env.backend.beta.example` | `.env.backend.beta` | Explicitly reviewed beta OAuth clients and optional Bible key |
| `.env.frontend.beta.example` | `.env.frontend.beta` | Public beta OAuth client IDs/JS key only |

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

Real email delivery, Resend, Sentry, cron, Gemini, YouTube API keys and web push
are disabled in the shipped isolated profile/config. Beta mail now uses an
operator-only private capture spool, not Django EMAIL_BACKEND or a recipient
provider. Read [beta-test-mail.md](beta-test-mail.md) for required 0700 host
preparation, secure token-link retrieval, quota, and beta-only receipt semantics.
The UI labels it TEST MAIL; success means captured, not delivered. Do not inject a
production mail key. No worker/beat means asynchronous work is not claimed
operational. `/api/hasena/latest-video` remains the existing frontend public-source
lookup, not a production API or paid AI job.

## Operator-owned preflight and cutover (NOT executed by this task)

1. Finish model/migration coordination and isolated test-DB checks. Run the
   focused tests listed in `.omo/qa/lab127-beta-isolation.md`; later full
   frontend/backend/build and migration validation belong to the parent after
   frozen browser QA ends. Confirm capacity and a reviewed source SHA/pair digest.
2. Create the three fresh files above and review `docker compose -f
   docker-compose.beta-isolated.yml --env-file .env.beta-isolated config --quiet`
   in the isolated directory. Inspect the rendered config privately for accidental
   primary paths, endpoints, tokens, or networks. Do not print secret values.
3. Provision a separate **free** tunnel only after approval. Place its new
   credentials at `.beta-tunnel/credentials.json`; render the example to
   `.beta-tunnel/config.yml` with the matching NEW UUID. These files are ignored
   by git and mounted read-only. Restrict host access, while ensuring the
   non-root cloudflared container user can read them. Validate ingress with that
   image/version and config. Never point these mounts at primary credentials.
4. Parent builds/starts only the new project and runs its normal migration
   entrypoint against the new MySQL volume. No production snapshot restore.
   Validate new app/data network membership, zero published ports, beta cookie
   names/domains, genuine DB/Redis health, and synthetic-account auth flows.
   If safe pre-cutover testing needs a temporary tunnel route, it must be
   separately approved: no implicit hostname or primary tunnel edits here.
5. Keep the beta hostname in maintenance while the new pair is unverified. The
   parent changes only the existing beta DNS record to the new tunnel UUID after
   its isolated origin routing passes. No apex/www/api or primary-tunnel change
   is required. A stale beta rule on the primary connector is not a rollback
   target; leave primary configuration alone in this task.
6. Validate externally through the new connector: `/health/`, `/api/health`,
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

Rollback is an atomic **isolated frontend/backend pair** with compatible beta
migrations and the same beta-only signing key, networks, MySQL, Redis, and tunnel.
Retain reviewed isolated image digests; assess migration compatibility before
reverting either image. If no known-good isolated pair exists or data migrations
are incompatible, serve beta-only maintenance instead. Do not restore primary
backups, run legacy `docker-compose.beta.yml`, change beta DNS back to the primary
tunnel, or roll back only the frontend to a production-backed image. Never run
`down -v` as a rollback; it destroys beta data. Primary/urban-blanks remain untouched.
