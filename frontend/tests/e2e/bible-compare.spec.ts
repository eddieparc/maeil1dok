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
    await expect(page.locator('.compare-column.secondary .verse')).toHaveCount(24);
    await expect(page.locator('.bible-compare-viewer')).toHaveClass(/theme-dark/);
    const geometry = await page.locator('.compare-columns').evaluate(el => {
      const columns = [...el.querySelectorAll('.compare-column')].map(c => c.getBoundingClientRect().toJSON());
      return { columns, overflow: document.documentElement.scrollWidth > innerWidth,
        innerOverflow: [...el.querySelectorAll('.column-content, .bible-viewer')].some(c => c.scrollWidth > c.clientWidth) };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.innerOverflow).toBe(false);
    for (const column of geometry.columns) { expect(column.width).toBeGreaterThan(250); expect(column.height).toBeGreaterThan(100); }
    if (width < 768) expect(geometry.columns[1].top).toBeGreaterThan(geometry.columns[0].top);
    else expect(geometry.columns[1].left).toBeGreaterThan(geometry.columns[0].left);
    // 양쪽 역본은 비율로 함께 스크롤된다.
    const synced = await page.locator('.compare-columns').evaluate(async el => {
      const primary = el.querySelector('.compare-column.primary .bible-viewer, .compare-column.primary .column-content');
      const secondary = el.querySelector('.compare-column.secondary .column-content');
      if (!primary || !secondary) return { forward: false, back: false };
      const ratio = c => (c.scrollHeight - c.clientHeight) > 0 ? c.scrollTop / (c.scrollHeight - c.clientHeight) : 0;
      primary.scrollTop = (primary.scrollHeight - primary.clientHeight) * 0.5;
      primary.dispatchEvent(new Event('scroll'));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const forward = Math.abs(ratio(secondary) - 0.5) < 0.15;
      secondary.scrollTop = secondary.scrollHeight - secondary.clientHeight;
      secondary.dispatchEvent(new Event('scroll'));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { forward, back: ratio(primary) > 0.8 };
    });
    expect(synced.forward, 'primary scroll drives secondary').toBe(true);
    expect(synced.back, 'secondary scroll drives primary').toBe(true);
    await page.locator('.primary .verse').nth(2).click();
    await expect(page.getByTestId('selection-action-menu')).toBeVisible();
    await page.locator('.primary .verse').nth(2).click();
    await page.locator('.secondary .version-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.swap-btn').click();
    await expect(page).toHaveURL(/version=GAE/);
    await page.reload();
    await expect(page.locator('.bible-compare-viewer')).toBeVisible();
    await expect(page.locator('.secondary .verse')).toHaveCount(24);
    await page.screenshot({ path: `/tmp/lab127-compare-${width}.png`, fullPage: true });
    await page.locator('.book-selector-trigger').click();
    await page.getByTestId('book-selector-compare').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.bible-compare-viewer')).toHaveCount(0);
    await expect(page.locator('.bible-viewer .verse')).toHaveCount(24);
  });
}
