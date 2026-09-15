import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/api';

/**
 * WP08: the mobile shell reserves the tab bar (and its safe-area inset) exactly
 * once, the legacy colour names alias the v2 semantic tokens in both themes,
 * and the five destinations / desktop sidebar breakpoint are unchanged.
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const TAB_ROUTES = ['/', '/bible', '/plan', '/groups', '/login'];

const tabBar = (page: Page): Locator => page.locator('.bottom-nav-tabs');

/** Scroll every scroll owner to its end so the last block sits where the layout leaves it. */
const scrollToEnd = async (target: Locator): Promise<void> => {
  await target.evaluate((element) => {
    let node: HTMLElement | null = element.parentElement;
    while (node) {
      node.scrollTop = node.scrollHeight;
      node = node.parentElement;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
};

const expectAboveTabBar = async (page: Page, target: Locator): Promise<void> => {
  await scrollToEnd(target);
  const [content, tabs] = await Promise.all([target.boundingBox(), tabBar(page).boundingBox()]);
  expect(content).not.toBeNull();
  expect(tabs).not.toBeNull();
  expect(content!.y + content!.height).toBeLessThanOrEqual(tabs!.y);
};

const cssVar = (page: Page, name: string): Promise<string> =>
  page.evaluate((property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(), name);

test('mobile home reserves the tab bar once and keeps the last shortcut visible', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  await expect(nav).toBeVisible();
  await expect(page.locator('.bottom-nav-container')).toHaveCount(1);
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(5);
  expect(await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')))).toEqual(TAB_ROUTES);

  // Content reservation = tab bar height (which already contains the inset) + the 12px gap. No second inset.
  const { paddingBottom, tabsHeight } = await page.evaluate(() => {
    const container = document.querySelector('.sanctuary-theme .container') as HTMLElement;
    const tabs = document.querySelector('.bottom-nav-tabs') as HTMLElement;
    return {
      paddingBottom: parseFloat(getComputedStyle(container).paddingBottom),
      tabsHeight: tabs.getBoundingClientRect().height,
    };
  });
  expect(paddingBottom).toBeCloseTo(tabsHeight + 12, 0);

  await expectAboveTabBar(page, page.locator('.home-shortcuts a').last());
});

test('desktop home hides the tab bar and shows the sidebar', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');

  await expect(page.locator('.sidebar-nav')).toBeVisible();
  await expect(tabBar(page)).toBeHidden();
});

test('legacy colour names alias the v2 tokens in both themes', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect((await cssVar(page, '--primary-color')).toUpperCase()).toBe('#2A1111');
  expect((await cssVar(page, '--text-primary')).toUpperCase()).toBe('#1F1A17');

  // Flip through the real header control, the same path a reader takes.
  await page.getByRole('button', { name: '다크 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await cssVar(page, '--primary-color')).toUpperCase()).toBe('#F3EEEE');
  expect((await cssVar(page, '--primary-light')).toUpperCase()).toBe('#3A2A2A');
  expect((await cssVar(page, '--text-primary')).toUpperCase()).toBe('#F3F4F6');
  await expect(tabBar(page)).toHaveCSS('background-color', 'rgb(42, 42, 42)');
});

test('tab focus ring keeps its geometry and reduced motion drops the tab transitions', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const firstTab = page.locator('.bottom-nav .nav-item').first();
  await page.keyboard.press('Tab');
  await firstTab.focus();
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveCSS('outline-style', 'solid');
  await expect(firstTab).toHaveCSS('outline-width', '3px');
  await expect(firstTab).toHaveCSS('transition-duration', '0s');
});

test('mobile search keeps its focus ring and its last block inside the viewport', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/bible/search');

  const input = page.getByPlaceholder('본문 단어를 입력하세요');
  await input.focus();
  await expect(input).toBeFocused();
  await expect(page.locator('.search-field')).toHaveCSS('border-color', 'rgb(42, 17, 17)');

  // The Bible subpage shell has no tab bar; the last block must simply end inside the viewport.
  const lastBlock = page.locator('.results-section > :last-child');
  await scrollToEnd(lastBlock);
  const box = await lastBlock.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(MOBILE.height);
});
