import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { after, before, beforeEach, test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = require('../node_modules/nitropack/node_modules/esbuild');

let shareModule;
let clickedDownloads;
let copiedLinks;
let objectUrls;
let revokeObjectUrls;
let canvasBlobFactory;

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

const installBrowserStubs = () => {
  clickedDownloads = 0;
  copiedLinks = [];
  objectUrls = [];
  revokeObjectUrls = [];
  canvasBlobFactory = () => new Blob(['certification-png'], { type: 'image/png' });

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
            callback(canvasBlobFactory());
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
