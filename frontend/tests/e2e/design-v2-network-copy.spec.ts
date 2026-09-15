import { expect, test } from './fixtures/api';

for (const surface of [
  { pagePath: '/groups', apiPath: '/api/v1/todos/groups/', errorSelector: '[role="alert"] p' },
  { pagePath: '/hasena', apiPath: '/api/v1/todos/hasena/day/', errorSelector: '.state-container.error p' },
]) {
  test(`renders localized transport failure and retains identity when ${surface.pagePath} is offline`, async ({ page, api }) => {
    // Given: identity restores normally; only the content transport is offline.
    await api.authenticate();
    let requests = 0;
    await page.route(`**${surface.apiPath}*`, async (route) => {
      requests++;
      await route.abort('internetdisconnected');
    });
    const failedRequest = page.waitForEvent('requestfailed', {
      predicate: (request) => new URL(request.url()).pathname === surface.apiPath,
      timeout: 20_000,
    });

    // When: use the real route, store and shared API consumer.
    await page.goto(surface.pagePath);
    await failedRequest;

    // Then: language classification rather than a pinned Korean sentence.
    const error = page.locator(surface.errorSelector);
    await expect(error).toBeVisible();
    await expect(error).toContainText(/[가-힣]/);
    await expect(page).toHaveURL(new RegExp(`${surface.pagePath}$`));
    const identity = await page.evaluate(() => {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored).user.id : null;
    });
    expect(identity).toBe(7);
    expect(requests).toBe(1);
  });
}
