# Beta test mail: private capture, never recipient delivery

`config.beta_settings` selects `ACCOUNT_MAIL_TRANSPORT = 'beta-spool'`.
Primary settings do not select it: existing direct Resend behavior, payloads,
logging, boolean return values and public enumeration-guard responses stay intact.
Do not supply real Resend credentials to beta. No SMTP server or paid resource is
needed, and no recipient is contacted.

All existing verification/reset/welcome wrappers and staff member mail actions
converge on `accounts.email_utils.send_email`. In beta it serializes the real
rendered message (including the actual token URL) to an owner-only JSON record.
The record includes `transport: beta-spool` and
`delivery_status: captured_not_delivered`; it is TEST MAIL, not a delivery receipt.
No token or message content is logged. The transport returns true only after file
and directory fsync; any unsafe path, permission, write, or quota error returns
false with a fixed, content-free log message and no provider fallback.

## API and UI meaning

Beta-only middleware adds `X-Beta-Test-Mail: captured_not_delivered` or
`not_captured` and `Cache-Control: no-store` to mail activity responses. This header
is a transport label, not an authorization grant or a public capture reader.

For beta POST `/api/v1/{auth,accounts}/{send-verification,resend-verification,request-password-reset}/`,
a successful 2xx mail response requires an actual capture. It has the existing
`success`/`message` shape, with a test-mail message. A would-be generic success
without capture (including no eligible synthetic account) becomes 503,
`success: false`, `error: beta_test_mail_not_captured`. Capture failure and no
eligible account have the same response; existing validation/auth/throttle errors
retain their status/body. This intentionally differs from PRIMARY's generic
anti-enumeration acknowledgement: beta is a synthetic-account sandbox with
observable capture receipts, not a production registration directory. Never seed
real users. Primary middleware/settings and responses are unchanged.

Admin actions retain their per-action results and existing failure/audit semantics:
a failed write yields `mail_delivery_failed` and rolls back its token transaction.
A capture is a real file, not proof a later database transaction committed. If a
later unrelated transaction fails, an already-written capture may contain an
invalid token, just as a provider send could already have happened; check the API
result and actual token validity, not just the presence of a file. Mixed bulk
outcomes must be read per action, not inferred from the transport header.

The app-wide `BetaTestMailNotice` is rendered only when public runtime config
`testMailTransport` is exactly `beta-spool`. Beta Compose/Docker selects it;
primary defaults to an empty value and displays no notice. The notice explicitly
says real email is not sent and links are available only through the operator.
Existing pages/admin toast copy is not rewritten; the global notice and API
transport evidence qualify it. Parent must regenerate Nuxt types/build later;
no frozen build or browser runtime was changed by this task.

## Private storage and operational preparation

Compose mounts **only web-beta**:

- host: `/opt/maeil1dok-beta-isolated/.beta-test-mail`
- container: `/var/lib/maeil1dok-beta/test-mail`

The bind mount uses `create_host_path: false`. It must be explicitly prepared by
the operator before container creation. The current backend Dockerfile runs as
root; therefore the host directory must be root-owned and mode 0700. If the runtime
UID changes, ownership must match that UID instead. Do not loosen the mode or give
frontend/cloudflared access. Example **operator-owned, not run by this task**:

```sh
sudo install -d -m 0700 -o root -g root /opt/maeil1dok-beta-isolated/.beta-test-mail
```

Never place the spool under backend source, STATIC_ROOT, MEDIA_ROOT, a public
asset directory or a symlink. The adapter walks absolute path components with
O_NOFOLLOW/dirfds, rejects source/static/media locations, and requires exact 0700
ownership. Each committed UUID-named JSON is mode 0600. Readers reject traversal,
symlinks, nonregular files, wrong ownership, hard links and group/world-readable
files. No Django staff session or public HTTP endpoint can read captures: only a
trusted OS/Docker operator with access to the backend owner identity can do so.
Docker access is effectively root access and must remain restricted.

The spool is capped at 10 MiB of capture/pending-file bytes, with a directory flock
serializing quota checks and atomic publications. Full storage rejects new captures
rather than deleting messages or pretending delivery. This is a local Linux/macOS
filesystem contract, not a network-filesystem spool. There is no retention daemon
or beat job. The operator deletes expired/consumed synthetic captures when the
review is complete, with the beta service quiescent or using the directory lock;
never remove the mounted directory itself. Quota does not apply to exported review
copies, so remove those too. `.beta-test-mail/` is gitignored. Never upload it via
source rsync, CI artifacts, screenshots, issue attachments or backup exports.

## Secure operator retrieval of actual token links

These commands are instructions for the parent on the isolated sandbox AFTER
explicit deployment approval; they were not run against a live service here.
Use only the new project and its scoped env. Do not use the primary project.

1. Trigger a synthetic account reset/verification/admin resend through beta.
   Record the status and `X-Beta-Test-Mail` label without tokens or cookies.
2. List opaque IDs/timestamps/status only (no recipient, subject, HTML or token):

   ```sh
   cd /opt/maeil1dok-beta-isolated
   docker compose -f docker-compose.beta-isolated.yml --env-file .env.beta-isolated \
     exec -T web-beta python manage.py beta_test_mail --list
   ```

3. Prepare a private container-local review directory outside source/assets, then
   export one listed ID to a NEW file. `--output` is required: the command never
   prints token-bearing content to stdout and will not overwrite an existing file.

   ```sh
   docker compose -f docker-compose.beta-isolated.yml --env-file .env.beta-isolated \
     exec -T web-beta install -d -m 0700 /tmp/beta-mail-review
   docker compose -f docker-compose.beta-isolated.yml --env-file .env.beta-isolated \
     exec -T web-beta python manage.py beta_test_mail \
     --id RECORD_ID_FROM_LIST --output /tmp/beta-mail-review/message.json
   ```

4. Copy that file into a mode-0700 operator-local directory (not this repo), keep
   the copied file 0600, and inspect it only in a trusted local JSON/text viewer.
   `message.html` contains the actual `/auth/verify-email?token=...` or
   `/auth/reset-password?token=...` href. Confirm `https://beta.maeil1dok.app` and
   the expected synthetic recipient/purpose before using it. Do not render raw
   HTML as trusted application content or paste the token into logs/chat/reports.
   The message includes existing user-controlled template fields; export is data,
   not sanitized executable HTML.
5. Parent can follow the link in its separately approved beta QA surface and
   verify the actual token action. Record only redacted evidence. Remove both
   review copies and later the consumed/expired capture under operator control.

For an entirely local disposable Django sandbox, explicitly select the beta-spool
transport and a canonical absolute owner-only temp directory in disposable settings;
keep its SQLite DB/cache isolated and use `manage.py beta_test_mail` there. Do not
point `config.beta_settings` at production resources or inherit production env.
The automated tests do this with temporary directories and an in-memory test DB.

No web inbox, staff capture API, new model/migration, new network listener, real
recipient message, production data, cloud resource, or deployment is added.
