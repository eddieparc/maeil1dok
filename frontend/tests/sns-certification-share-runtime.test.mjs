import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, before, beforeEach, test as nodeTest } from 'node:test';
import * as esbuild from 'esbuild';

const test = (name, run) => nodeTest(name, { timeout: 3000 }, run);
let shareModule;
let clickedDownloads;
let copiedLinks;
let objectUrls;
let revokeObjectUrls;
let sharedPayloads;
let nativeMessages;
let preparedImage;
const originals = new Map(['window', 'document', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

before(async () => {
  const source = await readFile(new URL('../app/composables/useCertificationShare.ts', import.meta.url), 'utf8');
  const result = await esbuild.transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
  shareModule = await import(`data:text/javascript;base64,${Buffer.from(result.code).toString('base64')}`);
});

beforeEach(() => {
  clickedDownloads = 0;
  copiedLinks = [];
  objectUrls = [];
  revokeObjectUrls = [];
  sharedPayloads = [];
  nativeMessages = [];
  // ShareSheet prepares before the tap. These are transport fixtures, NOT canvas
  // output or PNG-signature proof. The compiled UI/preparation boundary is covered
  // by sns-certification-contract and handoff-v2-reader-sharing.
  const bytes = 'prepared transport fixture; native PNG validation is lead-owned';
  preparedImage = {
    file: new File([bytes], 'maeil1dok-tongdok-certification.png', { type: 'image/png' }),
    dataUrl: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
    width: 720,
    height: 1280,
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://maeil1dok.app' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    body: { append() {} },
    createElement(tag) {
      assert.equal(tag, 'a', 'transport must not render another canvas during activation');
      return { href: '', download: '', click() { clickedDownloads++; }, remove() {} };
    },
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    clipboard: { async writeText(value) { copiedLinks.push(value); } },
    canShare: () => false,
  } });
  URL.createObjectURL = blob => {
    const url = `blob:certification-${objectUrls.length}`;
    objectUrls.push({ url, type: blob.type, size: blob.size, blob });
    return url;
  };
  URL.revokeObjectURL = url => revokeObjectUrls.push(url);
});

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
});

test('shareCertification downloads the prepared PNG when Web Share files are unavailable', async () => {
  const { shareCertification } = shareModule.useCertificationShare();
  const payload = {
    preparedImage,
    planId: 7,
    scheduleId: 13,
    dateLabel: '2026-01-02',
    readingRange: '출애굽기 1장',
    progressLine: '2/3일 완료 · 66.67%',
    title: '실제 일정 제목',
    subtitle: '실제 일정 부제',
  };
  const result = await shareCertification(payload);
  assert.equal(result, 'downloaded');
  assert.equal(clickedDownloads, 1);
  assert.equal(copiedLinks.length, 0);
  assert.equal(objectUrls[0].type, 'image/png');
  assert.equal(objectUrls[0].blob, preparedImage.file);
  assert.deepEqual(revokeObjectUrls, ['blob:certification-0']);

  navigator.canShare = ({ files }) => files?.length === 1;
  navigator.share = async data => {
    sharedPayloads.push(data);
    throw new DOMException('share cancelled', 'AbortError');
  };
  const cancelledResult = await shareCertification(payload);
  const [sharedPayload] = sharedPayloads;
  assert.equal(cancelledResult, 'shared');
  assert.equal(sharedPayloads.length, 1);
  assert.equal(sharedPayload.title, payload.title);
  assert.equal(sharedPayload.text, payload.subtitle);
  assert.match(sharedPayload.url, /certification=tongdok/);
  assert.match(sharedPayload.url, /plan_id=7/);
  assert.match(sharedPayload.url, /schedule_id=13/);
  assert.equal(sharedPayload.files.length, 1);
  assert.equal(sharedPayload.files[0], preparedImage.file);
  assert.equal(sharedPayload.files[0].name, 'maeil1dok-tongdok-certification.png');
  assert.equal(sharedPayload.files[0].type, 'image/png');
  assert.equal(clickedDownloads, 1);
});

test('shareCertification falls back to a certification history link when preparation produced no PNG', async () => {
  const { shareCertification } = shareModule.useCertificationShare();
  // Explicit unavailable-image boundary, not a pretend canvas-generation test.
  const result = await shareCertification({ planId: 7, scheduleId: 13, dateLabel: '2026-01-02' });
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
  window.isReactNativeWebView = true;
  window.isAndroidApp = false;
  let hasTransientActivation = true;
  navigator.canShare = ({ files }) => files?.length === 1;
  navigator.share = async payload => {
    if (!hasTransientActivation) throw new DOMException('share requires user activation', 'NotAllowedError');
    sharedPayloads.push(payload);
  };
  const { shareCertification } = shareModule.useCertificationShare();
  queueMicrotask(() => { hasTransientActivation = false; });
  const sharing = shareCertification({ preparedImage, planId: 7, scheduleId: 13 });
  assert.equal(sharedPayloads.length, 1, 'dispatch must happen in the original activation');
  const result = await sharing;
  assert.equal(result, 'shared');
  assert.deepEqual(Object.keys(sharedPayloads[0]), ['files']);
  assert.equal(sharedPayloads[0].files[0], preparedImage.file);
  assert.equal(sharedPayloads[0].files[0].type, 'image/png');
  assert.equal(clickedDownloads, 0);
  assert.equal(copiedLinks.length, 0);
});

test('downloadCertificationImage opens the iOS WebView share sheet instead of a blob download', async () => {
  window.isReactNativeWebView = true;
  window.isAndroidApp = false;
  navigator.canShare = ({ files }) => files?.length === 1;
  navigator.share = async payload => { sharedPayloads.push(payload); };
  const { downloadCertificationImage } = shareModule.useCertificationShare();
  const saving = downloadCertificationImage(undefined, { preparedImage, planId: 7, scheduleId: 13 });
  assert.equal(sharedPayloads.length, 1);
  await saving;
  assert.deepEqual(Object.keys(sharedPayloads[0]), ['files']);
  assert.equal(sharedPayloads[0].files[0], preparedImage.file);
  assert.equal(sharedPayloads[0].files[0].type, 'image/png');
  assert.equal(clickedDownloads, 0);
  navigator.share = async () => { throw new DOMException('save cancelled', 'AbortError'); };
  await downloadCertificationImage(undefined, { preparedImage, planId: 7, scheduleId: 13 });
  assert.equal(clickedDownloads, 0, 'cancelling Save Image must not fall through to download');
});

test('shareCertification copies the history link when iOS cannot share PNG files', async () => {
  window.isReactNativeWebView = true;
  window.isAndroidApp = false;
  navigator.canShare = () => false;
  navigator.share = async payload => { sharedPayloads.push(payload); };
  const { shareCertification } = shareModule.useCertificationShare();
  const result = await shareCertification({ preparedImage, planId: 7, scheduleId: 13 });
  assert.equal(result, 'copied');
  assert.equal(sharedPayloads.length, 0);
  assert.equal(clickedDownloads, 0);
  assert.equal(copiedLinks.length, 1);
  assert.match(copiedLinks[0], /certification=tongdok/);
  assert.match(copiedLinks[0], /plan_id=7/);
  assert.match(copiedLinks[0], /schedule_id=13/);
});

test('Android app routes certification sharing and saving through the native image bridge', async () => {
  window.isReactNativeWebView = true;
  window.isAndroidApp = true;
  window.ReactNativeWebView = { postMessage(value) { nativeMessages.push(JSON.parse(value)); } };
  const { downloadCertificationImage, shareCertification } = shareModule.useCertificationShare();
  const shareResult = await shareCertification({ preparedImage, planId: 7, scheduleId: 13 });
  await downloadCertificationImage(undefined, { preparedImage, planId: 7, scheduleId: 13 });
  assert.equal(shareResult, 'shared');
  assert.equal(clickedDownloads, 0);
  assert.deepEqual(nativeMessages.map(({ type, action, fileName }) => ({ type, action, fileName })), [
    { type: 'certification:image', action: 'share', fileName: 'maeil1dok-tongdok-certification.png' },
    { type: 'certification:image', action: 'save', fileName: 'maeil1dok-tongdok-certification.png' },
  ]);
  for (const message of nativeMessages) {
    assert.match(message.dataUrl, /^data:image\/png;base64,/);
    assert.equal(message.dataUrl, preparedImage.dataUrl);
  }
});
