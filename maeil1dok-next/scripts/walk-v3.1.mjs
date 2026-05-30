#!/usr/bin/env node
/**
 * Phase 4 Walk Script — Refined v3.1 Design Verification
 *
 * Walks 35 routes × 4 modes (light/dark × desktop/mobile) and records:
 *  - HTTP status code
 *  - Final URL (detects redirects)
 *  - <h1> text (smoke test for content render)
 *  - Console errors
 *  - Page errors (uncaught exceptions, hydration)
 *  - Network failures (4xx/5xx)
 *  - Full-page screenshot
 *
 * Usage:
 *  node walk-v3.1.mjs                          → walk all (uses storage state if exists)
 *  node walk-v3.1.mjs --public-only            → walk public routes only
 *  node walk-v3.1.mjs --storage-state=auth.json → use specific auth state
 *  node walk-v3.1.mjs --routes=login,home      → walk specific route ids
 *  node walk-v3.1.mjs --modes=desktop-light    → walk specific modes
 */

import { chromium } from 'playwright'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const OUT_DIR = resolve(PROJECT_ROOT, '.sisyphus/evidence/next-fe-audit/walks/v3.1')
const SHOTS_DIR = resolve(PROJECT_ROOT, '.sisyphus/evidence/next-fe-audit/screenshots/v3.1')
const BASE_URL = process.env.WALK_BASE_URL ?? 'http://localhost:3000'
const STORAGE_STATE_DEFAULT = resolve(OUT_DIR, '.auth-state.json')

// ── CLI args ─────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a.startsWith('--')) {
      const [k, ...v] = a.slice(2).split('=')
      return [k, v.join('=') || true]
    }
    return [a, true]
  }),
)

// ── 35 routes ────────────────────────────────────────────────────────
const ROUTES = [
  // Public (12)
  { id: 'login', url: '/login', auth: false },
  { id: 'register-email', url: '/register-email', auth: false },
  { id: 'auth-forgot-password', url: '/auth/forgot-password', auth: false },
  { id: 'auth-reset-password', url: '/auth/reset-password', auth: false },
  { id: 'auth-verify-email', url: '/auth/verify-email', auth: false },
  { id: 'terms', url: '/terms', auth: false },
  { id: 'privacy', url: '/privacy', auth: false },
  { id: 'company', url: '/company', auth: false },
  { id: 'support', url: '/support', auth: false },
  { id: 'notice', url: '/notice', auth: false },
  { id: 'maintenance', url: '/maintenance', auth: false },
  { id: 'not-found', url: '/not-found', auth: false },

  // Authenticated — Home (P0)
  { id: 'home', url: '/', auth: true },

  // Authenticated — Bible reader + sub (P0 + P1)
  { id: 'bible', url: '/bible', auth: true },
  { id: 'bible-home', url: '/bible/home', auth: true },
  { id: 'bible-bookmarks', url: '/bible/bookmarks', auth: true },
  { id: 'bible-highlights', url: '/bible/highlights', auth: true },
  { id: 'bible-history', url: '/bible/history', auth: true },
  { id: 'bible-notes', url: '/bible/notes', auth: true },
  { id: 'bible-notes-id', url: '/bible/notes/00000000-0000-0000-0000-000000000000', auth: true },
  { id: 'bible-settings', url: '/bible/settings', auth: true },

  // Authenticated — Plan (P1)
  { id: 'plan', url: '/plan', auth: true },
  { id: 'catchup', url: '/catchup', auth: true },
  { id: 'plans', url: '/plans', auth: true },

  // Authenticated — Social (P2)
  { id: 'friends', url: '/friends', auth: true },
  { id: 'groups', url: '/groups', auth: true },
  { id: 'groups-id', url: '/groups/00000000-0000-0000-0000-000000000000', auth: true },
  { id: 'profile-id', url: '/profile/00000000-0000-0000-0000-000000000000', auth: true },

  // Authenticated — Aux (P2)
  { id: 'scoreboard', url: '/scoreboard', auth: true },
  { id: 'settings', url: '/settings', auth: true },
  { id: 'hasena', url: '/hasena', auth: true },
  { id: 'intro', url: '/intro', auth: true },
  { id: 'calendar', url: '/calendar', auth: true },
  { id: 'reading', url: '/reading', auth: true },
]

// ── 4 modes ──────────────────────────────────────────────────────────
const MODES = [
  { tag: 'desktop-light', viewport: { width: 1280, height: 800 }, colorScheme: 'light' },
  { tag: 'mobile-light', viewport: { width: 390, height: 844 }, colorScheme: 'light' },
  { tag: 'desktop-dark', viewport: { width: 1280, height: 800 }, colorScheme: 'dark' },
  { tag: 'mobile-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
]

// ── filters ──────────────────────────────────────────────────────────
let routes = ROUTES
if (args['public-only']) routes = routes.filter((r) => !r.auth)
if (args.routes) {
  const wanted = String(args.routes).split(',')
  routes = routes.filter((r) => wanted.includes(r.id))
}
let modes = MODES
if (args.modes) {
  const wanted = String(args.modes).split(',')
  modes = modes.filter((m) => wanted.includes(m.tag))
}

const storageStatePath = args['storage-state']
  ? resolve(String(args['storage-state']))
  : STORAGE_STATE_DEFAULT

// ── helpers ──────────────────────────────────────────────────────────
async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function truncate(s, n = 200) {
  if (typeof s !== 'string') return ''
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// ── walk one route ───────────────────────────────────────────────────
async function walkRoute(context, mode, route) {
  const page = await context.newPage()

  const consoleErrors = []
  const consoleWarnings = []
  const pageErrors = []
  const failedRequests = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(truncate(msg.text(), 300))
    else if (msg.type() === 'warning') consoleWarnings.push(truncate(msg.text(), 150))
  })
  page.on('pageerror', (err) => {
    pageErrors.push(truncate(err.message, 300))
  })
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      failedRequests.push(`${resp.status()} ${resp.url()}`)
    }
  })

  let status = 0
  let finalUrl = ''
  let h1 = ''
  let title = ''
  let bodyLen = 0

  try {
    const resp = await page.goto(`${BASE_URL}${route.url}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    status = resp ? resp.status() : 0
    finalUrl = page.url()

    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(400)

    title = await page.title().catch(() => '')
    h1 = await page
      .locator('h1')
      .first()
      .innerText({ timeout: 1500 })
      .catch(() => '')
    bodyLen = await page.evaluate(() => document.body?.innerText?.length ?? 0).catch(() => 0)

    const shotPath = resolve(SHOTS_DIR, `${route.id}-${mode.tag}.png`)
    await mkdir(dirname(shotPath), { recursive: true })
    await page.screenshot({ path: shotPath, fullPage: true })
  } catch (err) {
    pageErrors.push(`[walk error] ${truncate(String(err?.message ?? err))}`)
  }

  await page.close()

  return {
    id: route.id,
    url: route.url,
    auth: route.auth,
    mode: mode.tag,
    status,
    finalUrl,
    redirectedToLogin: finalUrl.includes('/login') && route.url !== '/login',
    title,
    h1,
    bodyLen,
    consoleErrors,
    consoleErrorsN: consoleErrors.length,
    consoleWarnings: consoleWarnings.slice(0, 5),
    consoleWarningsN: consoleWarnings.length,
    pageErrors,
    pageErrorsN: pageErrors.length,
    failedRequests,
    failedRequestsN: failedRequests.length,
  }
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`Walk-v3.1 START`)
  console.log(`  BASE_URL: ${BASE_URL}`)
  console.log(`  routes: ${routes.length}`)
  console.log(`  modes: ${modes.length}`)
  console.log(`  total shots: ${routes.length * modes.length}`)

  const hasState = await exists(storageStatePath)
  console.log(`  storage state: ${hasState ? storageStatePath : 'NONE (authed routes will redirect)'}`)

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(SHOTS_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  const startTime = Date.now()
  const results = []

  for (const mode of modes) {
    console.log(`\n── Mode: ${mode.tag} ──`)
    const contextOptions = {
      viewport: mode.viewport,
      colorScheme: mode.colorScheme,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    }
    if (hasState) contextOptions.storageState = storageStatePath

    const context = await browser.newContext(contextOptions)

    // Inject theme into localStorage so app-level ThemeToggle respects it
    await context.addInitScript((scheme) => {
      try {
        window.localStorage.setItem('theme', scheme)
        window.localStorage.setItem('resolvedTheme', scheme)
      } catch {}
    }, mode.colorScheme)

    for (const route of routes) {
      const t0 = Date.now()
      const result = await walkRoute(context, mode, route)
      const dt = Date.now() - t0
      results.push(result)
      const flag =
        result.failedRequestsN > 0 || result.consoleErrorsN > 0 || result.pageErrorsN > 0
          ? '⚠'
          : result.redirectedToLogin && route.auth
            ? '↪'
            : '✓'
      console.log(
        `  ${flag} ${route.id.padEnd(24)} ${result.status} ${dt}ms ` +
          `err:${result.consoleErrorsN}/${result.pageErrorsN} netfail:${result.failedRequestsN}` +
          (result.redirectedToLogin && route.auth ? ' [→/login]' : ''),
      )
    }

    await context.close()
  }

  await browser.close()
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // ── Summary ─────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const summary = {
    startedAt: new Date(startTime).toISOString(),
    elapsedSec: Number(elapsed),
    baseUrl: BASE_URL,
    totalShots: results.length,
    routesCount: routes.length,
    modesCount: modes.length,
    storageStateUsed: hasState ? storageStatePath : null,
    counts: {
      ok: results.filter((r) => r.status >= 200 && r.status < 400 && r.failedRequestsN === 0 && r.consoleErrorsN === 0).length,
      redirectedAuthed: results.filter((r) => r.redirectedToLogin && r.auth).length,
      withConsoleErrors: results.filter((r) => r.consoleErrorsN > 0).length,
      withPageErrors: results.filter((r) => r.pageErrorsN > 0).length,
      withNetworkFails: results.filter((r) => r.failedRequestsN > 0).length,
      with5xx: results.filter((r) => r.status >= 500).length,
    },
    results,
  }

  const outFile = resolve(OUT_DIR, `walk-${ts}.json`)
  await writeFile(outFile, JSON.stringify(summary, null, 2))
  const latestFile = resolve(OUT_DIR, 'walk-latest.json')
  await writeFile(latestFile, JSON.stringify(summary, null, 2))

  console.log(`\n── DONE in ${elapsed}s ──`)
  console.log(`  ok: ${summary.counts.ok}/${summary.totalShots}`)
  console.log(`  authed redirected to /login: ${summary.counts.redirectedAuthed}`)
  console.log(`  console errors on: ${summary.counts.withConsoleErrors}`)
  console.log(`  page errors on: ${summary.counts.withPageErrors}`)
  console.log(`  network fails on: ${summary.counts.withNetworkFails}`)
  console.log(`  5xx on: ${summary.counts.with5xx}`)
  console.log(`\n  report: ${outFile}`)
  console.log(`  shots: ${SHOTS_DIR}`)
}

main().catch((err) => {
  console.error('Walk FAILED:', err)
  process.exit(1)
})
