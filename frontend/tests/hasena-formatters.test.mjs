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

test('splits long single Hasena block by title verse range when source lost markers', () => {
  const result = parseHasenaContent(`
    <p class="bible_tit">사무엘상 25:32-44</p>
    <div class="bible_contents">
      <span class="bullet_number">32 </span>
      <span class="bullet_txt">다윗이 아비가일에게 말하였다. “주 이스라엘의 하나님이 오늘 그대를 보내어 이렇게 만나게 하여 주셨으니, 주님께 찬양을 드리오.” 그리고 다윗은 그 여인이 자기에게 가져온 것들을 받고서, 이렇게 말하였다. “평안히 집으로 돌아가시오.” 아비가일이 나발에게 돌아와 보니, 그는 자기 집에서 왕이나 차릴 만한 술잔치를 베풀고 있었다. 그래서 아비가일은 다음날 아침이 밝을 때까지 나발에게 아무 말도 하지 않았다. 아침이 되어 나발이 술에서 깨었을 때에, 그의 아내는 그 동안에 있었던 일을 모두 그에게 말하였다. 그러자 그는 갑자기 심장이 멎고, 몸이 돌처럼 굳어졌다. 열흘쯤 지났을 때에, 주님께서 나발을 치시니, 그가 죽었다. 나발이 죽었다는 소문을 듣고, 다윗이 말하였다. “주님을 찬양하여라!” 다윗은 아비가일을 자기의 아내로 삼으려고, 그 여인에게 사람을 보내어 그 뜻을 전하였다. 다윗의 종들이 갈멜로 아비가일을 찾아가서 그 뜻을 전하였다. “다윗 어른께서 댁을 모셔다가 아내로 삼으려고 우리를 보내셨습니다.” 아비가일이 일어나, 얼굴이 땅에 닿도록 절을 한 다음에 말하였다. “이 몸은 기꺼이 그분의 종이 되겠습니다.” 아비가일이 일어나서, 서둘러 나귀를 타고 길을 떠나니, 그 뒤로 그 여인의 몸종 다섯이 따라나섰다. 아비가일은 이렇게 다윗의 시종들을 따라가서, 그의 아내가 되었다. 다윗은 이미 이스르엘 여인 아히노암을 아내로 맞이하였기 때문에, 이제는 두 사람이 다 그의 아내가 되었다. 본래 다윗의 아내는 사울의 딸 미갈이었으나, 사울이 이미 다윗의 아내를 갈림 사람 라이스의 아들 발디에게 주었다.</span>
    </div>
  `);

  assert.equal(result.verses.length, 13);
  assert.deepEqual(result.verses.map((verse) => verse.number), ['32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44']);
  assert.match(result.verses.at(-1).text, /미갈/);
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
