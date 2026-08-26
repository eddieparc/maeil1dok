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

const leaderboardEntry = {
  rank: 4,
  user: {
    id: 17,
    nickname: '은혜',
    profile_image: '',
    is_me: false,
    role: '',
  },
  completed_days: 12,
  bible_completed_days: 12,
  hasena_completed_days: 7,
  activity_score: 19,
  progress_rate: 80,
  current_streak: 3,
  longest_streak: 9,
};

const LeaderboardItem = defineComponent({
  components: {
    NuxtImg: imageStub,
    NuxtLink: linkStub,
    UserIcon: iconStub,
  },
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
    return {
      handleImageError: () => {},
      imageError: false,
      rankClass: ['rank-number'],
    };
  },
  render: compileSfcTemplate(leaderboardItemSource, 'LeaderboardItem.vue'),
});

const renderLeaderboardItem = () => renderToString(createSSRApp({
  render: () => h(LeaderboardItem, {
    rank: leaderboardEntry.rank,
    user: leaderboardEntry.user,
    completedDays: leaderboardEntry.completed_days,
    bibleCompletedDays: leaderboardEntry.bible_completed_days,
    hasenaCompletedDays: leaderboardEntry.hasena_completed_days,
    activityScore: leaderboardEntry.activity_score,
    progressRate: leaderboardEntry.progress_rate,
    currentStreak: leaderboardEntry.current_streak,
    longestStreak: leaderboardEntry.longest_streak,
  }),
}));

const renderScoreboardPage = async () => {
  const passthrough = defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  });
  const emptyStateStub = defineComponent({
    props: { title: String, description: String },
    setup(props) {
      return () => h('section', [h('h3', props.title), h('p', props.description)]);
    },
  });
  const filterStub = defineComponent({
    props: { label: String, options: Array, modelValue: [String, Number] },
    setup(props) {
      return () => h('fieldset', { 'aria-label': props.label },
        props.options?.map(option => h('button', option.label)));
    },
  });
  const emptyStub = defineComponent({ setup: () => () => null });
  const component = defineComponent({
    components: {
      PageLayout: passthrough,
      FilterButtonGroup: filterStub,
      EmptyState: emptyStateStub,
      LeaderboardItem,
      SkeletonCard: emptyStub,
      SkeletonLeaderboardRow: emptyStub,
      NuxtImg: imageStub,
      UserIcon: iconStub,
    },
    setup() {
      return {
        activeView: 'global',
        auth: { isAuthenticated: { value: true } },
        avatarErrors: {},
        changeMonth: () => {},
        changePeriod: () => {},
        currentLeaderboard: [leaderboardEntry],
        currentPeriod: 'month',
        handleAvatarError: () => {},
        isLoading: false,
        myRanking: null,
        periods: [
          { value: 'month', label: '이번 달' },
          { value: 'week', label: '이번 주' },
        ],
        rankingMonth: '2026-08',
        relationshipEmptyState: { title: '', description: '' },
        scoreboardContextLabel: '2026년 8월',
        scoreboardStore: { currentPeriod: 'month' },
        showAuthGate: false,
        showRelationshipEmptyState: false,
        topThree: [],
        viewModes: [{ value: 'global', label: '전체' }],
      };
    },
    render: compileSfcTemplate(scoreboardSource, 'scoreboard.vue'),
  });

  return renderToString(createSSRApp(component));
};

test('scoreboard renders API activity values in the leaderboard row', async () => {
  const html = await renderLeaderboardItem();

  assert.match(html, />19</);
  assert.match(html, /aria-label="활동 점수 19점, 통독 12일, 하세나 7일"/);
});

test('leaderboard row shows activity score with Bible and Hasena breakdown', async () => {
  const html = await renderLeaderboardItem();

  assert.match(html, /통독 12 · 하세나 7/);
});

test('scoreboard page labels combined rank value as activity instead of raw completed days', async () => {
  const html = await renderScoreboardPage();

  assert.match(html, />활동 점수</);
  assert.match(html, /통독 12 · 하세나 7/);
});
