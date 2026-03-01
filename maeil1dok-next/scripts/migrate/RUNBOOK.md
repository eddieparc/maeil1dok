# 매일일독 Migration Cutover Runbook
# Django+MySQL (VPS) → Next.js+Supabase (Vercel)

**Service**: maeil1dok.app  
**Migration Date**: To be determined  
**DNS Provider**: Cloudflare  
**Current Host**: Personal Ubuntu VPS (Docker)  
**Target Host**: Vercel  

---

## Pre-Cutover Checklist

Complete ALL items before touching DNS:

- [ ] All migration scripts have run successfully
- [ ] `04-validate.ts` passed with exit code 0 and `data/validation_report.json` shows all checks passed
- [ ] OAuth redirect URIs updated (Kakao, Google, Apple) — see OAuth section below
- [ ] Supabase Dashboard: Site URL set to `https://maeil1dok.app`
- [ ] Supabase Dashboard: Additional redirect URLs include `http://localhost:3000`
- [ ] Vercel custom domain `maeil1dok.app` configured (in Vercel project settings)
- [ ] Maintenance mode ready to enable (`MAINTENANCE_MODE=true` in Vercel environment variables)
- [ ] Test user credentials available for post-cutover smoke test

---

## Step 1: Enable Maintenance Mode

1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add/update: `MAINTENANCE_MODE=true` (for Production environment)
3. Trigger a redeployment OR the next request will pick it up
4. Verify: Navigate to `https://maeil1dok.app` — should show maintenance page

---

## Step 2: OAuth Provider Redirect URI Updates

### 2.1 Kakao Developer Console
**URL**: https://developers.kakao.com

**Current redirect URI** (Django callback):
```
https://maeil1dok.app/auth/kakao/callback/
```

**New redirect URI** (Supabase callback):
```
https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

**Steps**:
1. Log in to Kakao Developers Console
2. Navigate to your app → Product Settings → Kakao Login
3. Under "Redirect URI", remove old Django callback URL
4. Add new Supabase callback URL
5. Save

> ⚠️ Find your Supabase project ref in Supabase Dashboard → Project Settings → General → Reference ID

### 2.2 Google Cloud Console
**URL**: https://console.cloud.google.com

**Current redirect URI** (Django callback):
```
https://maeil1dok.app/auth/google/callback/
```

**New redirect URI** (Supabase callback):
```
https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

**Steps**:
1. Log in to Google Cloud Console
2. Navigate to APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID (Web application type)
4. Under "Authorized redirect URIs", add the Supabase callback URL
5. Remove the old Django callback URL
6. Save

### 2.3 Apple Developer Console
**URL**: https://developer.apple.com

**Current return URL** (Django callback):
```
https://maeil1dok.app/auth/apple/callback/
```

**New return URL** (Supabase callback):
```
https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

**Steps**:
1. Log in to Apple Developer Console
2. Navigate to Certificates, Identifiers & Profiles → Identifiers
3. Find your Services ID (used for Sign in with Apple)
4. Under "Sign in with Apple" → Configure
5. Add `https://<PROJECT_REF>.supabase.co/auth/v1/callback` to Return URLs
6. Remove old Django callback URL
7. Save (Note: Changes may take a few minutes to propagate)

### 2.4 Supabase Dashboard Configuration
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL** to: `https://maeil1dok.app`
3. Add to **Additional Redirect URLs**:
   - `http://localhost:3000`
   - `https://maeil1dok.app`
4. Save

---

## Step 3: Cloudflare DNS Cutover

> ⚠️ This is the point of no return for DNS. Have rollback plan ready.

**Current DNS** (VPS):
```
A    maeil1dok.app    →    <VPS_IP_ADDRESS>
```

**Target DNS** (Vercel):
```
CNAME    maeil1dok.app    →    cname.vercel-dns.com
```

Or if CNAME flattening is not available for apex domain:
```
A    maeil1dok.app    →    76.76.21.21
```
(Check Vercel project settings for the exact IP/CNAME they provide)

### Steps:
1. Log in to Cloudflare dashboard → maeil1dok.app domain
2. Navigate to DNS → Records
3. Find the existing A record pointing to your VPS IP
4. **Delete** or **modify** the A record:
   - Delete: Remove the old A record
   - Add: New CNAME record → `cname.vercel-dns.com`
   - Proxy status: **DNS only** (grey cloud — NOT orange proxy) ← Vercel requires this
5. In Vercel project settings → Domains, confirm `maeil1dok.app` is configured and Vercel is issuing SSL certificate

> **SSL Note**: Cloudflare must be set to "DNS only" (no proxy) for Vercel SSL to work correctly. Vercel handles its own CDN and SSL.

**DNS Propagation**: Changes may take 5-30 minutes globally. Use `dig maeil1dok.app` to verify.

---

## Step 4: Verify DNS + HTTPS

Run these commands after DNS change:

```bash
# Check DNS resolution
dig maeil1dok.app +short
# Expected: IP address in 76.76.21.x range (Vercel) or CNAME to cname.vercel-dns.com

# Check HTTP/HTTPS
curl -I https://maeil1dok.app
# Expected: HTTP/2 200 (or 302 to /maintenance) with x-vercel-id header

# Check certificate
curl -vI https://maeil1dok.app 2>&1 | grep -E "(SSL|TLS|certificate|expire)"
# Expected: Valid SSL certificate for maeil1dok.app
```

---

## Step 5: Disable Maintenance Mode

After DNS verification:
1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Set `MAINTENANCE_MODE=false` (or delete the variable)
3. Trigger redeployment if needed
4. Verify: Navigate to `https://maeil1dok.app` — should show normal app (not maintenance page)

---

## Post-Cutover Checklist

Verify ALL items after going live:

- [ ] `dig maeil1dok.app` resolves to Vercel IP (not old VPS IP)
- [ ] `curl -I https://maeil1dok.app` returns 200 with `x-vercel-id` header
- [ ] SSL certificate is valid (no browser warnings)
- [ ] Maintenance mode is disabled (site loads normally)
- [ ] Login page shows Kakao and Google buttons
- [ ] Kakao OAuth flow initiates without redirect_uri error
- [ ] Google OAuth flow initiates without redirect_uri error
- [ ] After login, user can see their reading progress
- [ ] Reading page (/reading) loads daily schedule
- [ ] Calendar page loads with historical data
- [ ] User profile shows correct nickname and stats

---

## Rollback Plan

If critical issues are found post-cutover:

1. **Immediate**: Re-enable maintenance mode (`MAINTENANCE_MODE=true`)
2. **DNS Rollback**: In Cloudflare, restore original A record pointing to VPS IP
3. **DNS Propagation**: Wait 5-30 minutes for rollback to propagate
4. **VPS Restart**: If Django was stopped, restart: `docker-compose up -d`
5. Note: Since we chose a forward-only migration strategy, rollback of user data is NOT planned — fix issues in Next.js instead

---

## VPS Decommission Checklist

> ⚠️ Do NOT decommission until at least 1 week of stable operation on Vercel

### Immediate (after successful cutover verification):
- [ ] Stop Django Docker containers: `docker-compose down` on VPS
- [ ] Take final MySQL backup: `docker exec <mysql-container> mysqldump --all-databases > final_backup_$(date +%Y%m%d).sql`
- [ ] Download backup to local machine and upload to cloud storage (Google Drive, S3, etc.)
- [ ] Verify backup file is readable: `mysql -u root -p < final_backup_YYYYMMDD.sql` (on a test server)

### After 1 week of stable operation:
- [ ] Remove any remaining Cloudflare DNS records pointing to VPS
- [ ] Cancel/decommission VPS server (Ubuntu instance)
- [ ] Revoke Django `SECRET_KEY` — generate a new one (even though Django is no longer used)
- [ ] Revoke old MySQL database credentials
- [ ] Archive Docker Compose config: commit `docker-compose.yml` and `backend/` to a `legacy/` directory in git

### After 1 month:
- [ ] Drop `migration_user_mapping` table from Supabase (temporary migration table):
  ```sql
  DROP TABLE public.migration_user_mapping;
  ```
  Create a new migration file for this: `supabase/migrations/YYYYMMDD_drop_migration_user_mapping.sql`
- [ ] Delete `scripts/migrate/data/` directory (extracted JSON data — sensitive, not committed)
- [ ] Consider archiving migration scripts: keep in git history but optionally remove from tree

---

## Environment Variables Reference

All credentials are in environment files. **Never put credentials in this document.**

- Backend MySQL: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- Supabase Admin: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- OAuth credentials: See `.env.local.example` in `maeil1dok-next/`

---

## Support

If issues arise during cutover:
- Check Vercel function logs for 500 errors
- Check Supabase logs for auth/database errors
- Rollback DNS if data issues found (see Rollback section above)
