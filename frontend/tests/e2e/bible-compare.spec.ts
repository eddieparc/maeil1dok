import { expect, test } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';

for (const width of [390, 1280]) {
  test(`compare reader remains readable and interactive at ${width}px`, async ({ api, page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem('readingSettings', JSON.stringify({ theme: 'dark' })));
    mockBibleChapter(api, { book: 'jhn', chapter: 3 });
    await page.goto('/bible?book=jhn&chapter=3&version=HAN');
    await expect(page.locator('.bible-viewer .verse')).toHaveCount(24);
    // Compare now lives inside the book selector sheet, not the header.
    await page.locator('.book-selector-trigger').click();
    await page.getByTestId('book-selector-compare').click();
    await page.keyboard.press('Escape');
    // 절 단위 병합 DOM: 각 행이 좌우 셀을 가지고 하나의 스크롤로 움직인다.
    await expect(page.locator('.verse-pair')).toHaveCount(24);
    await expect(page.locator('.pair-secondary .verse')).toHaveCount(24);
    await expect(page.locator('.bible-compare-viewer')).toHaveClass(/theme-dark/);
    const geometry = await page.locator('.verse-pair').first().evaluate(row => {
      const primary = row.querySelector('.pair-primary')?.getBoundingClientRect().toJSON();
      const secondary = row.querySelector('.pair-secondary')?.getBoundingClientRect().toJSON();
      return { primary, secondary, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry.primary).toBeTruthy();
    expect(geometry.secondary).toBeTruthy();
    expect(geometry.overflow).toBe(false);
    if (width < 768) expect(geometry.secondary!.top).toBeGreaterThan(geometry.primary!.top);
    else expect(geometry.secondary!.left).toBeGreaterThan(geometry.primary!.left);
    // 단일 스크롤 컨테이너 — 별도 스크롤러가 없다.
    const scrollers = await page.evaluate(() =>
      [...document.querySelectorAll('.bible-compare-viewer *')].filter(el => el.scrollHeight > el.clientHeight + 4).length);
    expect(scrollers).toBe(1);
    await page.locator('.pair-primary .verse').nth(2).click();
    await expect(page.getByTestId('selection-action-menu')).toBeVisible();
    await page.locator('.pair-primary .verse').nth(2).click();
    // 헤더 버튼에서 바로 역본을 바꾼다 (시트를 열지 않는다).
    await page.locator('.compare-header .version-btn').nth(1).click();
    await expect(page.locator('.version-menu')).toBeVisible();
    await page.locator('.version-menu-item', { hasText: '개역개정' }).click();
    await expect(page.locator('.compare-header .version-btn').nth(1)).toContainText('개역개정');
    await page.locator('.swap-btn').click();
    await expect(page).toHaveURL(/version=GAE/);
    await page.reload();
    await expect(page.locator('.bible-compare-viewer')).toBeVisible();
    await expect(page.locator('.pair-secondary .verse')).toHaveCount(24);
    await page.screenshot({ path: `/tmp/lab127-compare-${width}.png`, fullPage: true });
    await page.locator('.book-selector-trigger').click();
    await page.getByTestId('book-selector-compare').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.bible-compare-viewer')).toHaveCount(0);
    await expect(page.locator('.bible-viewer .verse')).toHaveCount(24);
  });
}
