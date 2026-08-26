import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';

const [scoreboardSource, leaderboardItemSource] = await Promise.all([
  readFile(new URL('../app/pages/scoreboard.vue', import.meta.url), 'utf8'),
  readFile(new URL('../app/components/leaderboard/LeaderboardItem.vue', import.meta.url), 'utf8'),
]);

const compileSfcTemplate = (source, filename) => {
  const { descriptor } = parse(source, { filename });
  assert.ok(descriptor.template, `${filename} should have a template`);
  const compiled = compileTemplate({
    id: `test-${filename}`,
    source: descriptor.template.content,
    filename,
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const iconStub = defineComponent({
  setup: () => () => h('span', { 'aria-hidden': 'true' }),
});
const linkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots }) {
    return () => h('a', { href: typeof props.to === 'string' ? props.to : '#' }, slots.default?.());
  },
});
const imageStub = defineComponent({
  name: 'NuxtImg',
  props: { src: String, alt: String },
  setup(props) {
    return () => h('img', { src: props.src, alt: props.alt });
  },
});

const entry = {
  rank: 2,
  user: { id: 9, nickname: '평안', profile_image: '', is_me: false, role: '' },
  completed_days: 14,
  bible_completed_days: 14,
  hasena_completed_days: 6,
  activity_score: 20,
  progress_rate: 82,
  current_streak: 4,
  longest_streak: 11,
};

const LeaderboardItem = defineComponent({
  components: { NuxtImg: imageStub, NuxtLink: linkStub, UserIcon: iconStub },
  props: {
    rank: { type: Number, required: true },
    user: { type: Object, required: true },
    completedDays: { type: Number, default: 0 },
    bibleCompletedDays: { type: Number, default: 0 },
    hasenaCompletedDays: { type: Number, default: 0 },
    activityScore: { type: Number, default: 0 },
    progressRate: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    isHighlighted: { type: Boolean, default: false },
  },
  setup() {
    return { handleImageError: () => {}, imageError: false, rankClass: ['rank-number'] };
  },
  render: compileSfcTemplate(leaderboardItemSource, 'LeaderboardItem.vue'),
});

const renderLeaderboardItem = () => renderToString(createSSRApp({
  render: () => h(LeaderboardItem, {
    rank: entry.rank,
    user: entry.user,
    completedDays: entry.completed_days,
    bibleCompletedDays: entry.bible_completed_days,
    hasenaCompletedDays: entry.hasena_completed_days,
    activityScore: entry.activity_score,
    progressRate: entry.progress_rate,
    currentStreak: entry.current_streak,
    longestStreak: entry.longest_streak,
  }),
}));

const renderScoreboard = async ({
  activeView = 'global',
  authenticated = false,
  leaderboard = [],
} = {}) => {
  const passthrough = defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  });
  const EmptyState = defineComponent({
    props: { title: String, description: String },
    setup(props) {
      return () => h('section', { class: 'empty-state' }, [
        h('h3', props.title),
        h('p', props.description),
      ]);
    },
  });
  const FilterButtonGroup = defineComponent({
    props: { label: String, options: Array, modelValue: [String, Number] },
    setup(props) {
      return () => h('fieldset', { 'aria-label': props.label },
        props.options?.map(option => h('button', { type: 'button' }, option.label)));
    },
  });
  const emptyStub = defineComponent({ setup: () => () => null });
  const isRelationshipView = activeView === 'friends' || activeView === 'following';
  const showAuthGate = isRelationshipView && !authenticated;
  const showRelationshipEmptyState = isRelationshipView && authenticated && leaderboard.length === 0;
  const relationshipEmptyState = activeView === 'following'
    ? {
        title: '팔로잉 활동이 아직 없습니다',
        description: '팔로잉한 사용자의 통독과 하세나 활동이 생기면 이곳에 함께 표시됩니다.',
      }
    : {
        title: '친구 리더보드가 아직 비어 있습니다',
        description: '서로 팔로우한 친구의 통독과 하세나 활동이 생기면 이곳에서 비교할 수 있습니다.',
      };

  const component = defineComponent({
    components: {
      PageLayout: passthrough,
      FilterButtonGroup,
      EmptyState,
      LeaderboardItem,
      SkeletonCard: emptyStub,
      SkeletonLeaderboardRow: emptyStub,
      NuxtImg: imageStub,
      UserIcon: iconStub,
    },
    setup() {
      return {
        activeView,
        auth: { isAuthenticated: { value: authenticated } },
        avatarErrors: {},
        changeMonth: () => {},
        changePeriod: () => {},
        currentLeaderboard: leaderboard,
        currentPeriod: 'month',
        handleAvatarError: () => {},
        isLoading: false,
        myRanking: null,
        periods: [
          { value: 'month', label: '이번 달' },
          { value: 'week', label: '이번 주' },
          { value: 'all', label: '전체' },
        ],
        rankingMonth: '2026-08',
        relationshipEmptyState,
        scoreboardContextLabel: '2026년 8월',
        scoreboardStore: { currentPeriod: 'month' },
        showAuthGate,
        showRelationshipEmptyState,
        topThree: [],
        viewModes: [
          { value: 'global', label: '전체' },
          { value: 'friends', label: '친구' },
          { value: 'following', label: '팔로잉' },
        ],
      };
    },
    render: compileSfcTemplate(scoreboardSource, 'scoreboard.vue'),
  });

  return renderToString(createSSRApp(component));
};

test('scoreboard gives an explicit activity-score explanation, not only a number', async () => {
  const html = await renderScoreboard({ leaderboard: [entry] });

  assert.match(html, /id="activity-score-explanation"/);
  assert.match(html, /통독 완료와 하세나 완료를 합산한 활동 점수/);
  assert.match(html, /aria-describedby="activity-score-explanation"/);
});

test('scoreboard treats friends and following views as auth-aware states', async () => {
  const loggedOut = await renderScoreboard({ activeView: 'friends', authenticated: false });
  const friendsEmpty = await renderScoreboard({ activeView: 'friends', authenticated: true });
  const followingEmpty = await renderScoreboard({ activeView: 'following', authenticated: true });

  assert.match(loggedOut, /로그인이 필요합니다/);
  assert.match(loggedOut, /로그인 후 확인할 수 있습니다/);
  assert.match(friendsEmpty, /친구 리더보드가 아직 비어 있습니다/);
  assert.match(followingEmpty, /팔로잉 활동이 아직 없습니다/);
});

test('leaderboard rows expose a mobile card contract instead of relying only on hidden table columns', async () => {
  const html = await renderLeaderboardItem();

  assert.match(html, /data-testid="leaderboard-mobile-card"/);

  // Mobile geometry moved to Playwright: tests/e2e/browser-behavior.spec.ts.
});

test('leaderboard rank and score have accessible labels', async () => {
  const html = await renderLeaderboardItem();

  assert.match(html, /aria-label="2위 순위"/);
  assert.match(html, /aria-label="활동 점수 20점, 통독 14일, 하세나 6일"/);
});

test('scoreboard defaults to calendar-month ranking with explicit month controls', async () => {
  const html = await renderScoreboard();

  assert.match(html, />월별 랭킹</);
  assert.match(html, /<input[^>]*type="month"[^>]*aria-label="랭킹 월 선택"[^>]*value="2026-08"/);
  assert.match(html, /2026년 8월 통독 완료와 하세나 완료/);
});
