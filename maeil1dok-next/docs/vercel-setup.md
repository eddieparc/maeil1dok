# Vercel Staging Deployment Guide

## Prerequisites

- GitHub repository: `maeil1dok` (monorepo)
- Supabase project (hosted) created at [supabase.com](https://supabase.com)
- Vercel account at [vercel.com](https://vercel.com)
- OAuth credentials for Kakao, Google, Apple

---

## Step 1: Create Supabase Hosted Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Choose organization, name the project (e.g., `maeil1dok-staging`)
3. Set a strong database password
4. Select region closest to users (e.g., `Northeast Asia (Tokyo)`)
5. Click **Create new project**

### Apply Migrations

Option A — Using Supabase CLI:
```bash
cd maeil1dok-next
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Option B — Apply SQL manually in Supabase Dashboard → SQL Editor:
1. Run `supabase/migrations/20260225000001_v1_production_schema.sql`
2. Run `supabase/migrations/20260225000002_triggers_and_seed.sql`

---

## Step 2: Configure OAuth Providers in Supabase

Go to Supabase Dashboard → **Authentication** → **Providers**:

### Kakao
- Enable Kakao provider
- Enter Client ID and Client Secret from [Kakao Developers](https://developers.kakao.com)
- Supabase callback URL: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`

### Google
- Enable Google provider
- Enter Client ID and Client Secret from [Google Cloud Console](https://console.cloud.google.com)
- Supabase callback URL: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`

### Apple
- Enable Apple provider
- Enter Client ID, Team ID, Key ID, and Private Key from [Apple Developer](https://developer.apple.com)
- Supabase callback URL: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
- **Important**: Apple uses POST for callbacks — the app handles this at `/auth/callback`

---

## Step 3: Create Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Select the `maeil1dok` repository
3. **Important**: Set **Root Directory** to `maeil1dok-next/`
4. Framework Preset: **Next.js** (auto-detected via `vercel.json`)
5. Click **Deploy** (initial deploy may fail without env vars — that's OK)

---

## Step 4: Configure Environment Variables in Vercel

In Vercel Dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (from Supabase Settings → API) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (from Supabase Settings → API) | All |

> **Note**: `SUPABASE_SERVICE_ROLE_KEY` is server-only and should never be exposed to the client.

---

## Step 5: Set OAuth Redirect URLs

After your first Vercel deployment, you'll have a staging URL like:
`https://maeil1dok-next-<hash>.vercel.app`

1. **Supabase Dashboard** → Authentication → URL Configuration → **Redirect URLs**:
   - Add: `https://maeil1dok-next.vercel.app/**`
   - Add: `https://<your-custom-domain>/**` (if applicable)

2. Update redirect URLs in each provider's developer console:
   - **Kakao Developers** → App → Platform → Web → Site Domain
   - **Google Cloud Console** → OAuth 2.0 → Authorized redirect URIs
   - **Apple Developer** → Certificates → Service IDs → Return URLs

---

## Step 6: Add GitHub Secrets for CI

In GitHub → Repository → **Settings** → **Secrets and Variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

---

## Step 7: Redeploy

1. Go to Vercel Project → **Deployments**
2. Click the latest deployment → **Redeploy**
3. Verify the deployment at your Vercel URL

Vercel auto-deploys on every push to `main`. For manual deploy:
```bash
npx vercel --prod
```

---

## CI/CD Pipeline

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs on:
- Push to `main` branch (when `maeil1dok-next/**` files change)
- Pull requests targeting `main` (when `maeil1dok-next/**` files change)

CI steps:
1. `npm ci` — Install dependencies
2. `npx tsc --noEmit` — Type checking
3. `npx eslint src/ --max-warnings 0` — Linting
4. `npx vitest run` — Unit tests

---

## Troubleshooting

### Build fails on Vercel
- Check that **Root Directory** is set to `maeil1dok-next/`
- Verify all environment variables are set
- Check build logs for TypeScript or dependency errors

### OAuth login doesn't redirect back
- Verify redirect URLs in Supabase Dashboard include the Vercel domain
- Ensure OAuth provider developer consoles have the correct redirect URLs
- Check that `NEXT_PUBLIC_SUPABASE_URL` is set correctly

### CI fails on GitHub Actions
- Ensure GitHub Secrets are configured for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check that `package-lock.json` is committed (required for `npm ci`)
