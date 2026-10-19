// 벤치: /bible TTFB, 장 전환, 페이지 전환 — 대상 base URL별 3회 측정
// 사용: NODE_PATH=frontend/node_modules node scripts/bench-reader.cjs <baseUrl> <outJson> [email password]
const { chromium } = require('playwright-core');
const fs = require('fs');

const BASE = process.argv[2];
const OUT = process.argv[3];
const EMAIL = process.argv[4];
const PASSWORD = process.argv[5];
const RUNS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measureTTFB(context) {
  const page = await context.newPage();
  const t0 = Date.now();
  const resp = await page.goto(`${BASE}/bible`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const ttfb = resp ? (await resp.request().timing()).responseStart : null;
  const total = Date.now() - t0;
  await page.close();
  return { ttfb, total };
}

async function measureChapterTransition(page) {
  // 다음 장 버튼 클릭 → 본문 헤딩(책·장) 텍스트가 바뀔 때까지
  const heading = page.locator('.header-range').first();
  const before = await heading.textContent().catch(() => '');
  const btn = page.locator('button[aria-label="다음 장"]').first();
  const t0 = Date.now();
  await btn.click();
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('.header-range');
      return el && el.textContent !== prev;
    },
    before,
    { timeout: 30000 }
  );
  return Date.now() - t0;
}

async function measurePageTransition(page, targetPath) {
  const t0 = Date.now();
  await page.evaluate((p) => {
    const a = document.createElement('a');
    a.href = p;
    document.body.appendChild(a);
    a.click();
  }, targetPath);
  await page.waitForURL(`**${targetPath}**`, { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
  return Date.now() - t0;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // 로그인 (자격 증명이 주어진 경우)
  if (EMAIL && PASSWORD) {
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(500);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('.login-form button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {});
    await page.close();
  }

  const results = { base: BASE, runs: [] };
  for (let i = 0; i < RUNS; i++) {
    const run = { run: i + 1 };
    run.ttfb = await measureTTFB(context);

    const page = await context.newPage();
    await page.goto(`${BASE}/bible`, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(500);
    run.chapterTransition = await measureChapterTransition(page).catch((e) => ({ error: String(e).slice(0, 200) }));
    run.pageTransition = await measurePageTransition(page, '/plans').catch((e) => ({ error: String(e).slice(0, 200) }));
    await page.close();
    results.runs.push(run);
    console.log(`run ${i + 1}:`, JSON.stringify(run));
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
