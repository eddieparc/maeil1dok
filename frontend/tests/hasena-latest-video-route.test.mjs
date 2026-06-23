import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, { moduleCache: false });

const installNuxtTestGlobals = () => {
  const originalDefineEventHandler = globalThis.defineEventHandler;
  const originalCreateError = globalThis.createError;

  globalThis.defineEventHandler = (handler) => handler;
  globalThis.createError = ({ statusCode, statusMessage }) => Object.assign(
    new Error(statusMessage),
    { statusCode, statusMessage },
  );

  return () => {
    globalThis.defineEventHandler = originalDefineEventHandler;
    globalThis.createError = originalCreateError;
  };
};

const importLatestVideoHandler = async () => {
  return jiti.import('../server/api/hasena/latest-video.get.ts');
};

test('returns first public playlist video when the YouTube XML feed returns 404', async () => {
  const restoreNuxtGlobals = installNuxtTestGlobals();
  const { default: handler } = await importLatestVideoHandler();
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);

    if (href === 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL') {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }

    if (href === 'https://www.youtube.com/playlist?list=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL') {
      return new Response(`
        <script>
          var ytInitialData = {
            "contents": {
              "playlistVideoRenderer": {
                "videoId": "R4AQ_pMJdfY",
                "title": { "runs": [{ "text": "2026년 6월 23일 하세나" }] }
              }
            }
          };
        </script>
      `, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const result = await handler();

    assert.deepEqual(result, {
      videoId: 'R4AQ_pMJdfY',
      title: '2026년 6월 23일 하세나',
      publishedAt: null,
    });
    assert.deepEqual(calls, [
      'https://www.youtube.com/feeds/videos.xml?playlist_id=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL',
      'https://www.youtube.com/playlist?list=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreNuxtGlobals();
  }
});

test('preserves the YouTube XML feed latest video response when the feed succeeds', async () => {
  const restoreNuxtGlobals = installNuxtTestGlobals();
  const { default: handler } = await importLatestVideoHandler();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const href = String(url);

    if (href === 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL') {
      return new Response(`
        <feed>
          <entry>
            <yt:videoId>abcDEF12345</yt:videoId>
            <title>하세나 &amp; 오늘</title>
            <published>2026-06-23T00:00:00+00:00</published>
          </entry>
        </feed>
      `, { status: 200, headers: { 'Content-Type': 'application/atom+xml' } });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const result = await handler();

    assert.deepEqual(result, {
      videoId: 'abcDEF12345',
      title: '하세나 & 오늘',
      publishedAt: '2026-06-23T00:00:00+00:00',
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreNuxtGlobals();
  }
});

test('surfaces an observable 502 when both YouTube sources are unavailable', async () => {
  const restoreNuxtGlobals = installNuxtTestGlobals();
  const { default: handler } = await importLatestVideoHandler();
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const errorLogs = [];

  globalThis.fetch = async (url) => {
    const href = String(url);

    if (href === 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL') {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }

    if (href === 'https://www.youtube.com/playlist?list=PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL') {
      return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };
  console.error = (message) => {
    errorLogs.push(message);
  };

  try {
    await assert.rejects(
      () => handler(),
      (error) => error.statusCode === 502 && error.statusMessage === 'Failed to load latest Hasena video',
    );

    assert.equal(errorLogs.length, 1);
    assert.deepEqual(JSON.parse(errorLogs[0]), {
      service: 'hasena_latest_video',
      event: 'hasena_latest_video_playlist_html_unavailable',
      source: 'youtube_playlist_html',
      status: 502,
      statusText: 'Bad Gateway',
    });
  } finally {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
    restoreNuxtGlobals();
  }
});
