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

const { parseBibleContent, normalizeVersionList } = loadTsModule('api/bibleContent.ts');

// ---------------------------------------------------------------------------
// Real fixtures captured from GET /api/v1/bible-cache/{version}/{book}/{ch}/
// (trimmed to the first verses; markup shape preserved verbatim).
// ---------------------------------------------------------------------------

// GAE gen/1 — 대한성서공회 korbibReadpage markup (content_type: 'html').
// Verse 2 carries an inline footnote: a comment anchor plus a hidden
// <div class=D2> popup nested inside the verse span.
const GAE_GEN1_HTML = `<div id="tdBible1" class="bible_read">
              <div style='text-align:right'><a href="#none" id="voice1" onclick="window.open('listen.php?voiceAnchor=/data/GAE/$/k$*_GAE_gen_001.mp3&version=GAE&book=gen&chap=1&chap2=1&sex=m','listen','width=600, height=450,scrollbars = yes');return false;"><img src="/images/sub/bible/btn_listen.png" style="float:right;width:30px" /></a></div>              <b>개역개정</b><br/><font style='display:none;' size=2>창세기</font><font class="chapNum">제 1 장</font><br /><br /><font class="smallTitle">천지 창조</font><br /><br /><span style="color:#376BCB;"><span class="number">1&nbsp;&nbsp;&nbsp;</span>태초에 하나님이 천지를 창조하시니라 </font></span><br /><span><span class="number">2&nbsp;&nbsp;&nbsp;</span>땅이 <font size=2><a class=comment href="#" onClick="return clickPopUp('D_184038_1', event)" ><font size=2>1)</font></a></font>혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라

<div id='D_184038_1' class=D2  onclick="popDown2('D_184038_1')" style='display:none;z-index:100' >또는 형체가 없는 </div></font></span><br /><span><span class="number">3&nbsp;&nbsp;&nbsp;</span>하나님이 이르시되 빛이 있으라 하시니 빛이 있었고 </font></span><br /><span><span class="number">4&nbsp;&nbsp;&nbsp;</span>빛이 하나님이 보시기에 좋았더라 하나님이 빛과 어둠을 나누사</font></span><br />`;

// KNT gen/1 — 새한글성경 USX-style markup. The API wraps it in JSON:
// data.content is a JSON string {"found":true,"content":"<h2 ...>...</p>"}.
const KNT_GEN1_INNER = `<h2 data-number="1" data-sid="GEN 1" class="c">1</h2><p class="s">하나님이 온 누리를 지으시다</p><p class="p"><span class="verse-span" data-verse-id="GEN.1.1" data-verse-org-ids="GEN.1.1"><span data-number="1" data-sid="GEN 1:1" class="v">1</span></span><span data-caller="+" id="GEN.1.1!f.1" data-verse-id="GEN.1.1" class="f"><span class="fr">1:1 </span><span class="ft">또는 ‘태초에’</span></span><span class="verse-span" data-verse-id="GEN.1.1" data-verse-org-ids="GEN.1.1">처음에 하나님이 하늘과 땅을 창조하셨다. </span><span class="verse-span" data-verse-id="GEN.1.2" data-verse-org-ids="GEN.1.2"><span data-number="2" data-sid="GEN 1:2" class="v">2</span></span><span class="verse-span" data-verse-id="GEN.1.2" data-verse-org-ids="GEN.1.2">땅은 거칠고 비어 있었다. 어둠이 깊은 물 위에 깔려 있었다. 그리고 </span><span data-caller="+" id="GEN.1.2!f.1" data-verse-id="GEN.1.2" class="f"><span class="fr">1:2 </span><span class="ft">또는 ‘하나님의 바람’</span></span><span class="verse-span" data-verse-id="GEN.1.2" data-verse-org-ids="GEN.1.2">하나님의 영이 물 위에서 움직이고 있었다. </span><span class="verse-span" data-verse-id="GEN.1.3" data-verse-org-ids="GEN.1.3"><span data-number="3" data-sid="GEN 1:3" class="v">3</span></span><span class="verse-span" data-verse-id="GEN.1.3" data-verse-org-ids="GEN.1.3">하나님이 말씀하셨다. “빛이 생기기를!” 그러자 빛이 생겼다. </span></p>`;
const KNT_GEN1_JSON = JSON.stringify({ found: true, content: KNT_GEN1_INNER, reference: '창세기 1' });

// KNT psa/23 — poetic lines (q1) split one verse across paragraphs, plus a
// superscription (p.d) and subtitle (p.sp).
const KNT_PSA23_INNER = `<h2 data-number="23" data-sid="PSA 23" class="c">23</h2><p class="s">여호와를 의지하는 노래</p><p class="d"><span class="verse-span" data-verse-id="PSA.23.1" data-verse-org-ids="PSA.23.1"><span data-number="1" data-sid="PSA 23:1" class="v">1</span></span><span data-caller="+" id="PSA.23.1!f.1" data-verse-id="PSA.23.1" class="f"><span class="fr">23:1 </span><span class="ft">히브리어 성서를 따라 여기서부터 1절로 적음</span></span>노랫말(시). 다윗에게 속한 것.</p><p data-vid="PSA 23:1" class="sp">(혼잣말)</p><p data-vid="PSA 23:1" class="q1"><span class="verse-span" data-verse-id="PSA.23.1" data-verse-org-ids="PSA.23.1">여호와가 나의 목자,</span></p><p data-vid="PSA 23:1" class="q1"><span class="verse-span" data-verse-id="PSA.23.1" data-verse-org-ids="PSA.23.1">내게 모자람 없네.</span></p><p class="q1"><span class="verse-span" data-verse-id="PSA.23.2" data-verse-org-ids="PSA.23.2"><span data-number="2" data-sid="PSA 23:2" class="v">2</span></span><span class="verse-span" data-verse-id="PSA.23.2" data-verse-org-ids="PSA.23.2">푸른 풀밭에 나를 눕히시네.</span></p><p data-vid="PSA 23:2" class="q1"><span class="verse-span" data-verse-id="PSA.23.2" data-verse-org-ids="PSA.23.2">물가 푹 쉴 곳으로 나를 데려가시네.</span></p>`;
const KNT_PSA23_JSON = JSON.stringify({ found: true, content: KNT_PSA23_INNER, reference: '시편 23' });

// --- html content_type (대한성서공회 markup) --------------------------------

test('html: extracts verses with numbers and strips footnote markup', () => {
  const blocks = parseBibleContent(GAE_GEN1_HTML, 'html');
  const verses = blocks.filter((b) => b.type === 'verse');
  assert.equal(verses.length, 4);
  assert.deepEqual(verses.map((v) => v.num), [1, 2, 3, 4]);
  assert.equal(verses[0].text, '태초에 하나님이 천지를 창조하시니라');
  // footnote anchor "1)" and hidden popup div text must not leak in
  assert.equal(
    verses[1].text,
    '땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라',
  );
  assert.equal(verses[2].text, '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고');
  assert.equal(verses[3].text, '빛이 하나님이 보시기에 좋았더라 하나님이 빛과 어둠을 나누사');
});

test('html: emits the smallTitle section heading before its verse', () => {
  const blocks = parseBibleContent(GAE_GEN1_HTML, 'html');
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[0].text, '천지 창조');
  assert.equal(blocks[1].type, 'verse');
  assert.equal(blocks[1].num, 1);
});

test('html: decodes entities and collapses whitespace', () => {
  const html = `<div id="tdBible1"><span><span class="number">1&nbsp;&nbsp;&nbsp;</span>사랑&amp;진리&nbsp; &quot;말씀&quot; &#39;복음&#39;</span><br /></div>`;
  const verses = parseBibleContent(html, 'html').filter((b) => b.type === 'verse');
  assert.equal(verses.length, 1);
  assert.equal(verses[0].text, '사랑&진리 "말씀" \'복음\'');
});

test('html: keeps translator additions (font size=1) inside verse text', () => {
  const html = `<div id="tdBible1"><span><span class="number">16&nbsp;&nbsp;&nbsp;</span>하나님이 두 큰 광명체를 만드사 <font size='1'>만드시고</font> 별들을 주관하게 하시고</span><br /></div>`;
  const verses = parseBibleContent(html, 'html').filter((b) => b.type === 'verse');
  assert.equal(verses[0].text, '하나님이 두 큰 광명체를 만드사 만드시고 별들을 주관하게 하시고');
});

test('html: strips footnotes from every verse, not just the first', () => {
  // SAENEW-style: consecutive verses each carry a comment anchor + hidden div.
  // (regression: a stateful g-flag filter regex used to skip every other one)
  const html = `<div id="tdBible1"><span><span class="number">1&nbsp;&nbsp;&nbsp;</span><font size=2><a class=comment href="#" onClick="return clickPopUp('D_1_1', event)" ><font size=2>1)</font></a></font>첫째 본문 <div id='D_1_1' class=D2 style='display:none' >각주일</div></font></span><br /><span><span class="number">2&nbsp;&nbsp;&nbsp;</span><font size=2><a class=comment href="#" onClick="return clickPopUp('D_2_1', event)" ><font size=2>2)</font></a></font>둘째 본문 <div id='D_2_1' class=D2 style='display:none' >각주이</div></font></span><br /><span><span class="number">3&nbsp;&nbsp;&nbsp;</span>셋째 본문</span><br /></div>`;
  const verses = parseBibleContent(html, 'html').filter((b) => b.type === 'verse');
  assert.deepEqual(verses.map((v) => v.text), ['첫째 본문', '둘째 본문', '셋째 본문']);
});

test('html: malformed or empty content returns an empty list', () => {
  for (const bad of ['', '   ', '<html><body>no verses here</body></html>', 'not html at all', '<div id="tdBible1"></div>']) {
    assert.deepEqual(parseBibleContent(bad, 'html'), [], `expected [] for ${JSON.stringify(bad)}`);
  }
});

// --- json content_type (KNT 새한글성경) --------------------------------------

test('json: extracts verses from USX-style markup inside the JSON envelope', () => {
  const blocks = parseBibleContent(KNT_GEN1_JSON, 'json');
  const verses = blocks.filter((b) => b.type === 'verse');
  assert.deepEqual(verses.map((v) => v.num), [1, 2, 3]);
  assert.equal(verses[0].text, '처음에 하나님이 하늘과 땅을 창조하셨다.');
  // footnote spans (class="f") must be removed, verse text rejoined
  assert.equal(
    verses[1].text,
    '땅은 거칠고 비어 있었다. 어둠이 깊은 물 위에 깔려 있었다. 그리고 하나님의 영이 물 위에서 움직이고 있었다.',
  );
  assert.equal(verses[2].text, '하나님이 말씀하셨다. “빛이 생기기를!” 그러자 빛이 생겼다.');
});

test('json: emits the section heading (p.s) before verse 1', () => {
  const blocks = parseBibleContent(KNT_GEN1_JSON, 'json');
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[0].text, '하나님이 온 누리를 지으시다');
});

test('json: merges poetic q1 lines into one verse and keeps superscription as note', () => {
  const blocks = parseBibleContent(KNT_PSA23_JSON, 'json');
  const verses = blocks.filter((b) => b.type === 'verse');
  assert.deepEqual(verses.map((v) => v.num), [1, 2]);
  assert.equal(verses[0].text, '여호와가 나의 목자,\n내게 모자람 없네.');
  assert.equal(verses[1].text, '푸른 풀밭에 나를 눕히시네.\n물가 푹 쉴 곳으로 나를 데려가시네.');
  const notes = blocks.filter((b) => b.type === 'note');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, '노랫말(시). 다윗에게 속한 것.');
  const headings = blocks.filter((b) => b.type === 'heading');
  assert.deepEqual(headings.map((h) => h.text), ['여호와를 의지하는 노래', '(혼잣말)']);
});

test('json: malformed payloads return an empty list', () => {
  for (const bad of [
    '',
    'not json',
    '{}',
    '{"found":false}',
    '{"found":true}',
    '{"found":true,"content":123}',
    '{"found":true,"content":"<p class=\\"p\\">no verses</p>"}',
  ]) {
    assert.deepEqual(parseBibleContent(bad, 'json'), [], `expected [] for ${JSON.stringify(bad)}`);
  }
});

// --- normalizeVersionList ----------------------------------------------------

test('normalizeVersionList keeps valid code/name pairs and dedupes', () => {
  const apiShape = {
    versions: [
      { code: 'ASV', name: 'ASV' },
      { code: 'COG', name: '공동번역' },
      { code: 'GAE', name: '개역개정' },
      { code: 'GAE', name: '개역개정' },
      { code: 'KNT', name: '새한글' },
      { code: '', name: '빈코드' },
      { name: '코드없음' },
      { code: 42, name: '숫자코드' },
      'garbage',
      null,
    ],
  };
  assert.deepEqual(normalizeVersionList(apiShape), [
    { code: 'ASV', name: 'ASV' },
    { code: 'COG', name: '공동번역' },
    { code: 'GAE', name: '개역개정' },
    { code: 'KNT', name: '새한글' },
  ]);
});

test('normalizeVersionList accepts a bare array and rejects junk', () => {
  assert.deepEqual(normalizeVersionList([{ code: 'GAE', name: '개역개정' }]), [
    { code: 'GAE', name: '개역개정' },
  ]);
  for (const bad of [null, undefined, 42, 'x', {}, { versions: 'nope' }, { versions: null }]) {
    assert.deepEqual(normalizeVersionList(bad), []);
  }
});
