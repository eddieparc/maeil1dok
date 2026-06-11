import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatHasenaSummary,
  parseHasenaContent,
} from '../app/utils/hasenaFormatters.js';

test('parses legacy Hasena bullet markup into individual verses', () => {
  const result = parseHasenaContent(`
    <div class="bible_tit">사무엘하 3장 31-32절</div>
    <div class="bible_contents">
      <p><span class="bullet_number">31</span><span class="bullet_txt">다윗이 요압과 모든 백성에게 이르되</span></p>
      <p><span class="bullet_number">32</span><span class="bullet_txt">그들이 아브넬을 헤브론에 장사하고</span></p>
    </div>
  `);

  assert.equal(result.title, '사무엘하 3장 31-32절');
  assert.equal(result.verses.length, 2);
  assert.deepEqual(result.verses.map((verse) => verse.number), ['31', '32']);
  assert.match(result.html, /hasena-verse-number">31</);
  assert.match(result.html, /hasena-verse-text">그들이 아브넬을 헤브론에 장사하고</);
});

test('parses OCR-like body text when verse number and text share one block', () => {
  const result = parseHasenaContent(`
    <article class="bible_contents">
      <p>32 다윗이 아비가일에게 말하였다. “주 이스라엘의 하나님이 오늘 그대를 보내어 이렇게 만나게 하여 주셨으니,
      주님께 찬양을 드리오. 내가 오늘 사람을 죽이거나 나의 손으로 직접 원수를 갚지 않도록, 그대가 나를 지켜 주었으니,
      슬기롭게 권면하여 준 그대에게도 감사하오.”</p>
    </article>
  `);

  assert.equal(result.verses.length, 1);
  assert.equal(result.verses[0].number, '32');
  assert.match(result.verses[0].text, /나의 손으로 직접 원수를 갚지 않도록/);
  assert.match(result.html, /hasena-verse-number">32</);
});

test('parses multiple generic verse markers from one paragraph', () => {
  const result = parseHasenaContent(`
    <div class="bible_contents">
      <p>31 다윗이 요압에게 말하였다. 32 그들이 아브넬을 헤브론에 장사하였다. 33 왕이 아브넬을 위하여 애가를 지어 불렀다.</p>
    </div>
  `);

  assert.deepEqual(result.verses.map((verse) => verse.number), ['31', '32', '33']);
  assert.match(result.verses[1].text, /헤브론에 장사하였다/);
});

test('formats Hasena summaries with markdown headings and checklist items', () => {
  const html = formatHasenaSummary(`
    ## 오늘의 본문
    사무엘상 25장 32절. **분노를 멈추는 지혜**를 배웁니다.

    ## 교역자 해설
    다윗은 권면을 듣고 멈춥니다.

    ## 오늘의 하시조
    - [ ] 오늘 분노를 바로 행동으로 옮기지 않기
    - [ ] 권면을 들을 사람에게 먼저 연락하기
  `);

  assert.match(html, /summary-section bible-section/);
  assert.match(html, /<span class="highlight-text">분노를 멈추는 지혜<\/span>/);
  assert.match(html, /checklist-text">오늘 분노를 바로 행동으로 옮기지 않기/);
});
