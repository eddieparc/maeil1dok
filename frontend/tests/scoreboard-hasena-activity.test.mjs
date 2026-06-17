import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scoreboardSource = await readFile(
  new URL('../app/pages/scoreboard.vue', import.meta.url),
  'utf8',
);
const leaderboardItemSource = await readFile(
  new URL('../app/components/leaderboard/LeaderboardItem.vue', import.meta.url),
  'utf8',
);
const scoreboardStoreSource = await readFile(
  new URL('../app/stores/scoreboard.ts', import.meta.url),
  'utf8',
);

test('scoreboard models Hasena activity fields from the API contract', () => {
  assert.match(scoreboardStoreSource, /hasena_completed_days: number/);
  assert.match(scoreboardStoreSource, /activity_score: number/);
  assert.match(scoreboardStoreSource, /current_hasena_streak: number/);
});

test('leaderboard row shows activity score with Bible and Hasena breakdown', () => {
  assert.match(leaderboardItemSource, /{{ activityScore }}/);
  assert.match(leaderboardItemSource, /통독 {{ bibleCompletedDays }} · 하세나 {{ hasenaCompletedDays }}/);
});

test('scoreboard page labels combined rank value as activity instead of raw completed days', () => {
  assert.match(scoreboardSource, />활동 점수</);
  assert.match(scoreboardSource, /:activity-score="entry\.activity_score"/);
  assert.match(scoreboardSource, /하세나 {{ entry\.hasena_completed_days }}/);
});
