import { expect, test } from './fixtures/api';

/**
 * The old store binary can never receive an OTA — it sends no update channel, so
 * every update check is answered HTTP 400. Those users only get the session fixes
 * from a new store build, and this web app is the only surface that can tell them.
 *
 * Driven through a real browser because the decision is pure but the WIRING is
 * not: the pure policy can be perfect while the banner is missing from `app.vue`,
 * and that failure is invisible to a unit test.
 */

const OLD_SHELL = () => {
  // Exactly what the shipped shell injects: the WebView flag and the platform,
  // and nothing about which bundle it is running.
  (window as unknown as Record<string, unknown>).isReactNativeWebView = true;
  (window as unknown as Record<string, unknown>).isAndroidApp = true;
};

const NEW_SHELL = () => {
  (window as unknown as Record<string, unknown>).isReactNativeWebView = true;
  (window as unknown as Record<string, unknown>).isAndroidApp = true;
  (window as unknown as Record<string, unknown>).__shellBundleIdentity = {
    updateId: '01a04d10-c30e-7eb8-b1a5-7e753f68567f',
    runtimeVersion: '1.2.2',
    isEmbedded: false,
    channel: 'production',
  };
};

test('the old app shell is told to update, with a working store link', async ({ page }) => {
  await page.addInitScript(OLD_SHELL);
  await page.goto('/');

  await expect(page.getByTestId('legacy-shell-notice')).toBeVisible();
  await expect(page.getByTestId('legacy-shell-store-link')).toHaveAttribute(
    'href',
    /play\.google\.com\/store\/apps\/details\?id=app\.maeil1dok\.mobile/,
  );
});

test('a shell that reports its bundle is left alone', async ({ page }) => {
  // The most damaging failure would be nagging — or later locking out — users who
  // already carry the fix.
  await page.addInitScript(NEW_SHELL);
  await page.goto('/');

  await expect(page.getByTestId('legacy-shell-notice')).toHaveCount(0);
  await expect(page.getByTestId('legacy-shell-block')).toHaveCount(0);
});

test('an ordinary browser is never asked to update an app it does not have', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('legacy-shell-notice')).toHaveCount(0);
});
