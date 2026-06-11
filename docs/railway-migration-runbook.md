# Railway Migration Runbook

This runbook moves Maeil1Dok from `192.168.0.10:/home/jgp/maeil1dok` to
Railway while keeping the source Docker volumes intact until Railway has been
validated and DNS is ready to switch.

## Railway Services

Create one Railway project named `maeil1dok-production` with these services:

- `maeil1dok-mysql`: `railway add --database mysql`
- `maeil1dok-redis`: `railway add --database redis`
- `maeil1dok-backend`: GitHub repo service using config path `/railway/backend.web.toml`
- `maeil1dok-celery-worker`: GitHub repo service using config path `/railway/backend.worker.toml`
- `maeil1dok-celery-beat`: GitHub repo service using config path `/railway/backend.beat.toml`
- `maeil1dok-frontend`: GitHub repo service using root directory `/frontend`
  and config path `/railway/frontend.toml`

Railway monorepo services need root directories set per service, while config
file paths are absolute from the repo root.

## Backend Variables

Set these variables on `maeil1dok-backend`:

```text
DEBUG=False
SECRET_KEY=<existing SECRET_KEY>
DB_NAME=${{maeil1dok-mysql.MYSQLDATABASE}}
DB_USER=${{maeil1dok-mysql.MYSQLUSER}}
DB_PASSWORD=${{maeil1dok-mysql.MYSQLPASSWORD}}
DB_HOST=${{maeil1dok-mysql.MYSQLHOST}}
DB_PORT=${{maeil1dok-mysql.MYSQLPORT}}
REDIS_URL=${{maeil1dok-redis.REDIS_URL}}
CELERY_BROKER_URL=${{maeil1dok-redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{maeil1dok-redis.REDIS_URL}}
ALLOWED_HOSTS=maeil1dok.app,www.maeil1dok.app,${{RAILWAY_PUBLIC_DOMAIN}}
CORS_ALLOWED_ORIGINS=["https://maeil1dok.app","https://www.maeil1dok.app","https://${{maeil1dok-frontend.RAILWAY_PUBLIC_DOMAIN}}"]
CSRF_TRUSTED_ORIGINS=["https://maeil1dok.app","https://www.maeil1dok.app","https://${{RAILWAY_PUBLIC_DOMAIN}}","https://${{maeil1dok-frontend.RAILWAY_PUBLIC_DOMAIN}}"]
COOKIE_DOMAIN=.maeil1dok.app
FRONTEND_URL=https://maeil1dok.app
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

## Frontend Variables

Set these variables on `maeil1dok-frontend`:

```text
NODE_ENV=production
HOST=0.0.0.0
NUXT_PUBLIC_API_BASE=https://<backend Railway domain until DNS cutover>
NUXT_INTERNAL_API_BASE=https://<backend Railway domain until DNS cutover>
NUXT_PUBLIC_BIBLE_CACHE_URL=https://<backend Railway domain until DNS cutover>
KAKAO_CLIENT_ID=<frontend KAKAO_CLIENT_ID>
KAKAO_JS_KEY=<frontend KAKAO_JS_KEY>
KAKAO_REDIRECT_URI=https://maeil1dok.app/auth/kakao/callback
GOOGLE_CLIENT_ID=<frontend GOOGLE_CLIENT_ID>
GOOGLE_REDIRECT_URI=https://maeil1dok.app/auth/google/callback
APPLE_CLIENT_ID=<existing APPLE_CLIENT_ID>
APPLE_REDIRECT_URI=https://maeil1dok.app/auth/apple/callback
CRON_SECRET=<existing CRON_SECRET>
HASENA_CRON_SECRET=<existing HASENA_CRON_SECRET>
GEMINI_API_KEY=<existing GEMINI_API_KEY>
YOUTUBE_API_KEY=<existing GEMINI_API_KEY unless a dedicated key is added>
```

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

## Final cutover

1. Freeze write traffic or accept a short maintenance window.
2. Take one last fresh `mysqldump` from `192.168.0.10`.
3. Re-run `sha256sum -c`.
4. Restore that final dump into Railway MySQL with `mysql --host`.
5. Re-run the count query on source and Railway and compare.
6. Set frontend/backend variables to the production domains.
7. Update DNS for `maeil1dok.app`, `www.maeil1dok.app`, and
   `api.maeil1dok.app` to Railway.
8. Update Kakao, Google, and Apple OAuth callback allowlists if those providers
   require explicit domain or callback verification.
9. Verify the production domains with the smoke checks above.

Do not delete the source Docker volumes or VPS backups until Railway has served
production traffic and login/reading flows have been verified.

## User Handoff Items

- DNS records for `maeil1dok.app`, `www.maeil1dok.app`, and `api.maeil1dok.app`
  if the DNS provider requires account-owner authentication.
- OAuth callback/domain verification in Kakao, Google, and Apple developer
  consoles when those consoles require direct account-owner access.
