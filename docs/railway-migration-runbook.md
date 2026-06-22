# Railway Migration Runbook

This runbook moves Maeil1Dok from `192.168.0.10:/home/jgp/maeil1dok` to
Railway while keeping the source Docker volumes intact until Railway has been
validated and DNS is ready to switch.

## Railway Services

Railway project:

- Name: `maeil1dok-production`
- Project ID: `d6c3fd88-204f-4736-a40b-f55c24f34c36`
- Environment ID: `9ff3d9ed-ad1f-46cc-ae8b-eda5baac5784`

Services:

- `MySQL`: Railway MySQL service
- `Redis`: Railway Redis service
- `maeil1dok-backend`: deploys from `railway/backend.web.toml`
- `maeil1dok-celery-worker`: deploys from `railway/backend.worker.toml`
- `maeil1dok-celery-beat`: deploys from `railway/backend.beat.toml`
- `maeil1dok-db-backup`: scheduled backup service from
  `railway/backend.backup.toml`
- `maeil1dok-frontend`: deploys from `railway/frontend.toml`

The repo keeps service-specific Railway config sources under `railway/`.
Deployment must flow through GitHub pull requests and Railway's GitHub
integration. Do not deploy service-root upload bundles from a local Railway CLI
session.

For a fresh recreation, add the managed data services first:

```sh
railway add --database mysql
railway add --database redis
```

Current Railway-generated domains:

- Backend: `https://maeil1dok-backend-production.up.railway.app`
- Frontend: `https://maeil1dok-frontend-production.up.railway.app`

## Railway Auto Deploy

Preferred automatic deployment line:

- GitHub repo: `eddieparc/maeil1dok`
- Branch: `main`.
- Service config sources: `railway/backend.web.toml`,
  `railway/backend.worker.toml`, `railway/backend.beat.toml`,
  `railway/backend.backup.toml`, and `railway/frontend.toml`.

Set each Railway service root/config path to the matching source file above and
enable automatic deploys for `main`. Use Railway root directories `/backend`
for the backend, worker, beat, and backup services, and `/frontend` for the
frontend service. Keep the Railway config file paths absolute from the repo
root, for example `/railway/backend.web.toml`, because Railway config file
paths do not follow the service root directory.

## Backend Variables

Set these variables on `maeil1dok-backend`:

```text
DEBUG=False
SECRET_KEY=<existing SECRET_KEY>
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
REDIS_URL=${{Redis.REDIS_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{Redis.REDIS_URL}}
ALLOWED_HOSTS=maeil1dok.app,www.maeil1dok.app,api.maeil1dok.app,maeil1dok-backend-production.up.railway.app,healthcheck.railway.app
CORS_ALLOWED_ORIGINS=["https://maeil1dok.app","https://www.maeil1dok.app","https://maeil1dok-frontend-production.up.railway.app"]
CSRF_TRUSTED_ORIGINS=["https://maeil1dok.app","https://www.maeil1dok.app","https://api.maeil1dok.app","https://maeil1dok-backend-production.up.railway.app","https://maeil1dok-frontend-production.up.railway.app"]
COOKIE_DOMAIN=.maeil1dok.app
FRONTEND_URL=https://maeil1dok.app
SECURE_SSL_REDIRECT=False
KAKAO_CLIENT_ID=<existing KAKAO_CLIENT_ID>
KAKAO_REDIRECT_URI=https://maeil1dok.app/auth/kakao/callback
GOOGLE_CLIENT_ID=<existing GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<existing GOOGLE_CLIENT_SECRET>
GOOGLE_REDIRECT_URI=https://maeil1dok.app/auth/google/callback
APPLE_CLIENT_ID=<existing APPLE_CLIENT_ID>
APPLE_TEAM_ID=<existing APPLE_TEAM_ID>
APPLE_KEY_ID=<existing APPLE_KEY_ID>
APPLE_PRIVATE_KEY=<existing multiline APPLE_PRIVATE_KEY>
RESEND_API_KEY=<existing RESEND_API_KEY>
FROM_EMAIL=noreply@maeil1dok.app
SENTRY_DSN=<maeil1dok-backend Sentry DSN>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_SEND_DEFAULT_PII=false
GEMINI_API_KEY=<existing GEMINI_API_KEY>
YOUTUBE_API_KEY=<existing GEMINI_API_KEY unless a dedicated key is added>
CRON_SECRET=<existing CRON_SECRET>
HASENA_CRON_SECRET=<existing HASENA_CRON_SECRET>
```

Set the same Django/Redis variables on both worker services, plus:

```text
RUN_MIGRATIONS=false
RUN_COLLECTSTATIC=false
```

`maeil1dok-celery-worker` must deploy from `railway/backend.worker.toml` and
run `celery -A config worker -l info`. `maeil1dok-celery-beat` must deploy from
`railway/backend.beat.toml` and run `celery -A config beat -l info`, so the
`send-due-notification-reminders` schedule in `backend/config/celery.py` creates
통독/하세나 OS push reminders without manual Railway cron edits.

`healthcheck.railway.app` and `SECURE_SSL_REDIRECT=False` are required for the
Railway internal HTTP healthcheck. Public traffic still terminates HTTPS at the
Railway edge and receives the Django HSTS/security headers.

Set these variables on `maeil1dok-db-backup`:

```text
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
BACKUP_DIR=/backups/maeil1dok
BACKUP_RETENTION_DAYS=14
```

## Frontend Variables

Set these variables on `maeil1dok-frontend`:

```text
NODE_ENV=production
HOST=0.0.0.0
NUXT_PUBLIC_API_BASE=https://<backend Railway domain until DNS cutover>
NUXT_INTERNAL_API_BASE=http://maeil1dok-backend.railway.internal:8000
NUXT_PUBLIC_BIBLE_CACHE_URL=https://<backend Railway domain until DNS cutover>
KAKAO_CLIENT_ID=<frontend KAKAO_CLIENT_ID>
KAKAO_JS_KEY=<frontend KAKAO_JS_KEY>
KAKAO_REDIRECT_URI=https://maeil1dok.app/auth/kakao/callback
GOOGLE_CLIENT_ID=<frontend GOOGLE_CLIENT_ID>
GOOGLE_REDIRECT_URI=https://maeil1dok.app/auth/google/callback
APPLE_CLIENT_ID=<existing APPLE_CLIENT_ID>
APPLE_REDIRECT_URI=https://maeil1dok.app/auth/apple/callback
NUXT_PUBLIC_SENTRY_DSN=<maeil1dok-frontend Sentry DSN>
NUXT_PUBLIC_SENTRY_ENVIRONMENT=production
NUXT_PUBLIC_SENTRY_RELEASE=<Sentry release, usually the deployed commit SHA>
NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ORG=<Sentry org slug>
SENTRY_PROJECT=maeil1dok-frontend
SENTRY_AUTH_TOKEN=<Sentry organization auth token for source maps>
CRON_SECRET=<existing CRON_SECRET>
HASENA_CRON_SECRET=<existing HASENA_CRON_SECRET>
GEMINI_API_KEY=<existing GEMINI_API_KEY>
YOUTUBE_API_KEY=<existing GEMINI_API_KEY unless a dedicated key is added>
```

The public values should use `https://api.maeil1dok.app` after DNS is
verified. Keep `NUXT_INTERNAL_API_BASE` on the Railway private network so
server-side frontend requests do not round-trip through Cloudflare/public
networking.

## Fresh Staging Dump

Capture the latest source data before the first Railway restore:

```sh
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/jgp/maeil1dok-backups/railway-migration-${STAMP}"
ssh 192.168.0.10 "mkdir -p ${BACKUP_DIR} && chmod 700 ${BACKUP_DIR}"
ssh 192.168.0.10 "docker exec maeil1dok_db mysqldump --single-transaction --routines --triggers --events -uroot -p\"\$DB_ROOT_PASSWORD\" dailybible | gzip -9 > ${BACKUP_DIR}/mysql.sql.gz"
ssh 192.168.0.10 "sha256sum ${BACKUP_DIR}/mysql.sql.gz > ${BACKUP_DIR}/mysql.sql.gz.sha256"
ssh 192.168.0.10 "sha256sum -c ${BACKUP_DIR}/mysql.sql.gz.sha256"
```

The first Railway restore used this source dump:

```text
/home/jgp/maeil1dok-backups/railway-migration-20260611-212557/mysql.sql.gz
```

Capture source counts:

```sh
ssh 192.168.0.10 "docker exec maeil1dok_db mysql -uroot -p\"\$DB_ROOT_PASSWORD\" dailybible -N -e \"
SELECT 'accounts_user', COUNT(*) FROM accounts_user
UNION ALL SELECT 'accounts_userprofile', COUNT(*) FROM accounts_userprofile
UNION ALL SELECT 'accounts_socialaccount', COUNT(*) FROM accounts_socialaccount
UNION ALL SELECT 'todos_plansubscription', COUNT(*) FROM todos_plansubscription
UNION ALL SELECT 'todos_dailybibleschedule', COUNT(*) FROM todos_dailybibleschedule
UNION ALL SELECT 'todos_userbibleprogress', COUNT(*) FROM todos_userbibleprogress
UNION ALL SELECT 'bible_cache_biblecontentcache', COUNT(*) FROM bible_cache_biblecontentcache
UNION ALL SELECT 'django_session', COUNT(*) FROM django_session
UNION ALL SELECT 'token_blacklist_blacklistedtoken', COUNT(*) FROM token_blacklist_blacklistedtoken;\""
```

## Restore To Railway

Restore after Railway MySQL is created and TCP/database credentials are visible:

```sh
gunzip -c mysql.sql.gz | mysql --host "$RAILWAY_MYSQL_HOST" --port "$RAILWAY_MYSQL_PORT" --user "$RAILWAY_MYSQL_USER" --password="$RAILWAY_MYSQL_PASSWORD" "$RAILWAY_MYSQL_DATABASE"
```

Then run the same count query against Railway MySQL and compare it with the
source count artifact before accepting the restore.

## Smoke Checks

Use Railway-generated domains before custom DNS:

```sh
curl -i "https://<backend Railway domain>/admin/login/"
curl -i "https://<backend Railway domain>/api/v1/todos/plans/"
curl -i "https://<frontend Railway domain>/"
```

Validated staging endpoints:

```text
https://maeil1dok-backend-production.up.railway.app/admin/login/
https://maeil1dok-backend-production.up.railway.app/api/v1/todos/plans/
https://maeil1dok-frontend-production.up.railway.app/
```

All returned HTTP 200 after the first Railway restore.

## Custom Domains

These custom domains have been created in Railway. The production cutover only
requires the apex and API host:

```text
maeil1dok.app      CNAME 3brjtmda.up.railway.app
api.maeil1dok.app  CNAME jj9xe8wf.up.railway.app
```

`www.maeil1dok.app is intentionally out of scope` for the current cutover.

Railway also issued TXT verification tokens for each domain. Add the CNAME
records first; if Railway still requests ownership verification, add the TXT
records shown in the Railway dashboard for the same custom domains.

## Cloudflare DNS

Set only these Cloudflare DNS traffic records for production:

```text
maeil1dok.app      CNAME 3brjtmda.up.railway.app
api.maeil1dok.app  CNAME jj9xe8wf.up.railway.app
```

After Cloudflare/Railway verification, set frontend API variables to:

```text
NUXT_PUBLIC_API_BASE=https://api.maeil1dok.app
NUXT_INTERNAL_API_BASE=http://maeil1dok-backend.railway.internal:8000
NUXT_PUBLIC_BIBLE_CACHE_URL=https://api.maeil1dok.app
```

## Scheduled Backups

Use the `maeil1dok-db-backup` Railway service. It runs
`/app/scripts/railway_mysql_backup.sh` on cron schedule `0 18 * * *`, writes
compressed dumps under `/backups/maeil1dok`, creates `mysql.sql.gz.sha256`, and
verifies each backup with `sha256sum -c`.

Attach a persistent Railway volume at `/backups` before accepting the backup
service. Keep at least 14 days via `BACKUP_RETENTION_DAYS=14`.

## Final cutover

1. Freeze write traffic or accept a short maintenance window.
2. Take one last fresh `mysqldump` from `192.168.0.10`.
3. Re-run `sha256sum -c`.
4. Restore that final dump into Railway MySQL with `mysql --host`.
5. Re-run the count query on source and Railway and compare.
6. Set public frontend API variables to `https://api.maeil1dok.app`, keep
   `NUXT_INTERNAL_API_BASE` on the Railway private backend URL, and redeploy
   the frontend.
7. Update DNS for `maeil1dok.app` and `api.maeil1dok.app` to Railway.
8. Update Kakao, Google, and Apple OAuth callback allowlists if those providers
   require explicit domain or callback verification.
9. Verify the production domains with the smoke checks above.

Do not delete the source Docker volumes or VPS backups until Railway has served
production traffic and login/reading flows have been verified.

## Old Stack Shutdown

After final Railway counts match and production domains pass smoke checks, stop
only the old Maeil1Dok application containers on `192.168.0.10`:

```sh
docker stop maeil1dok_backend maeil1dok_celery_worker maeil1dok_celery_beat
```

Do not stop maeil1dok_db until final Railway counts match, scheduled Railway
backups have produced a checksum-verified dump, and at least one post-cutover
login/reading smoke pass is recorded. Do not remove Docker volumes during the
cutover window.

## User Handoff Items

- DNS records for `maeil1dok.app` and `api.maeil1dok.app` if the DNS provider
  requires account-owner authentication.
- OAuth callback/domain verification in Kakao, Google, and Apple developer
  consoles when those consoles require direct account-owner access.
