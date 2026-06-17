import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const achievementsSource = await readFile(
  new URL('../app/components/profile/ProfileAchievements.vue', import.meta.url),
  'utf8',
);

const assertContract = (source, pattern, message) => {
  assert.match(source, pattern, message);
};

test('profile achievements are grouped into expected achievement sections', () => {
  assertContract(
    achievementsSource,
    /groupedAchievements|achievementGroups|achievementsBy(?:Category|Section|Group)/,
    'achievements should be grouped before rendering rather than shown as one undifferentiated grid',
  );
  for (const sectionLabel of ['통독', '연속', '하세나']) {
    assertContract(
      achievementsSource,
      new RegExp(sectionLabel),
      `achievement section label "${sectionLabel}" should be present in the component contract`,
    );
  }
  assertContract(
    achievementsSource,
    /v-for="[^"]*(group|section|category)[^"]*in[^"]*(groupedAchievements|achievementGroups|achievementsBy)/,
    'template should render achievement groups/sections explicitly',
  );
});

test('locked achievement cards show target and next-step cues', () => {
  assertContract(
    achievementsSource,
    /(milestone_value|target|goal|required)[\s\S]{0,220}(다음|목표|까지|필요|남음|잠금 해제)/,
    'locked achievements should expose the milestone target and what to do next',
  );
  assertContract(
    achievementsSource,
    /v-else[\s\S]{0,240}(milestone_value|target|goal|required)/,
    'locked-state branch should render target/progress cue, not only a lock icon',
  );
});

test('achievement locked state is accessible to assistive technology', () => {
  assertContract(
    achievementsSource,
    /aria-label=["'][^"']*(잠김|잠금|locked)[^"']*["']|:aria-label="[^"]*(locked|잠김|잠금)/,
    'locked/unlocked achievement cards should announce their state',
  );
  assertContract(
    achievementsSource,
    /(aria-disabled|aria-describedby|role="(?:list|listitem|group)")/,
    'achievement cards should expose semantic state or relationships beyond visual dimming',
  );
});
