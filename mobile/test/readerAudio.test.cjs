const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTsModule(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const {
  PLAYBACK_RATES,
  AUDIO_RATE_MIN,
  AUDIO_RATE_MAX,
  selectReaderAudioLink,
  extractYouTubeVideoId,
  buildYouTubeEmbedUrl,
  parseReaderAudioResponse,
  parseReaderAudioEvent,
} = loadTsModule('api/readerAudio.ts');

// --- selectReaderAudioLink: plan audio_link precedence -----------------------

test('plan audio_link always wins over fallback links', () => {
  const plan = 'https://www.youtube.com/watch?v=PLANLINK123';
  const link = selectReaderAudioLink({
    audioLink: plan,
    fallbackLinks: [{ book: 'gen', chapter: 1, url: 'https://youtu.be/FALLBACK001' }],
    book: 'gen',
    chapter: 1,
  });
  assert.equal(link, plan);
});

test('plan audio_link wins even when no fallback matches the chapter', () => {
  const plan = 'https://www.youtube.com/watch?v=PLANLINK123';
  const link = selectReaderAudioLink({
    audioLink: plan,
    fallbackLinks: [{ book: 'exo', chapter: 9, url: 'https://youtu.be/FALLBACK001' }],
    book: 'gen',
    chapter: 1,
  });
  assert.equal(link, plan);
});

test('fallback link is selected only when book and chapter both match', () => {
  const url = 'https://youtu.be/FALLBACK001';
  const link = selectReaderAudioLink({
    audioLink: null,
    fallbackLinks: [
      { book: 'gen', chapter: 1, url: 'https://youtu.be/WRONGCHAP01' },
      { book: 'exo', chapter: 2, url: 'https://youtu.be/WRONGBOOK01' },
      { book: 'gen', chapter: 2, url },
    ],
    book: 'gen',
    chapter: 2,
  });
  assert.equal(link, url);
});

test('no link is playable when plan link is absent and nothing matches', () => {
  const fallbacks = [{ book: 'gen', chapter: 1, url: 'https://youtu.be/FALLBACK001' }];
  for (const input of [
    { audioLink: null, fallbackLinks: fallbacks, book: 'exo', chapter: 1 },
    { audioLink: null, fallbackLinks: fallbacks, book: 'gen', chapter: 2 },
    { audioLink: null, fallbackLinks: fallbacks, book: null, chapter: 1 },
    { audioLink: null, fallbackLinks: fallbacks, book: 'gen', chapter: 'x' },
    { audioLink: null, fallbackLinks: [], book: 'gen', chapter: 1 },
    { audioLink: null, fallbackLinks: null, book: 'gen', chapter: 1 },
    { audioLink: '', fallbackLinks: fallbacks, book: 'exo', chapter: 1 },
    {},
  ]) {
    assert.equal(selectReaderAudioLink(input), null, JSON.stringify(input));
  }
});

test('chapter given as a numeric string still matches', () => {
  const url = 'https://youtu.be/FALLBACK001';
  const link = selectReaderAudioLink({
    audioLink: null,
    fallbackLinks: [{ book: 'psa', chapter: 23, url }],
    book: 'psa',
    chapter: '23',
  });
  assert.equal(link, url);
});

// --- extractYouTubeVideoId ---------------------------------------------------

const VIDEO_ID = 'dQw4w9WgXcQ';

test('extracts the id from every supported YouTube URL shape', () => {
  const cases = [
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PLabc&index=3`,
    `https://www.youtube.com/watch?list=PLabc&v=${VIDEO_ID}`,
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?t=42`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}?rel=0`,
    `https://www.youtube.com/v/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
  ];
  for (const url of cases) {
    assert.equal(extractYouTubeVideoId(url), VIDEO_ID, url);
  }
});

test('rejects malformed, non-YouTube, and non-video URLs', () => {
  const cases = [
    '',
    '   ',
    'not a url',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://evil-youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=waytoolongvideoid123',
    'https://www.youtube.com/watch?v=bad!chars@#',
    'https://youtu.be/',
    'https://youtu.be/short',
    'https://www.youtube.com/embed/',
    'https://www.youtube.com/playlist?list=PLabc',
    'https://www.youtube.com/@readingjesus',
    'https://www.youtube.com/results?search_query=bible',
    'ftp://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    null,
    undefined,
    42,
  ];
  for (const url of cases) {
    assert.equal(extractYouTubeVideoId(url), null, JSON.stringify(url));
  }
});

// --- buildYouTubeEmbedUrl ----------------------------------------------------

test('embed url targets youtube embed with jsapi and inline playback', () => {
  const url = buildYouTubeEmbedUrl(VIDEO_ID);
  assert.ok(url.startsWith(`https://www.youtube.com/embed/${VIDEO_ID}?`), url);
  assert.ok(url.includes('enablejsapi=1'), url);
  assert.ok(url.includes('playsinline=1'), url);
  assert.ok(url.includes('rel=0'), url);
});

test('embed url encodes the id and rejects invalid ids', () => {
  assert.equal(buildYouTubeEmbedUrl('bad id!'), null);
  assert.equal(buildYouTubeEmbedUrl(''), null);
  assert.equal(buildYouTubeEmbedUrl('short'), null);
});

// --- PLAYBACK_RATES ----------------------------------------------------------

test('playback rates cover the 0.5..2.0 contract including both bounds and 1x', () => {
  assert.ok(PLAYBACK_RATES.includes(AUDIO_RATE_MIN));
  assert.ok(PLAYBACK_RATES.includes(AUDIO_RATE_MAX));
  assert.ok(PLAYBACK_RATES.includes(1));
  for (const rate of PLAYBACK_RATES) {
    assert.ok(rate >= 0.5 && rate <= 2.0, `rate ${rate} out of range`);
  }
  assert.equal(AUDIO_RATE_MIN, 0.5);
  assert.equal(AUDIO_RATE_MAX, 2.0);
});

// --- parseReaderAudioResponse ------------------------------------------------

test('parses the raw /api/v1/todos/detail/ response shape', () => {
  const parsed = parseReaderAudioResponse({
    book: 'gen',
    chapter: 1,
    audio_link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    fallback_audio_links: [
      { book: 'gen', chapter: 1, url: 'https://youtu.be/FALLBACK001' },
      { book: 'gen', chapter: 2, url: 'https://youtu.be/FALLBACK002' },
    ],
  });
  assert.equal(parsed.audioLink, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.deepEqual(parsed.fallbackLinks, [
    { book: 'gen', chapter: 1, url: 'https://youtu.be/FALLBACK001' },
    { book: 'gen', chapter: 2, url: 'https://youtu.be/FALLBACK002' },
  ]);
});

test('unwraps a { success, data } envelope when present', () => {
  const parsed = parseReaderAudioResponse({
    success: true,
    data: {
      audio_link: null,
      fallback_audio_links: [{ book: 'exo', chapter: 3, url: 'https://youtu.be/FALLBACK003' }],
    },
  });
  assert.equal(parsed.audioLink, null);
  assert.equal(parsed.fallbackLinks.length, 1);
  assert.equal(parsed.fallbackLinks[0].book, 'exo');
});

test('normalizes empty audio_link to null and drops malformed fallback entries', () => {
  const parsed = parseReaderAudioResponse({
    audio_link: '   ',
    fallback_audio_links: [
      { book: 'gen', chapter: 1, url: 'https://youtu.be/FALLBACK001' },
      { book: 'gen', chapter: '1', url: 'https://youtu.be/STRINGCHAP1' },
      { book: 'gen', url: 'https://youtu.be/NOCHAPTER01' },
      { chapter: 2, url: 'https://youtu.be/NOBOOK00001' },
      { book: 'gen', chapter: 3 },
      { book: 'gen', chapter: 4, url: '   ' },
      'garbage',
      null,
    ],
  });
  assert.equal(parsed.audioLink, null);
  assert.deepEqual(parsed.fallbackLinks, [
    { book: 'gen', chapter: 1, url: 'https://youtu.be/FALLBACK001' },
  ]);
});

test('malformed payloads produce an empty selection model', () => {
  for (const bad of [null, undefined, 42, 'x', [], { audio_link: 5 }, { fallback_audio_links: 'no' }]) {
    const parsed = parseReaderAudioResponse(bad);
    assert.equal(parsed.audioLink, null, JSON.stringify(bad));
    assert.deepEqual(parsed.fallbackLinks, [], JSON.stringify(bad));
  }
});

// Component/media behavior is executed in readerAudio.integration.test.cjs.
test('bridge parser rejects malformed and foreign events at its boundary', () => {
  const source = { link: 'https://youtu.be/dQw4w9WgXcQ', contextKey: 'gen:1', generation: 7 };
  for (const value of [null, [], {}, { ...source, type: 'time', currentTime: -1, duration: 5 },
    { ...source, type: 'time', currentTime: 1, duration: '5' }, { ...source, type: 'state', state: 88 },
    { ...source, type: 'error', code: '100' }, { ...source, type: 'unknown' },
    { ...source, type: 'ended', generation: 6 }]) {
    assert.equal(parseReaderAudioEvent(JSON.stringify(value), source), null);
  }
  assert.equal(parseReaderAudioEvent('broken json', source), null);
  assert.deepEqual(parseReaderAudioEvent(JSON.stringify({ ...source, type: 'time', currentTime: 30, duration: 60 }), source),
    { ...source, type: 'time', currentTime: 30, duration: 60 });
});
