import { expect, test } from './fixtures/api';

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`plan settles subscription 429 and retry at ${viewport.width}px`, async ({ page, api }) => {
    // Given an authenticated reader with a deferred subscription response.
    await page.setViewportSize(viewport);
    await api.authenticate();
    let release: () => void = () => { throw new Error('Response gate was not installed'); };
    const gate = new Promise<void>(resolve => { release = resolve; });
    let attempts = 0;
    await page.route('**/api/v1/todos/plan/', async route => {
      attempts++;
      if (attempts === 1) await gate;
      await route.fulfill({
        status: attempts === 1 ? 429 : 200,
        contentType: 'application/json',
        body: JSON.stringify(attempts === 1 ? { detail: 'rate limited' } : []),
      });
    });
    const requested = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/todos/plan/');
    await page.goto('/plan');
    await requested;
    const body = page.locator('.schedule-body');
    await expect(body.locator('[role="status"]')).toBeVisible();
    // When the current request reaches a terminal failure.
    release();
    // Then loading becomes retryable failure, never fabricated empty.
    await expect(body.locator('[role="alert"]')).toBeVisible();
    await expect(body.locator('[role="status"]')).toHaveCount(0);
    await expect(body.locator('.no-schedules')).toHaveCount(0);
    await body.locator('[data-retry="schedules"]').click();
    await expect(body.locator('.no-plan-selected')).toBeVisible();
    await expect(body.locator('[role="alert"]')).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}
