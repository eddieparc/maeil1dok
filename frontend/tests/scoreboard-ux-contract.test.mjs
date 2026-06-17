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

const assertContract = (source, pattern, message) => {
  assert.match(source, pattern, message);
};

test('scoreboard gives an explicit activity-score explanation, not only a number', () => {
  assertContract(
    scoreboardSource,
    /activity-score-(?:explanation|help|description)|aria-describedby="activity-score/i,
    'activity score needs a stable help/description hook for the UX copy',
  );
  assertContract(
    scoreboardSource,
    /(통독|성경)[\s\S]{0,120}(하세나)[\s\S]{0,120}(합산|더해|포함|활동 점수)/,
    'activity score explanation should say Bible reading and Hasena activity are combined',
  );
});

test('scoreboard treats friends and following views as auth-aware states', () => {
  assertContract(
    scoreboardStoreSource,
    /type FollowType = 'mutual' \| 'following'/,
    'store should keep separate friends and following leaderboard modes',
  );
  assertContract(
    scoreboardSource,
    /(친구|팔로잉)[\s\S]{0,240}(로그인|auth\.isAuthenticated)|auth\.isAuthenticated[\s\S]{0,240}(친구|팔로잉)[\s\S]{0,240}(로그인)/,
    'friends/following filters should render a logged-out login prompt or gated state',
  );
  assertContract(
    scoreboardSource,
    /(friendsLeaderboard|followingLeaderboard)[\s\S]{0,240}(EmptyState|empty-state|빈|아직|없습니다)/,
    'authenticated friends/following views should have their own empty-state UX',
  );
});

test('leaderboard rows expose a mobile card contract instead of relying only on hidden table columns', () => {
  assertContract(
    leaderboardItemSource,
    /leaderboard-(?:mobile-)?card|data-ux="leaderboard-mobile-card"|data-testid="leaderboard-mobile-card"/,
    'leaderboard item should include a stable mobile-card marker/class',
  );
  assertContract(
    leaderboardItemSource,
    /@media[\s\S]{0,160}max-width[\s\S]{0,320}(display:\s*(?:grid|block|flex)|grid-template|card)/,
    'mobile layout should switch row content into a scannable card-like layout',
  );
});

test('leaderboard rank and score have accessible labels', () => {
  assertContract(
    leaderboardItemSource,
    /aria-label=["'][^"']*(순위|rank)[^"']*["']|:aria-label="[^"]*(rank|순위)/,
    'rank value should be announced with an accessible label',
  );
  assertContract(
    leaderboardItemSource,
    /aria-label=["'][^"']*(활동|점수|score)[^"']*["']|:aria-label="[^"]*(activity|score|활동|점수)/,
    'activity score and breakdown should be announced with an accessible label',
  );
});

test('scoreboard defaults to calendar-month ranking with explicit month controls', () => {
  assertContract(
    scoreboardStoreSource,
    /currentPeriod:\s*'month'/,
    'monthly ranking should be the default leaderboard period',
  );
  assertContract(
    scoreboardStoreSource,
    /selectedMonth|rankingMonth|monthKey/,
    'store should keep an explicit selected month, not only a rolling period',
  );
  assertContract(
    scoreboardSource,
    /(type="month"|월별 랭킹|rankingMonth|selectedMonth|changeMonth)/,
    'scoreboard UI should expose a calendar-month ranking control',
  );
  assertContract(
    scoreboardStoreSource,
    /params[\s\S]{0,220}(month|ranking_month)/,
    'scoreboard API calls should send the selected month to the backend',
  );
});
