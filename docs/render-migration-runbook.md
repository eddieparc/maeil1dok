# Render Migration Runbook

This runbook moves the current Docker Compose production stack on
`192.168.0.10:/home/jgp/maeil1dok` to the Render Blueprint in `render.yaml`.

## Current Preserved Backup

- Backup directory on source host:
  `/home/jgp/maeil1dok-backups/render-migration-20260611-104114`
- SQL dump:
  `/home/jgp/maeil1dok-backups/render-migration-20260611-104114/mysql.sql.gz`
- SHA256:
  `568af4de904548f624448bd24e701d4cae3a718d56bdb107eb8d6a4f1a2e101b`
- Local non-secret evidence:
  `.omo/ulw-loop/evidence/render-migration-20260611-104114/`

Do not delete the source Docker volumes until Render has served production
traffic successfully and row-count verification matches.

## Render Stack

The Blueprint creates these Standard-plan services in Singapore:

- `maeil1dok-mysql`: private MySQL 8 service with `/var/lib/mysql` disk
- `maeil1dok-redis`: internal Render Key Value instance
- `maeil1dok-backend`: public Django API service for `api.maeil1dok.app`
- `maeil1dok-celery-worker`: background worker
- `maeil1dok-celery-beat`: scheduler
- `maeil1dok-frontend`: Nuxt service for `maeil1dok.app` and `www.maeil1dok.app`

Only `maeil1dok-backend` runs `migrate` and `collectstatic` during startup.
Celery services set `RUN_MIGRATIONS=false` and `RUN_COLLECTSTATIC=false` to
avoid concurrent migration attempts during deploys.

## Pre-Apply Gate

Run these locally before pushing the deployment branch. Recreate the temporary
schema validator first:

```bash
rm -rf /tmp/render-blueprint-validator
mkdir -p /tmp/render-blueprint-validator
cd /tmp/render-blueprint-validator
npm init -y
npm install ajv@8 ajv-formats@3
cat > validate-render-blueprint.js <<'JS'
const fs = require('fs');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const schema = JSON.parse(fs.readFileSync('/tmp/render-schema.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('/tmp/render-blueprint.json', 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(data)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
console.log('render_schema_valid');
JS
```

Then validate the repo artifacts:

```bash
python3 -m unittest tests.test_render_blueprint backend.tests.test_entrypoint -v
ruby -ryaml -rjson -e 'puts JSON.generate(YAML.load_file("render.yaml"))' > /tmp/render-blueprint.json
curl -fsSL https://render.com/schema/render.yaml.json -o /tmp/render-schema.json
cd /tmp/render-blueprint-validator
node validate-render-blueprint.js
```

## Apply Gate

These steps create external resources and can affect billing:

1. Push a deployment branch containing `render.yaml`, `backend/entrypoint.sh`,
   and the tests.
2. In Render, create a new Blueprint from that branch.
   Confirm the generated services use the `standard` instance plan, not
   Hobby/free or Starter-sized service instances.
3. Fill `sync: false` values from the source host `.env` backup. Keep the
   same `SECRET_KEY` until after cookie/session cutover is complete.
4. Set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` once. `DB_PASSWORD` is wired
   from `MYSQL_PASSWORD` in the Blueprint.
5. Apply the Blueprint.

## Restore Data

After `maeil1dok-mysql` is healthy, restore the dump before enabling public
traffic:

```bash
ssh 192.168.0.10 'sha256sum -c /home/jgp/maeil1dok-backups/render-migration-20260611-104114/mysql.sql.gz.sha256'
```

Then use a Render Shell or one-off job attached to the private network to run:

```bash
gunzip -c mysql.sql.gz | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
```

After restore, compare table counts against:

```bash
.omo/ulw-loop/evidence/render-migration-20260611-104114/table-counts.tsv
```

The required minimum checks are:

- `accounts_user = 236`
- `accounts_userprofile = 236`
- `todos_plansubscription = 525`
- `todos_dailybibleschedule = 1106`
- `todos_userbibleprogress = 12367`
- `bible_cache_biblecontentcache = 8518`

## Live QA

Before DNS cutover:

```bash
curl -i https://maeil1dok-backend.onrender.com/admin/login/
curl -i https://maeil1dok-backend.onrender.com/api/v1/todos/plans/
curl -i https://maeil1dok-frontend.onrender.com/
```

After custom domains are verified:

```bash
curl -i https://api.maeil1dok.app/admin/login/
curl -i https://maeil1dok.app/
```

Use Chrome to open `https://maeil1dok.app/bible` and confirm the page renders
without mixed-content or CORS errors.

## Rollback

Keep the existing VPS stack running until all Render checks pass. If Render
fails before DNS cutover, leave DNS unchanged and destroy the failed Render
resources after exporting logs. If DNS has already moved, point records back to
the previous targets and restart the VPS containers:

```bash
ssh 192.168.0.10 'cd /home/jgp/maeil1dok && docker compose up -d'
```
