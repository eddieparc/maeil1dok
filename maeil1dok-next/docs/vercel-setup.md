# Vercel Staging Deployment Guide

## Prerequisites
- GitHub repository with `maeil1dok-next/` directory
- Supabase account (supabase.com)
- Vercel account (vercel.com)
- OAuth credentials for Kakao, Google, Apple

---

## Step 1: Create Supabase Hosted Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your users (e.g., Northeast Asia for Korean users)
3. Note your **Project URL** and **anon key** from Settings → API

### Apply Migrations
```bash
cd maeil1dok-next
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or apply SQL manually in Supabase Dashboard → SQL Editor:
1. Run `supabase/migrations/20260225000001_v1_production_schema.sql`
2. Run `supabase/migrations/20260225000002_triggers_and_seed.sql`

---

## Step 2: Configure OAuth Providers in Supabase

Go to Supabase Dashboard → Authentication → Providers:

### Kakao
- Enable Kakao provider
- Enter Client ID and Client Secret from [Kakao Developers](https://developers.kakao.com)
- Add redirect URL: `https://<your-vercel-domain>/auth/callback`

### Google
- Enable Google provider
- Enter Client ID and Client Secret from [Google Cloud Console](https://console.cloud.google.com)
- Add redirect URL: `https://<your-vercel-domain>/auth/callback`

### Apple
- Enable Apple provider
- Enter Client ID, Team ID, Key ID, and Private Key from [Apple Developer](https://developer.apple.com)
- Add redirect URL: `https://<your-vercel-domain>/auth/callback`
- **Important**: Apple uses POST for callbacks — the app handles this at `/auth/callback`

---

## Step 3: Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Set **Root Directory** to `maeil1dok-next`
4. Framework Preset: **Next.js** (auto-detected via `vercel.json`)

---

## Step 4: Configure Environment Variables in Vercel

In Vercel Dashboard → Settings → Environment Variables, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | All |

---

## Step 5: Set OAuth Redirect URLs

After your first Vercel deployment, you'll have a staging URL like:
`https://maeil1dok-next-<hash>.vercel.app`

Update OAuth redirect URLs in:
- **Supabase Dashboard** → Authentication → URL Configuration → Redirect URLs
  - Add: `https://maeil1dok-next-<hash>.vercel.app/auth/callback`
- **Kakao Developers** → App → Platform → Web → Site Domain
- **Google Cloud Console** → OAuth 2.0 → Authorized redirect URIs
- **Apple Developer** → Certificates → Service IDs → Return URLs

---

## Step 6: Add GitHub Secrets for CI

In GitHub → Repository → Settings → Secrets and Variables → Actions:

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

---

## Step 7: Deploy

Vercel auto-deploys on every push to `main`. For manual deploy:
```bash
npx vercel --prod
```

---

## Verification

After deployment, verify:
```bash
# Check staging URL responds
curl -s https://maeil1dok-next-<hash>.vercel.app/ | head -5

# Check login page
curl -s https://maeil1dok-next-<hash>.vercel.app/login | grep "카카오"
```

Expected: HTML with Korean content, no 500 errors.
