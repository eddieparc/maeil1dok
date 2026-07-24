import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const sanitizeSource = await readFile(
  new URL('../app/composables/useSanitize.ts', import.meta.url),
  'utf8',
);

// Load useSanitize with a controllable DOMPurify stub so both the DOM-backed
// (client) branch and the DOM-less (SSR/Node) branch can be exercised in
// isolation. The stub records that the DOM sanitizer ran on the client path.
const importSanitizeModule = async () => {
  const runnableSource = sanitizeSource.replace(
    "import DOMPurify from 'dompurify';",
    "const DOMPurify = { sanitize: (html) => `DOMPURIFY:${html}` };",
  );

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const withoutWindow = (fn) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  delete globalThis.window;
  try {
    return fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    }
  }
};

const withWindow = (value, fn) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = value;
  try {
    return fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      delete globalThis.window;
    }
  }
};

test('SSR sanitize never emits executable markup into the server document', async () => {
  const { useSanitize } = await importSanitizeModule();
  const { sanitize } = useSanitize();

  const payloads = [
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)></svg>',
    '<script>alert(document.cookie)</script>',
    '<a href="javascript:alert(1)">tap</a>',
    "<div onclick='steal()'>hi</div>",
  ];

  withoutWindow(() => {
    for (const payload of payloads) {
      const output = sanitize(payload);
      // No raw tag delimiters survive: every '<' and '>' is entity-escaped,
      // so the browser parses the SSR response as inert text, not elements.
      assert.equal(/<[a-zA-Z/!]/.test(output), false, `raw tag survived for: ${payload}`);
      assert.equal(output.includes('<'), false, `unescaped '<' survived for: ${payload}`);
      assert.equal(output.includes('>'), false, `unescaped '>' survived for: ${payload}`);
      assert.ok(output.includes('&lt;'), `expected escaped markup for: ${payload}`);
    }
  });
});

test('SSR sanitize escapes the ampersand first to avoid double-encoding gaps', async () => {
  const { useSanitize } = await importSanitizeModule();
  const { sanitize } = useSanitize();

  withoutWindow(() => {
    assert.equal(sanitize('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
    assert.equal(sanitize('"quoted" & \'single\''), '&quot;quoted&quot; &amp; &#39;single&#39;');
  });
});

test('empty and non-string inputs return an empty string on every runtime', async () => {
  const { useSanitize } = await importSanitizeModule();
  const { sanitize } = useSanitize();

  for (const runner of [withoutWindow, (fn) => withWindow({}, fn)]) {
    runner(() => {
      assert.equal(sanitize(''), '');
      assert.equal(sanitize(undefined), '');
      assert.equal(sanitize(null), '');
      assert.equal(sanitize(42), '');
    });
  }
});

test('client sanitize still delegates to the DOM sanitizer when a window exists', async () => {
  const { useSanitize } = await importSanitizeModule();
  const { sanitize } = useSanitize();

  withWindow({ document: {} }, () => {
    assert.equal(sanitize('<p>hi</p>'), 'DOMPURIFY:<p>hi</p>');
  });
});

test('falls back to escaping when a window exists but DOMPurify has no sanitizer', async () => {
  const brokenSource = sanitizeSource.replace(
    "import DOMPurify from 'dompurify';",
    'const DOMPurify = {};',
  );
  const { code } = await transform(brokenSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const { useSanitize } = await import(`${dataUrl}#${Date.now()}-${Math.random()}`);
  const { sanitize } = useSanitize();

  withWindow({ document: {} }, () => {
    assert.equal(sanitize('<img onerror=alert(1)>'), '&lt;img onerror=alert(1)&gt;');
  });
});
