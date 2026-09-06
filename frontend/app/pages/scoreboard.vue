<template>
  <PageLayout title="리더보드">
    <div class="content-wrapper stagger">
      <SkeletonCard v-if="showInitialSkeleton && auth.isAuthenticated.value" class="fade-in" />
      <section v-else-if="myRanking" class="my-rank-card fade-in" aria-label="내 순위">
        <div class="ranking-info">
          <p class="ranking-label">내 순위 · {{ periods.find(period => period.value === currentPeriod)?.label }}</p>
          <div class="ranking-main">
            <span class="ranking-value">{{ myRanking.rank ?? '-' }}</span>
            <span class="ranking-unit">위</span>
          </div>
          <p v-if="myRanking.rank !== null" class="ranking-sub">상위 {{ myRanking.percentile }}%</p>
          <p v-else class="ranking-sub">아직 집계된 활동이 없어요</p>
        </div>
        <div class="ranking-stats">
          <div class="stat-item">
            <p class="stat-label">활동 점수</p>
            <p class="stat-value" :aria-label="`통독 ${myRanking.bible_completed_days}일, 하세나 ${myRanking.hasena_completed_days}일`">{{ myRanking.activity_score }}</p>
          </div>
          <div class="stat-item">
            <p class="stat-label">연속</p>
            <p class="stat-value">{{ myRanking.current_streak }}<span class="stat-unit">일</span></p>
          </div>
        </div>
      </section>

      <div class="filter-section fade-in">
        <div class="period-chips" role="group" aria-label="기간">
          <FilterChip
            v-for="period in periods"
            :key="period.value"
            :label="period.label"
            :active="currentPeriod === period.value"
            @click="changePeriod(period.value)"
          />
        </div>
        <SegmentedControl v-model="activeView" :options="viewModes" aria-label="보기" />
        <label v-if="currentPeriod === 'month'" class="month-filter">
          <span>월별 랭킹</span>
          <input v-model="rankingMonth" type="month" class="month-input" aria-label="랭킹 월 선택" @change="changeMonth">
        </label>
      </div>

      <div class="leaderboard-card fade-in">
        <div v-if="showInitialSkeleton" class="loading-rows" role="status" aria-label="리더보드 불러오는 중">
          <SkeletonLeaderboardRow v-for="i in 8" :key="i" />
        </div>
        <div v-else-if="showAuthGate" class="leaderboard-empty-panel">
          <EmptyState title="로그인이 필요합니다" description="친구와 팔로잉 리더보드는 로그인 후 확인할 수 있습니다." />
        </div>
        <div v-else-if="showRelationshipEmptyState" class="leaderboard-empty-panel">
          <EmptyState :title="relationshipEmptyState.title" :description="relationshipEmptyState.description" />
        </div>
        <table v-else-if="currentLeaderboard.length > 0" class="leaderboard-table" aria-describedby="activity-score-explanation">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">사용자</th>
              <th scope="col" class="numeric-heading">활동 점수</th>
              <th scope="col" class="numeric-heading">진도</th>
            </tr>
          </thead>
          <tbody>
            <LeaderboardItem
              v-for="entry in currentLeaderboard"
              :key="entry.user.id"
              :class="{ 'is-me': entry.user.is_me }"
              :rank="entry.rank"
              :user="entry.user"
              :completed-days="entry.completed_days"
              :bible-completed-days="entry.bible_completed_days"
              :hasena-completed-days="entry.hasena_completed_days"
              :activity-score="entry.activity_score"
              :progress-rate="entry.progress_rate"
              :current-streak="entry.current_streak"
              :longest-streak="entry.longest_streak"
              :is-highlighted="entry.user.is_me"
            />
          </tbody>
        </table>
        <EmptyState v-else title="리더보드 데이터가 없습니다" description="아직 이 기간에 집계된 통독 또는 하세나 활동이 없습니다." />
      </div>

      <section id="activity-score-explanation" class="score-explainer fade-in">
        <p>활동 점수 = 통독 완료 + 하세나 완료. 동점은 진도율, 하세나 최장 연속, 닉네임 순.</p>
        <p class="sr-only">{{ scoreboardContextLabel }} 통독 완료와 하세나 완료를 합산한 활동 점수입니다.</p>
      </section>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { useScoreboardStore } from '~/stores/scoreboard'
import { useAuthService } from '~/composables/useAuthService'
import PageLayout from '~/components/common/PageLayout.vue'
import FilterChip from '~/components/ui/FilterChip.vue'
import SegmentedControl from '~/components/ui/SegmentedControl.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import LeaderboardItem from '~/components/leaderboard/LeaderboardItem.vue'
import SkeletonCard from '~/components/ui/skeleton/SkeletonCard.vue'
import SkeletonLeaderboardRow from '~/components/ui/skeleton/SkeletonLeaderboardRow.vue'

const scoreboardStore = useScoreboardStore()
const auth = useAuthService()

useHead({
  title: '리더보드 · 매일일독',
  meta: [
    { property: 'og:title', content: '리더보드 · 매일일독' },
    { property: 'og:description', content: '함께 통독하는 이들의 꾸준함을 확인해 보세요.' },
    { name: 'description', content: '매일일독 리더보드 — 완료 일수와 연속 기록으로 함께 통독을 이어갑니다.' },
  ],
})

const activeView = ref<string | number>('global')
const currentPeriod = computed(() => scoreboardStore.currentPeriod)
const rankingMonth = ref(scoreboardStore.selectedMonth)
const isLoading = computed(() => scoreboardStore.isLoading)
const isInitialPending = ref(true)
const showInitialSkeleton = computed(() =>
  (isInitialPending.value || isLoading.value) && currentLeaderboard.value.length === 0
)
const myRanking = computed(() => scoreboardStore.myRanking)

const currentLeaderboard = computed(() => {
  if (activeView.value === 'global') {
    return scoreboardStore.globalLeaderboard
  } else if (activeView.value === 'following') {
    return scoreboardStore.followingLeaderboard
  } else {
    return scoreboardStore.friendsLeaderboard
  }
})

const showAuthGate = computed(() => {
  return activeView.value !== 'global' && !auth.isAuthenticated.value
})

const showRelationshipEmptyState = computed(() => {
  if (!auth.isAuthenticated.value) return false
  if (activeView.value === 'friends') return scoreboardStore.friendsLeaderboard.length === 0
  if (activeView.value === 'following') return scoreboardStore.followingLeaderboard.length === 0
  return false
})

const relationshipEmptyState = computed(() => {
  if (activeView.value === 'following') {
    return {
      title: '팔로잉 활동이 아직 없습니다',
      description: '팔로잉한 사용자의 통독과 하세나 활동이 생기면 이곳에 함께 표시됩니다.'
    }
  }
  return {
    title: '친구 리더보드가 아직 비어 있습니다',
    description: '서로 팔로우한 친구의 통독과 하세나 활동이 생기면 이곳에서 비교할 수 있습니다.'
  }
})

const periods: Array<{ value: 'week' | 'month' | 'all'; label: string }> = [
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
  { value: 'all', label: '전체' }
]

// 기존 팔로잉 API 계약을 유지한다. 그룹으로 표기하면 다른 관계의 순위를 보여주게 된다.
const viewModes = [
  { value: 'global', label: '전체' },
  { value: 'friends', label: '친구' },
  { value: 'following', label: '팔로잉' }
]

const scoreboardContextLabel = computed(() => {
  if (currentPeriod.value !== 'month') return '선택한 기간의'
  const [year, month] = rankingMonth.value.split('-')
  return `${year}년 ${Number(month)}월`
})

onMounted(async () => {
  await loadLeaderboard()
  isInitialPending.value = false
  if (auth.isAuthenticated.value) {
    void scoreboardStore.fetchMyRanking()
  }
})

const loadLeaderboard = async () => {
  if (activeView.value === 'global') {
    await scoreboardStore.fetchGlobalLeaderboard(currentPeriod.value, undefined, 100, rankingMonth.value)
  } else if (activeView.value === 'following' && auth.isAuthenticated.value) {
    await scoreboardStore.fetchFriendsLeaderboard(currentPeriod.value, undefined, 'following', rankingMonth.value)
  } else if (activeView.value === 'friends' && auth.isAuthenticated.value) {
    await scoreboardStore.fetchFriendsLeaderboard(currentPeriod.value, undefined, 'mutual', rankingMonth.value)
  }
}

const changePeriod = (period: 'all' | 'week' | 'month') => {
  scoreboardStore.setPeriod(period)
  loadLeaderboard()
  if (auth.isAuthenticated.value) {
    scoreboardStore.fetchMyRanking(period, undefined, rankingMonth.value)
  }
}

const changeMonth = () => {
  scoreboardStore.setSelectedMonth(rankingMonth.value)
  loadLeaderboard()
  if (auth.isAuthenticated.value) {
    scoreboardStore.fetchMyRanking('month', undefined, rankingMonth.value)
  }
}

watch(activeView, () => {
  loadLeaderboard()
})

onUnmounted(() => {
  scoreboardStore.clearScoreboardData()
})
</script>

<style scoped>
.content-wrapper {
  width: 100%;
  max-width: 768px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  letter-spacing: var(--tracking-body);
}
.my-rank-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px;
  border-radius: var(--radius-card);
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-card);
}
.ranking-label, .stat-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.7;
}
.ranking-main { display: flex; align-items: baseline; gap: 4px; }
.ranking-value { font-size: 40px; font-weight: 700; line-height: 1; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.ranking-unit { font-size: 15px; font-weight: 600; }
.ranking-sub { margin: 8px 0 0; font-size: 12px; opacity: 0.7; }
.ranking-stats { display: grid; gap: 12px; text-align: right; }
.stat-label { margin-bottom: 2px; }
.stat-value { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.stat-unit { margin-left: 2px; font-size: 13px; font-weight: 600; }
.filter-section { display: grid; gap: 10px; }
.period-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.month-filter { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); }
.month-input { min-height: 44px; min-width: 0; padding: 0 16px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; }
.month-input:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.leaderboard-card { overflow: hidden; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.loading-rows { display: grid; gap: 8px; padding: 20px; }
.leaderboard-empty-panel { padding: 20px; }
.leaderboard-table, .leaderboard-table thead, .leaderboard-table tbody { display: block; width: 100%; }
.leaderboard-table { border-collapse: collapse; }
.leaderboard-table thead tr { display: grid; grid-template-columns: 36px minmax(0, 1fr) 56px 56px; padding: 14px 20px; }
.leaderboard-table th { padding: 0; text-align: left; font-size: 11px; font-weight: 600; line-height: 1; color: var(--color-text-tertiary); }
.leaderboard-table .numeric-heading { text-align: right; }
.is-me { background: var(--color-accent-bg); }
.score-explainer { font-size: 11px; line-height: 1.5; color: var(--color-text-tertiary); }
.score-explainer p { margin: 0; }
@media (min-width: 640px) {
  .filter-section { grid-template-columns: 1fr 1fr; align-items: center; }
  .month-filter { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in { animation: none; opacity: 1; transform: none; }
}
</style>
