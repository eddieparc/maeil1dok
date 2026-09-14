import type { Page } from '@playwright/test';
import { expect, test, type ApiMock } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';
import {
  mockHasenaPage,
  mockTongdokCertification,
} from './fixtures/hasena';

const installYouTubeFixture = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __hasenaIframeLoaded?: boolean };
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (!descriptor?.get || !descriptor.set) throw new Error('Missing iframe src descriptor');

    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(this: HTMLIFrameElement, value: string) {
        if (state.__hasenaIframeLoaded && this.matches('.video-container iframe')) {
          const root = document.documentElement;
          const count = Number(root.dataset.hasenaIframeReassignments || '0');
          root.dataset.hasenaIframeReassignments = String(count + 1);
        }
        descriptor.set?.call(this, value);
      },
    });

    window.addEventListener('message', (event) => {
      if (event.data !== 'hasena-iframe-loaded') return;
      state.__hasenaIframeLoaded = true;
      document.documentElement.dataset.hasenaIframeLoaded = 'true';
      window.dispatchEvent(new CustomEvent('hasena-iframe-loaded'));
    });
  });

  await page.route('https://www.youtube.com/embed/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><script>parent.postMessage("hasena-iframe-loaded", "*")</script>',
  }));
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      window.YT = {
        Player: function Player(id) {
          document.documentElement.dataset.hasenaYoutubePlayerReady = id;
        }
      };
      const notifyReady = () => window.onYouTubeIframeAPIReady?.();
      if (window.__hasenaIframeLoaded) {
        notifyReady();
      } else {
        window.addEventListener('hasena-iframe-loaded', notifyReady, { once: true });
      }
    `,
  }));
};

const openCertificationAfterCompletion = async (page: Page, api: ApiMock): Promise<void> => {
  await api.authenticate();
  mockBibleChapter(api, { book: 'jhn', chapter: 3 });
  mockTongdokCertification(api);

  await page.goto('/bible?book=jhn&chapter=3&tongdok=true&schedule=13&plan=7');
  const completeButton = page.getByRole('button', { name: '통독 완료' });
  await expect(completeButton).toBeVisible();

  // v2 completes immediately on click — there is no confirm dialog. The
  // certification payload is fetched after the completion write succeeds.
  const certificationRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/api/v1/todos/certification/progress/');
  await completeButton.click();
  const request = await certificationRequest;
  const requestUrl = new URL(request.url());
  expect(requestUrl.searchParams.get('plan_id')).toBe('7');
  expect(requestUrl.searchParams.get('schedule_id')).toBe('13');
};

test('Hasena completion button dispatches the store update request', async ({ api, page }) => {
  await api.authenticate();
  mockHasenaPage(api);
  await installYouTubeFixture(page);
  await page.goto('/hasena');

  const completionButton = page.getByRole('button', { name: '완료하기' });
  await expect(completionButton).toBeVisible();

  const updateRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
      && new URL(request.url()).pathname === '/api/v1/todos/hasena/update/');
  await completionButton.click();
  const request = await updateRequest;
  const payload = request.postDataJSON() as { date?: unknown; is_completed?: unknown };

  expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(payload.is_completed).toBe(true);
});

test('Hasena player setup does not renavigate its mounted iframe', async ({ api, page }) => {
  mockHasenaPage(api);
  await installYouTubeFixture(page);

  const iframeNavigations: string[] = [];
  page.on('framenavigated', (frame) => {
    const url = new URL(frame.url());
    if (url.origin === 'https://www.youtube.com' && url.pathname.startsWith('/embed/')) {
      iframeNavigations.push(url.toString());
    }
  });

  await page.goto('/hasena');
  await expect(page.locator('html')).toHaveAttribute('data-hasena-iframe-loaded', 'true');
  await expect(page.locator('html')).toHaveAttribute(
    'data-hasena-youtube-player-ready',
    'hasena-youtube-player',
  );

  await expect(page.locator('html')).not.toHaveAttribute('data-hasena-iframe-reassignments', /.+/);
  expect(iframeNavigations).toHaveLength(1);
  const iframeUrl = new URL(iframeNavigations[0] ?? 'about:blank');
  expect(iframeUrl.pathname).toBe('/embed/A83cdGOhMdt');
  expect(iframeUrl.searchParams.get('enablejsapi')).toBe('1');
});

test('completion opens a token-styled certification modal with usable actions', async ({ api, page }) => {
  await openCertificationAfterCompletion(page, api);

  const dialog = page.getByRole('dialog').filter({ hasText: '오늘 통독을 완료했어요' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('요한복음 3장', { exact: true })).toBeVisible();
  await expect(dialog.getByText('연속 4일째')).toBeVisible();

  const cardColors = await dialog.getByTestId('reader-completion-content').evaluate((card) => {
    const resolveColorToken = (token: string): string => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      card.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const cardStyle = getComputedStyle(card);
    const icon = card.querySelector('.reader-completion__icon');
    const title = card.querySelector('.reader-completion__title');
    if (!(icon instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      throw new Error('Completion card color elements are missing');
    }

    return {
      rawTokens: [
        '--color-text-primary',
        '--color-bg-card',
        '--color-bg-secondary',
        '--color-border-default',
        '--color-accent-primary',
        '--color-accent-bg',
      ].map((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim()),
      color: cardStyle.color,
      textPrimary: resolveColorToken('--color-text-primary'),
      titleColor: getComputedStyle(title).color,
      iconColor: getComputedStyle(icon).color,
      iconBackground: getComputedStyle(icon).backgroundColor,
      accent: resolveColorToken('--color-accent-primary'),
      accentBackground: resolveColorToken('--color-accent-bg'),
    };
  });

  expect(cardColors.rawTokens.every(Boolean)).toBe(true);
  expect(cardColors.color).toBe(cardColors.textPrimary);
  expect(cardColors.titleColor).toBe(cardColors.textPrimary);
  expect(cardColors.iconColor).toBe(cardColors.accent);
  expect(cardColors.iconBackground).toBe(cardColors.accentBackground);

  // No next-position fixture is mocked, so only share and close render.
  const actionButtons = dialog.locator('.reader-completion__actions').getByRole('button');
  await expect(actionButtons).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(actionButtons.nth(index)).toBeEnabled();
  }
  const actionBoxes = await actionButtons.evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  for (const box of actionBoxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  // The share action opens the v2 share sheet in completion mode; opening it
  // closes the completion modal first.
  await dialog.getByTestId('reader-completion-share').click();
  const shareSheet = page.getByTestId('bible-share-sheet');
  await expect(shareSheet).toBeVisible();
  await expect(shareSheet.getByRole('heading', { name: '통독 완료 공유' })).toBeVisible();
  await shareSheet.getByRole('button', { name: '닫기' }).click();
  await expect(shareSheet).toBeHidden();

  // v2 never navigates to /plan: dismissing the flow returns to the reader.
  await expect(dialog).toBeHidden();
  await expect(page.locator('.bible-viewer')).toBeVisible();
});

test('verse sharing sends only the Bible selection payload', async ({ api, page }) => {
  mockBibleChapter(api, { book: 'jhn', chapter: 3 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        document.documentElement.dataset.bibleSharePayload = JSON.stringify({
          title: data.title,
          text: data.text,
          url: data.url,
          fileCount: data.files?.length ?? 0,
        });
      },
    });
    // The share sheet loads its card font from a CDN that is unreachable in
    // tests; a stub FontFace keeps image preparation deterministic.
    class FakeFontFace {
      family: string;
      constructor(family: string, _source: unknown, _descriptors?: unknown) {
        this.family = family;
      }
      async load(): Promise<FakeFontFace> {
        return this;
      }
    }
    Object.defineProperty(window, 'FontFace', { configurable: true, value: FakeFontFace });
    Object.defineProperty(document.fonts, 'add', {
      configurable: true,
      value: () => document.fonts,
    });
  });
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: 200,
    contentType: 'font/woff2',
    body: Buffer.from('playwright-font-bytes'),
  }));

  await page.goto('/bible?book=jhn&chapter=3');
  const verse = page.locator('.bible-content .verse').nth(15);
  await expect(verse).toBeVisible();
  await verse.click();

  const selectionToolbar = page.getByRole('toolbar', { name: '선택한 구절 작업' });
  await expect(selectionToolbar).toBeVisible();
  await selectionToolbar.getByRole('button', { name: '구절 공유' }).click();

  // v2 shares through the sheet: "공유하기" stays disabled until the card
  // image is prepared, then calls navigator.share with the image file.
  const shareSheet = page.getByTestId('bible-share-sheet');
  await expect(shareSheet).toBeVisible();
  const sendButton = shareSheet.getByTestId('share-send');
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.locator('html')).toHaveAttribute('data-bible-share-payload', /.+/);

  const payload = await page.locator('html').getAttribute('data-bible-share-payload');
  expect(payload).not.toBeNull();
  const shareData = JSON.parse(payload ?? '{}') as {
    title?: string;
    text?: string;
    url?: string;
    fileCount?: number;
  };
  expect(shareData.title).toBe('요한복음 3:16');
  expect(shareData.text).toContain('브라우저 말씀 16');
  expect(shareData.fileCount).toBe(1);

  const shareUrl = new URL(shareData.url ?? 'about:blank');
  expect(shareUrl.pathname).toBe('/bible');
  expect(shareUrl.searchParams.get('book')).toBe('jhn');
  expect(shareUrl.searchParams.get('chapter')).toBe('3');
  expect(shareUrl.searchParams.get('verse')).toBe('16');
  expect(shareUrl.searchParams.has('certification')).toBe(false);
});
