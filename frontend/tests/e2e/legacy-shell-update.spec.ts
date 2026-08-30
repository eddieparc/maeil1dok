import { expect, test } from './fixtures/api';

/**
 * The web app must not infer an installed binary's age from missing bundle
 * identity. That signal cannot distinguish a genuinely old shell from a freshly
 * installed build whose identity handoff is unavailable, so it produced false
 * update warnings. Exercise the real client-only mount in a browser.
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

test('the old app shell is not shown an update warning', async ({ page }) => {
  await page.addInitScript(OLD_SHELL);
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('region', { name: '알림' })).toBeAttached();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));

  await expect(page.getByTestId('legacy-shell-notice')).toHaveCount(0);
  await expect(page.getByTestId('legacy-shell-block')).toHaveCount(0);
  await expect(page.locator('#__nuxt')).toBeVisible();
});

test('a shell that reports its bundle is left alone', async ({ page }) => {
  await page.addInitScript(NEW_SHELL);
  await page.goto('/');

  await expect(page.getByTestId('legacy-shell-notice')).toHaveCount(0);
  await expect(page.getByTestId('legacy-shell-block')).toHaveCount(0);
});

test('an ordinary browser is never asked to update an app it does not have', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('legacy-shell-notice')).toHaveCount(0);
});
