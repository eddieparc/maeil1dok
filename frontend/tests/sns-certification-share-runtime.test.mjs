import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import * as esbuild from 'esbuild';

let shareModule;
let clickedDownloads;
let copiedLinks;
let objectUrls;
let revokeObjectUrls;
let sharedPayloads;
let canvasBlobFactory;
let scheduleCanvasBlob;
let nativeMessages;

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

const installBrowserStubs = () => {
  clickedDownloads = 0;
  copiedLinks = [];
  objectUrls = [];
  revokeObjectUrls = [];
  sharedPayloads = [];
  canvasBlobFactory = () => new Blob(['certification-png'], { type: 'image/png' });
  scheduleCanvasBlob = (callback) => callback(canvasBlobFactory());
  nativeMessages = [];

  globalThis.window = {
    location: {
      origin: 'https://maeil1dok.app',
    },
  };
  globalThis.document = {
    documentElement: {},
    body: {
      append() {},
    },
    createElement(tagName) {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext() {
            return {
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 0,
              lineCap: '',
              lineJoin: '',
              font: '',
              textAlign: '',
              fillRect() {},
              beginPath() {},
              roundRect() {},
              fill() {},
              stroke() {},
              arc() {},
              moveTo() {},
              lineTo() {},
              quadraticCurveTo() {},
              fillText() {},
            };
          },
          toBlob(callback) {
            scheduleCanvasBlob(callback);
          },
          toDataURL() {
            return 'data:image/png;base64,Y2VydGlmaWNhdGlvbi1wbmc=';
          },
        };
      }

      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click() {
            clickedDownloads += 1;
          },
          remove() {},
        };
      }

      throw new Error(`Unexpected element: ${tagName}`);
    },
  };
  globalThis.getComputedStyle = () => ({
    getPropertyValue: () => '',
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText(value) {
          copiedLinks.push(value);
        },
      },
      canShare() {
        return false;
      },
    },
  });
  globalThis.File = class File extends Blob {
    constructor(parts, name, options) {
      super(parts, options);
      this.name = name;
    }
  };
  URL.createObjectURL = (blob) => {
    const url = `blob:certification-${objectUrls.length}`;
    objectUrls.push({ url, type: blob.type, size: blob.size });
    return url;
  };
  URL.revokeObjectURL = (url) => {
    revokeObjectUrls.push(url);
  };
};

before(async () => {
  const source = await readFile(new URL('../app/composables/useCertificationShare.ts', import.meta.url), 'utf8');
  const result = await esbuild.transform(source, {
    loader: 'ts',
    format: 'esm',
    target: 'es2022',
  });
  const encoded = Buffer.from(result.code).toString('base64');
  shareModule = await import(`data:text/javascript;base64,${encoded}`);
});

beforeEach(() => {
  installBrowserStubs();
});

after(async () => {
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
});

test('shareCertification downloads a generated PNG when Web Share files are unavailable', async () => {
  const { shareCertification } = shareModule.useCertificationShare();

  const result = await shareCertification({
    planId: 7,
    scheduleId: 13,
    dateLabel: '2026-01-02',
    readingRange: '출애굽기 1장',
    progressLine: '2/3일 완료 · 66.67%',
  });

  assert.equal(result, 'downloaded');
  assert.equal(clickedDownloads, 1);
  assert.equal(copiedLinks.length, 0);
  assert.equal(objectUrls[0].type, 'image/png');
  assert.deepEqual(revokeObjectUrls, ['blob:certification-0']);

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: navigator.clipboard,
      canShare: ({ files }) => files?.length === 1,
      async share(payload) {
        sharedPayloads.push(payload);
        throw new DOMException('share cancelled', 'AbortError');
      },
    },
  });

  const cancelledResult = await shareCertification({
    planId: 7,
    scheduleId: 13,
    dateLabel: '2026-01-02',
  });
  const [sharedPayload] = sharedPayloads;

  assert.equal(cancelledResult, 'shared');
  assert.equal(sharedPayloads.length, 1);
  assert.equal(sharedPayload.title, '매일일독 통독 인증 카드');
  assert.equal(sharedPayload.text, '오늘도 말씀을 읽었습니다');
  assert.match(sharedPayload.url, /certification=tongdok/);
  assert.match(sharedPayload.url, /plan_id=7/);
  assert.match(sharedPayload.url, /schedule_id=13/);
  assert.equal(sharedPayload.files.length, 1);
  assert.equal(sharedPayload.files[0].name, 'maeil1dok-tongdok-certification.png');
  assert.equal(sharedPayload.files[0].type, 'image/png');
  assert.equal(clickedDownloads, 1);
});

test('shareCertification falls back to a certification history link when PNG generation fails', async () => {
  const { shareCertification } = shareModule.useCertificationShare();
  canvasBlobFactory = () => null;

  const result = await shareCertification({
    planId: 7,
    scheduleId: 13,
    dateLabel: '2026-01-02',
  });

  assert.equal(result, 'copied');
  assert.equal(clickedDownloads, 0);
  assert.equal(copiedLinks.length, 1);
  assert.match(copiedLinks[0], /^https:\/\/maeil1dok\.app\/bible\/history\?/);
  assert.match(copiedLinks[0], /certification=tongdok/);
  assert.match(copiedLinks[0], /plan_id=7/);
  assert.match(copiedLinks[0], /schedule_id=13/);
  assert.match(copiedLinks[0], /date=2026-01-02/);
});

test('shareCertification preserves iOS WebView activation and shares only the PNG file', async () => {
  // Given: iOS WebKit expires the click activation before an asynchronous
  // canvas.toBlob callback completes.
  window.isReactNativeWebView = true;
  window.isAndroidApp = false;
  let hasTransientActivation = true;
  scheduleCanvasBlob = (callback) => {
    queueMicrotask(() => {
      hasTransientActivation = false;
      callback(canvasBlobFactory());
    });
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: navigator.clipboard,
      canShare: ({ files }) => files?.length === 1,
      async share(payload) {
        if (!hasTransientActivation) {
          throw new DOMException('share requires user activation', 'NotAllowedError');
        }
        sharedPayloads.push(payload);
      },
    },
  });

  // When: the certification share action starts directly from the tap.
  const { shareCertification } = shareModule.useCertificationShare();
  const result = await shareCertification({ planId: 7, scheduleId: 13 });

  // Then: the native share sheet receives the PNG before activation expires,
  // without a mixed text/URL payload or a silent blob-download fallback.
  assert.equal(result, 'shared');
  assert.equal(sharedPayloads.length, 1);
  assert.deepEqual(Object.keys(sharedPayloads[0]), ['files']);
  assert.equal(sharedPayloads[0].files[0].type, 'image/png');
  assert.equal(clickedDownloads, 0);
});

test('downloadCertificationImage opens the iOS WebView share sheet instead of a blob download', async () => {
  // Given: the image-save action runs inside the iOS app WebView.
  window.isReactNativeWebView = true;
  window.isAndroidApp = false;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: navigator.clipboard,
      canShare: ({ files }) => files?.length === 1,
      async share(payload) {
        sharedPayloads.push(payload);
      },
    },
  });

  // When: the user taps the dedicated image-save action.
  const { downloadCertificationImage } = shareModule.useCertificationShare();
  await downloadCertificationImage(undefined, { planId: 7, scheduleId: 13 });

  // Then: iOS receives a real PNG through its share sheet, where Save Image is
  // available, rather than a blob anchor that WKWebView cannot persist.
  assert.equal(sharedPayloads.length, 1);
  assert.deepEqual(Object.keys(sharedPayloads[0]), ['files']);
  assert.equal(sharedPayloads[0].files[0].type, 'image/png');
  assert.equal(clickedDownloads, 0);
});

test('shareCertification copies the history link when iOS cannot share PNG files', async () => {
  // Given: the iOS app WebView exposes Web Share but rejects PNG file payloads.
  window.isReactNativeWebView = true;
  window.isAndroidApp = false;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: navigator.clipboard,
      canShare: () => false,
      async share(payload) {
        sharedPayloads.push(payload);
      },
    },
  });

  // When: the user attempts to share a completed certification card.
  const { shareCertification } = shareModule.useCertificationShare();
  const result = await shareCertification({ planId: 7, scheduleId: 13 });

  // Then: the action has an observable link fallback instead of reporting a
  // blob download that iOS WebView did not persist.
  assert.equal(result, 'copied');
  assert.equal(sharedPayloads.length, 0);
  assert.equal(clickedDownloads, 0);
  assert.equal(copiedLinks.length, 1);
  assert.match(copiedLinks[0], /certification=tongdok/);
  assert.match(copiedLinks[0], /plan_id=7/);
  assert.match(copiedLinks[0], /schedule_id=13/);
});

test('Android app routes certification sharing and saving through the native image bridge', async () => {
  // Given: the page runs inside the Android app WebView.
  window.isReactNativeWebView = true;
  window.isAndroidApp = true;
  window.ReactNativeWebView = {
    postMessage(value) {
      nativeMessages.push(JSON.parse(value));
    },
  };

  // When: the user shares and then saves the generated certification image.
  const { downloadCertificationImage, shareCertification } = shareModule.useCertificationShare();
  const shareResult = await shareCertification({ planId: 7, scheduleId: 13 });
  await downloadCertificationImage(undefined, { planId: 7, scheduleId: 13 });

  // Then: both actions carry the PNG through the native bridge instead of a
  // WebView blob download that does not create a user-visible file.
  assert.equal(shareResult, 'shared');
  assert.equal(clickedDownloads, 0);
  assert.deepEqual(
    nativeMessages.map(({ type, action, fileName }) => ({ type, action, fileName })),
    [
      {
        type: 'certification:image',
        action: 'share',
        fileName: 'maeil1dok-tongdok-certification.png',
      },
      {
        type: 'certification:image',
        action: 'save',
        fileName: 'maeil1dok-tongdok-certification.png',
      },
    ],
  );
  for (const message of nativeMessages) {
    assert.match(message.dataUrl, /^data:image\/png;base64,/);
  }
});
