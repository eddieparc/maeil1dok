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
