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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  });
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const {
  DEFAULT_READING_SETTINGS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  AUDIO_RATE_MIN,
  AUDIO_RATE_MAX,
  FONT_WEIGHTS,
  NATIVE_FONT_ORDER,
  parseReadingSettings,
  parseStoredReadingSettings,
  parseReadingSettingsResponse,
  serializeReadingSettingsPatch,
  resolveNativeFontFamily,
} = loadTsModule('api/readingSettings.ts');

// --- defaults mirror the web store contract ---

test('defaults match the web reading-settings contract', () => {
  assert.deepEqual(DEFAULT_READING_SETTINGS, {
    theme: 'light',
    fontFamily: 'kopub-batang',
    fontSize: 16,
    fontWeight: 'medium',
    lineHeight: 1.6,
    textAlign: 'left',
    verseJoining: false,
    showVerseNumbers: true,
    tongdokAutoComplete: false,
    audioPlaybackRate: 1.0,
    showDescription: true,
    showCrossRef: true,
    highlightNames: true,
    showFootnotes: false,
  });
});

// --- parseReadingSettings: malformed input falls back to defaults ---

test('malformed inputs produce default settings', () => {
  for (const input of [null, undefined, 42, 'text', true, [], [1, 2]]) {
    assert.deepEqual(parseReadingSettings(input), DEFAULT_READING_SETTINGS);
  }
});

test('unknown keys are ignored and do not leak into the model', () => {
  const parsed = parseReadingSettings({ font_size: 20, hacker: 'yes', theme: 'dark' });
  assert.equal(parsed.fontSize, 20);
  assert.equal(parsed.theme, 'dark');
  assert.equal('hacker' in parsed, false);
});

test('snake_case server payload parses every field', () => {
  const parsed = parseReadingSettings({
    theme: 'dark',
    font_family: 'noto-serif',
    font_size: 20,
    font_weight: 'bold',
    line_height: 2.0,
    text_align: 'justify',
    verse_joining: true,
    show_verse_numbers: false,
    tongdok_auto_complete: true,
    audio_playback_rate: 1.5,
    show_description: false,
    show_cross_ref: false,
    highlight_names: false,
    show_footnotes: true,
  });
  assert.deepEqual(parsed, {
    theme: 'dark',
    fontFamily: 'noto-serif',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 2.0,
    textAlign: 'justify',
    verseJoining: true,
    showVerseNumbers: false,
    tongdokAutoComplete: true,
    audioPlaybackRate: 1.5,
    showDescription: false,
    showCrossRef: false,
    highlightNames: false,
    showFootnotes: true,
  });
});

test('camelCase local-storage payload parses every field', () => {
  const parsed = parseReadingSettings({
    theme: 'system',
    fontFamily: 'pretendard',
    fontSize: 18,
    fontWeight: 'normal',
    lineHeight: 1.8,
    textAlign: 'justify',
    verseJoining: true,
    showVerseNumbers: false,
    tongdokAutoComplete: true,
    audioPlaybackRate: 0.75,
    showDescription: false,
    showCrossRef: false,
    highlightNames: false,
    showFootnotes: true,
  });
  assert.equal(parsed.fontFamily, 'pretendard');
  assert.equal(parsed.fontSize, 18);
  assert.equal(parsed.audioPlaybackRate, 0.75);
  assert.equal(parsed.showFootnotes, true);
});

// --- numeric boundaries ---

test('font size accepts both inclusive bounds and integer values only in range', () => {
  assert.equal(parseReadingSettings({ font_size: FONT_SIZE_MIN }).fontSize, 14);
  assert.equal(parseReadingSettings({ font_size: FONT_SIZE_MAX }).fontSize, 24);
  assert.equal(parseReadingSettings({ font_size: 13 }).fontSize, 16);
  assert.equal(parseReadingSettings({ font_size: 25 }).fontSize, 16);
  assert.equal(parseReadingSettings({ font_size: 16.7 }).fontSize, 17);
  assert.equal(parseReadingSettings({ font_size: '18' }).fontSize, 16);
  assert.equal(parseReadingSettings({ font_size: NaN }).fontSize, 16);
  assert.equal(parseReadingSettings({ font_size: Infinity }).fontSize, 16);
});

test('line height accepts inclusive bounds and rejects out-of-range numbers', () => {
  assert.equal(parseReadingSettings({ line_height: LINE_HEIGHT_MIN }).lineHeight, 1.4);
  assert.equal(parseReadingSettings({ line_height: LINE_HEIGHT_MAX }).lineHeight, 2.4);
  assert.equal(parseReadingSettings({ line_height: 1.39 }).lineHeight, 1.6);
  assert.equal(parseReadingSettings({ line_height: 2.41 }).lineHeight, 1.6);
  assert.equal(parseReadingSettings({ line_height: 1.66 }).lineHeight, 1.7);
  assert.equal(parseReadingSettings({ line_height: 'wide-ish' }).lineHeight, 1.6);
});

test('legacy string line heights migrate to numeric values', () => {
  assert.equal(parseReadingSettings({ line_height: 'compact' }).lineHeight, 1.5);
  assert.equal(parseReadingSettings({ line_height: 'normal' }).lineHeight, 1.8);
  assert.equal(parseReadingSettings({ line_height: 'wide' }).lineHeight, 2.2);
});

test('audio playback rate accepts inclusive bounds and rejects out-of-range', () => {
  assert.equal(parseReadingSettings({ audio_playback_rate: AUDIO_RATE_MIN }).audioPlaybackRate, 0.5);
  assert.equal(parseReadingSettings({ audio_playback_rate: AUDIO_RATE_MAX }).audioPlaybackRate, 2.0);
  assert.equal(parseReadingSettings({ audio_playback_rate: 0.49 }).audioPlaybackRate, 1.0);
  assert.equal(parseReadingSettings({ audio_playback_rate: 2.01 }).audioPlaybackRate, 1.0);
  assert.equal(parseReadingSettings({ audio_playback_rate: 'fast' }).audioPlaybackRate, 1.0);
});

// --- enum and boolean strictness ---

test('enum fields reject unknown values and keep defaults', () => {
  const parsed = parseReadingSettings({
    theme: 'blue',
    font_family: 'comic-sans',
    font_weight: 'heavy',
    text_align: 'center',
  });
  assert.equal(parsed.theme, 'light');
  assert.equal(parsed.fontFamily, 'kopub-batang');
  assert.equal(parsed.fontWeight, 'medium');
  assert.equal(parsed.textAlign, 'left');
});

test('boolean fields require real booleans, not truthy values', () => {
  const parsed = parseReadingSettings({
    verse_joining: 'yes',
    show_verse_numbers: 1,
    highlight_names: 0,
    show_footnotes: 'true',
  });
  assert.equal(parsed.verseJoining, false);
  assert.equal(parsed.showVerseNumbers, true);
  assert.equal(parsed.highlightNames, true);
  assert.equal(parsed.showFootnotes, false);
});

// --- serialization round-trip ---

test('serialize emits snake_case keys for every setting', () => {
  const patch = serializeReadingSettingsPatch(DEFAULT_READING_SETTINGS);
  assert.deepEqual(Object.keys(patch).sort(), [
    'audio_playback_rate',
    'font_family',
    'font_size',
    'font_weight',
    'highlight_names',
    'line_height',
    'show_cross_ref',
    'show_description',
    'show_footnotes',
    'show_verse_numbers',
    'text_align',
    'theme',
    'tongdok_auto_complete',
    'verse_joining',
  ]);
  assert.equal(patch.font_size, 16);
  assert.equal(patch.audio_playback_rate, 1.0);
});

test('parse(serialize(settings)) round-trips a non-default settings object', () => {
  const custom = {
    ...DEFAULT_READING_SETTINGS,
    theme: 'dark',
    fontFamily: 'pretendard',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 2.1,
    textAlign: 'justify',
    verseJoining: true,
    showVerseNumbers: false,
    tongdokAutoComplete: true,
    audioPlaybackRate: 1.25,
    showDescription: false,
    showCrossRef: false,
    highlightNames: false,
    showFootnotes: true,
  };
  assert.deepEqual(parseReadingSettings(serializeReadingSettingsPatch(custom)), custom);
});

// --- response envelope and stored JSON ---

test('response parser unwraps the standard envelope', () => {
  const body = {
    success: true,
    data: { settings: { font_size: 19, theme: 'dark' } },
  };
  const parsed = parseReadingSettingsResponse(body);
  assert.equal(parsed.fontSize, 19);
  assert.equal(parsed.theme, 'dark');
});

test('response parser rejects malformed envelopes', () => {
  for (const body of [null, {}, { success: false }, { success: true, data: {} }, { success: true, data: { settings: 'x' } }]) {
    assert.equal(parseReadingSettingsResponse(body), null);
  }
});

test('stored-settings parser returns null on malformed JSON and parses valid JSON', () => {
  assert.equal(parseStoredReadingSettings(null), null);
  assert.equal(parseStoredReadingSettings('not json'), null);
  assert.equal(parseStoredReadingSettings('"just a string"'), null);
  assert.equal(parseStoredReadingSettings('[1,2]'), null);
  const parsed = parseStoredReadingSettings(JSON.stringify({ fontSize: 21, verseJoining: true }));
  assert.equal(parsed.fontSize, 21);
  assert.equal(parsed.verseJoining, true);
});

// --- native font resolution ---

test('bundled fonts resolve to installed asset names per weight', () => {
  assert.equal(resolveNativeFontFamily('pretendard', 'normal'), 'Pretendard-Regular');
  assert.equal(resolveNativeFontFamily('pretendard', 'medium'), 'Pretendard-Medium');
  assert.equal(resolveNativeFontFamily('pretendard', 'bold'), 'Pretendard-SemiBold');
  assert.equal(resolveNativeFontFamily('noto-serif', 'normal'), 'NotoSerifKR-Regular');
  assert.equal(resolveNativeFontFamily('noto-serif', 'bold'), 'NotoSerifKR-Bold');
});

test('system and unbundled families resolve to null (RN default font)', () => {
  assert.equal(resolveNativeFontFamily('system', 'normal'), null);
  assert.equal(resolveNativeFontFamily('kopub-batang', 'normal'), null);
  assert.equal(resolveNativeFontFamily('ridi-batang', 'bold'), null);
  assert.equal(resolveNativeFontFamily('noto-sans', 'medium'), null);
});

test('sheet font order lists only natively renderable families', () => {
  assert.deepEqual([...NATIVE_FONT_ORDER], ['pretendard', 'noto-serif', 'system']);
});

test('font weight map matches the web contract', () => {
  assert.deepEqual(FONT_WEIGHTS, { normal: 400, medium: 500, bold: 600 });
});
