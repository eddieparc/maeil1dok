
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'https://beta.maeil1dok.app';
const OUT = process.argv[3] || '/tmp/bench-full.json';

const PAGES = ['/bible', '/plans', '/login', '/'];
const APIS = [
  '/api/v1/bible-cache/versions/',
  '/api/v1/bible-cache/kjv/gen/1/',
  '/api/v1/todos/schedules/today/?plan_id=1',
  '/api/v1/auth/csrf/',
  '/health/',
];

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const results = { base: BASE, pages: {}, apis: {}, resources: {} };

  // login first for authed API
  await p.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.fill('#email', 'beta-tester@maeil1dok.app');
  await p.fill('#password', 'BetaQa!2026');
  await p.click('.login-form button[type="submit"]');
  await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {});

  // page loads (TTFB + full load)
  for (const path of PAGES) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const resp = await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const ttfb = resp ? (await resp.request().timing()).responseStart : -1;
      await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      runs.push({ ttfb: Math.round(ttfb), total: Date.now() - t0, status: resp?.status() });
    }
    results.pages[path] = runs;
  }

  // API latency (authed cookies)
  for (const api of APIS) {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const r = await p.evaluate(async (u) => {
        const res = await fetch(u, { credentials: 'include' });
        await res.text();
        return res.status;
      }, api);
      runs.push({ ms: Date.now() - t0, status: r });
    }
    results.apis[api] = runs;
  }

  // resource timing on /bible
  await p.goto(BASE + '/bible', { waitUntil: 'networkidle', timeout: 60000 });
  const res = await p.evaluate(() => {
    return performance.getEntriesByType('resource')
      .map(r => ({ name: r.name.replace(location.origin, ''), type: r.initiatorType, dur: Math.round(r.duration), size: r.transferSize }))
      .sort((a, b) => b.dur - a.dur).slice(0, 15);
  });
  results.resources['bible-top15'] = res;

  // chapter transition timing
  await p.goto(BASE + '/bible?book=gen&chapter=1', { waitUntil: 'networkidle', timeout: 60000 });
  const chRuns = [];
  for (let i = 0; i < 3; i++) {
    const btn = p.locator('button[aria-label="다음 장"]').first();
    if (!(await btn.count())) break;
    const t0 = Date.now();
    await btn.click();
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    chRuns.push(Date.now() - t0);
  }
  results.chapterTransition = chRuns;

  console.log(JSON.stringify(results, null, 1));
  require('fs').writeFileSync(OUT, JSON.stringify(results, null, 2));
  await b.close();
})().catch(e => { console.error('FAIL:', e.message.slice(0, 400)); process.exit(1); });
