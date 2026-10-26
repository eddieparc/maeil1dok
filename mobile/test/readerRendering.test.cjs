const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const cache = new Map();
let readingTheme = 'light';
let viewportWidth = 440;
let platformOS = 'ios';
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module);
  m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
  m.require = name => {
    if (name.endsWith('/ReadingSettingsProvider')) return {
      useOptionalReadingSettings: () => ({ settings: { theme: readingTheme } }),
    };
    if (name === 'react-native') return { Text: 'Text', View: 'View', useColorScheme: () => 'light',
      Platform: { get OS() { return platformOS; } },
      useWindowDimensions: () => ({ width: viewportWidth, height: 956 }),
      StyleSheet: { create: value => value } };
    if (name.startsWith('.')) {
      const p = path.resolve(path.dirname(filename), name);
      return load([p + '.ts', p + '.tsx'].find(fs.existsSync));
    }
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  cache.set(filename, m.exports);
  return m.exports;
}
const { parseBibleContent } = load(path.resolve(__dirname, '../api/bibleContent.ts'));
const { DEFAULT_READING_SETTINGS } = load(path.resolve(__dirname, '../api/readingSettings.ts'));
const Body = load(path.resolve(__dirname, '../components/bible/ReaderBody.tsx')).default;
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : React.isValidElement(el)
  ? [el, ...nodes(el.props.children)] : [];
const text = el => Array.isArray(el) ? el.map(text).join('') : React.isValidElement(el)
  ? text(el.props.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : '';
const render = (blocks, settings = {}) => {
  readingTheme = settings.theme ?? 'light';
  return Body({ blocks, settings: { ...DEFAULT_READING_SETTINGS, ...settings } });
};

// Verbatim excerpts, 2026-09-22, HTTP 200:
// https://beta.maeil1dok.app/api/v1/bible-cache/GAE/gen/2/
const standard = `<div id="tdBible1"><span><span class="number">8&nbsp;&nbsp;&nbsp;</span>여호와 하나님이 동방의 <font class="area">에덴</font>에 동산을 창설하시고 그 지으신 사람을 거기 두시니라 </font></span><br /><span><span class="number">9&nbsp;&nbsp;&nbsp;</span>여호와 하나님이 그 땅에서 보기에 아름답고 먹기에 좋은 나무가 나게 하시니 동산 가운데에는 생명 나무와 <font size=2><a class=comment href="#" onClick="return clickPopUp('D_255037_1', event)" ><font size=2>2)</font></a></font>선악을 알게 하는 나무도 있더라
<div id='D_255037_1' class=D2  onclick="popDown2('D_255037_1')" style='display:none;z-index:100' >선악 지식의 나무</div></font></span><br /></div>`;
// https://beta.maeil1dok.app/api/v1/bible-cache/KNT/psa/23/
const psalm = `<h2 data-number="23" data-sid="PSA 23" class="c">23</h2><p class="s">여호와를 의지하는 노래</p><p class="d"><span class="verse-span" data-verse-id="PSA.23.1" data-verse-org-ids="PSA.23.1"><span data-number="1" data-sid="PSA 23:1" class="v">1</span></span><span data-caller="+" id="PSA.23.1!f.1" data-verse-id="PSA.23.1" class="f"><span class="fr">23:1 </span><span class="ft">히브리어 성서를 따라 여기서부터 1절로 적음</span></span>노랫말(시). 다윗에게 속한 것.</p><p data-vid="PSA 23:1" class="sp">(혼잣말)</p><p data-vid="PSA 23:1" class="q1"><span class="verse-span" data-verse-id="PSA.23.1" data-verse-org-ids="PSA.23.1">여호와가 나의 목자,</span></p>`;
// https://beta.maeil1dok.app/api/v1/bible-cache/KNT/mat/1/
const crossref = '<p class="s">다윗의 자손이자 아브라함의 자손이신 예수님</p><p class="r">(<span id="LUK.3.23-LUK.3.38">눅 3:23-38</span>)</p>';
const knt = html => parseBibleContent(JSON.stringify({ found: true, content: html }), 'json');

test('captured standard source renders only marked places and preserves Korean suffix adjacency', () => {
  const blocks = parseBibleContent(standard, 'html');
  const result = render(blocks);
  assert.deepEqual(nodes(result).filter(n => n.props.testID === 'reader-place').map(text), ['에덴']);
  assert.equal(nodes(result).filter(n => n.props.testID === 'reader-name').length, 0);
  assert.match(text(result), /에덴에 동산/);
  assert.equal(text(result).includes('선악 지식의 나무'), false);
  const annotated = render(blocks, { showFootnotes: true });
  assert.deepEqual(nodes(annotated).filter(n => n.props.testID === 'reader-footnote').map(text), [' [선악 지식의 나무]']);
  assert.equal(nodes(annotated).filter(n => n.props.testID === 'reader-place').length, 1);
});

test('captured KNT description retains its footnote independently of ordinary headings', () => {
  const blocks = knt(psalm);
  const result = render(blocks, { showFootnotes: true });
  assert.deepEqual(nodes(result).filter(n => n.props.testID === 'reader-footnote').map(text),
    [' [히브리어 성서를 따라 여기서부터 1절로 적음]']);
  const hidden = render(blocks, { showDescription: false, showFootnotes: true });
  assert.equal(nodes(hidden).filter(n => n.props.testID === 'reader-description').length, 0);
  assert.deepEqual(nodes(hidden).filter(n => n.props.testID === 'reader-heading').map(text), ['여호와를 의지하는 노래', '(혼잣말)']);
  assert.match(text(hidden), /여호와가 나의 목자,/);
});

test('captured KNT cross reference is independent of title and never fabricates name tags', () => {
  const blocks = knt(crossref);
  const shown = render(blocks);
  assert.match(text(shown), /눅 3:23-38/);
  assert.equal(nodes(shown).filter(n => n.props.testID === 'reader-name').length, 0);
  const hidden = render(blocks, { showCrossRef: false });
  assert.equal(text(hidden).includes('눅 3:23-38'), false);
  assert.equal(nodes(hidden).filter(n => n.props.testID === 'reader-heading').length, 1);
});

test('joined poetry removes line breaks but remains split at a following heading', () => {
  const blocks = [
    { type: 'verse', num: 1, text: 'First\nline' },
    { type: 'verse', num: 2, text: 'Second' },
    { type: 'heading', text: 'Heading' },
    { type: 'verse', num: 3, text: 'Third' },
  ];
  const paragraphs = nodes(render(blocks, { verseJoining: true, showVerseNumbers: false }))
    .filter(n => n.props.testID === 'reader-verse-paragraph');
  assert.deepEqual(paragraphs.map(text), ['First line Second', 'Third']);
});

test('dark body owns its padding so reader margins cannot remain a light gutter', () => {
  const body = render([], { theme: 'dark' });
  assert.equal(body.props.style.backgroundColor, '#1a1a1a');
  assert.equal(body.props.style.paddingHorizontal, 5);
  assert.equal(body.props.style.flexGrow, 1);
});
test('reader gutter follows the web 768px breakpoint without constraining body width', () => {
  for (const [width, padding] of [[767, 5], [768, 5], [769, 16], [820, 16], [1032, 16]]) {
    viewportWidth = width;
    const body = render([]);
    assert.equal(body.props.style.paddingHorizontal, padding);
    assert.equal(body.props.style.maxWidth, undefined);
  }
  viewportWidth = 440;
});
test('both verse layouts keep Korean words together on iOS', () => {
  for (const verseJoining of [false, true]) {
    const paragraphs = nodes(render([{ type: 'verse', num: 1, text: '하나님이 보시기에 좋았더라' }], { verseJoining }))
      .filter(node => node.props.testID === 'reader-verse-paragraph');
    assert.equal(paragraphs.length, 1);
    assert.equal(paragraphs[0].props.lineBreakStrategyIOS, 'hangul-word');
  }
});
test('Android justified text uses zero tracking without changing alignment or verse presses', () => {
  const blocks = [{ type: 'verse', num: 1, text: '첫째 절' }, { type: 'verse', num: 2, text: '둘째 절' }];
  for (const os of ['ios', 'android']) {
    platformOS = os;
    for (const textAlign of ['left', 'justify']) {
      const selected = [];
      const body = Body({ blocks, settings: { ...DEFAULT_READING_SETTINGS, fontSize: 19,
        verseJoining: true, textAlign }, onVersePress: verse => selected.push(verse) });
      const paragraph = nodes(body).find(n => n.props.testID === 'reader-verse-paragraph');
      const style = Object.assign({}, ...[paragraph.props.style].flat(Infinity));
      assert.equal(style.textAlign, textAlign);
      assert.equal(style.letterSpacing, os === 'android' && textAlign === 'justify' ? 0 : -0.38);
      nodes(paragraph).filter(n => n.props.onPress)[1].props.onPress();
      assert.deepEqual(selected, [2]);
    }
  }
  platformOS = 'ios';
});

test('block verses reserve a number column while joining uses a single native text layout', () => {
  const blocks = [{ type: 'verse', num: 1, text: 'first' }, { type: 'verse', num: 2, text: 'second' }];
  const separate = nodes(render(blocks, { verseJoining: false }));
  assert.equal(separate.filter(n => n.props.testID === 'reader-verse-row').length, 2);
  const joined = nodes(render(blocks, { verseJoining: true }));
  assert.equal(joined.filter(n => n.props.testID === 'reader-verse-row').length, 0);
  assert.equal(joined.filter(n => n.props.testID === 'reader-verse-paragraph').length, 1);
  const hidden = nodes(render(blocks, { showVerseNumbers: false }));
  assert.equal(hidden.filter(n => n.props.testID === 'reader-verse-number').length, 0);
});

test('preview emphasis follows the toggle without changing the sample text', () => {
  const { PreviewSection } = load(path.resolve(__dirname, '../components/bible/ReadingSettingsSheet.parts.tsx'));
  const preview = PreviewSection({ verseJoining: true, showVerseNumbers: false, highlightNames: true, textStyle: {} });
  const emphasized = nodes(preview).filter(n => n.props.testID === 'reading-preview-name');
  const plain = PreviewSection({ verseJoining: true, showVerseNumbers: false, highlightNames: false, textStyle: {} });
  assert.equal(emphasized.length, 2);
  assert.ok(emphasized.every(n => typeof n.props.style.color === 'string'));
  assert.ok(nodes(plain).filter(n => n.props.testID === 'reading-preview-name').every(n => n.props.style === undefined));
  assert.equal(text(preview), text(plain));
});
