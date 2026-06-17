<template>
  <PageLayout title="리더보드">
    <div class="content-wrapper">
      <!-- 내 순위 카드 -->
      <div v-if="myRanking" class="my-ranking-card fade-in delay-100">
        <div class="ranking-content">
          <div class="ranking-info">
            <p class="ranking-label">내 순위</p>
            <div class="ranking-main">
              <span class="ranking-value">{{ myRanking.rank }}</span>
              <span class="ranking-unit">위</span>
            </div>
            <p class="ranking-sub">상위 {{ myRanking.percentile }}%</p>
          </div>
          <div class="ranking-stats">
            <div class="stat-item">
              <p class="stat-label">활동 점수</p>
              <p class="stat-value">{{ myRanking.activity_score }}</p>
              <p class="stat-detail">통독 {{ myRanking.bible_completed_days }} · 하세나 {{ myRanking.hasena_completed_days }}</p>
            </div>
            <div class="stat-item">
              <p class="stat-label">현재 연속</p>
              <p class="stat-value">{{ myRanking.current_streak }}일</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 필터 섹션 -->
      <div class="filter-section fade-in delay-200">
        <FilterButtonGroup
          v-model="scoreboardStore.currentPeriod"
          :options="periods"
          label="기간"
          @update:model-value="changePeriod"
        />

        <label v-if="currentPeriod === 'month'" class="month-filter">
          <span>월별 랭킹</span>
          <input
            v-model="rankingMonth"
            type="month"
            class="month-input"
            aria-label="랭킹 월 선택"
            @change="changeMonth"
          >
        </label>

        <FilterButtonGroup
          v-model="activeView"
          :options="viewModes"
          label="보기"
        />
      </div>

      <section id="activity-score-explanation" class="score-explainer fade-in delay-200">
        <div>
          <p class="explainer-title">활동 점수</p>
          <p class="explainer-copy">{{ scoreboardContextLabel }} 통독 완료와 하세나 완료를 합산한 활동 점수입니다. 같은 점수라면 진행률, 하세나 최장 연속, 닉네임 순으로 정렬됩니다.</p>
        </div>
        <div class="explainer-metrics" aria-label="활동 점수 구성">
          <span>통독</span>
          <span>하세나</span>
          <span>진행률</span>
        </div>
      </section>

      <!-- 리더보드 카드 -->
      <div class="leaderboard-card fade-in delay-300">
        <!-- 로딩 상태 -->
        <LoadingState v-if="isLoading" message="리더보드를 불러오는 중..." />

        <!-- 데이터 있을 때 -->
        <div v-else-if="showAuthGate" class="leaderboard-empty-panel">
          <EmptyState
            title="로그인이 필요합니다"
            description="친구와 팔로잉 리더보드는 로그인 후 확인할 수 있습니다."
          />
        </div>

        <div v-else-if="showRelationshipEmptyState" class="leaderboard-empty-panel">
          <EmptyState
            :title="relationshipEmptyState.title"
            :description="relationshipEmptyState.description"
          />
        </div>

        <div v-else-if="currentLeaderboard.length > 0">
          <!-- Top 3 하이라이트 (전체 보기일 때만) -->
          <div v-if="activeView === 'global' && topThree.length > 0" class="top-three">
            <div
              v-for="(entry, index) in topThree"
              :key="entry.user.id"
              :class="['top-card', index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : 'rank-3']"
            >
              <div class="medal-icon">{{ index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉' }}</div>
              <div class="avatar-wrapper">
                <NuxtImg
                  v-if="entry.user.profile_image && !avatarErrors[entry.user.id]"
                  :src="entry.user.profile_image"
                  :alt="entry.user.nickname"
                  class="top-avatar"
                  loading="lazy"
                  @error="() => handleAvatarError(entry.user.id)"
                />
                <div v-else class="top-avatar-placeholder">
                  <UserIcon :size="24" />
                </div>
                <div class="rank-badge">{{ index + 1 }}</div>
              </div>
              <p class="top-name">{{ entry.user.nickname }}</p>
              <div class="top-stats">
                <span class="top-days">{{ entry.activity_score }}점</span>
                <span class="top-hasena">하세나 {{ entry.hasena_completed_days }}</span>
                <span class="top-rate">{{ entry.progress_rate }}%</span>
              </div>
            </div>
          </div>

          <!-- 테이블 -->
          <div class="table-wrapper">
            <table class="leaderboard-table" aria-describedby="activity-score-explanation">
              <thead>
                <tr>
                  <th class="th-rank">순위</th>
                  <th class="th-user">사용자</th>
                  <th class="text-center">활동</th>
                  <th class="text-center">진행률</th>
                  <th class="text-center mobile-hide">연속</th>
                  <th class="text-center mobile-hide">최장</th>
                </tr>
              </thead>
              <tbody>
                <LeaderboardItem
                  v-for="entry in currentLeaderboard"
                  :key="entry.user.id"
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
          </div>
        </div>

        <!-- 빈 상태 -->
        <EmptyState v-else title="리더보드 데이터가 없습니다" description="아직 이 기간에 집계된 통독 또는 하세나 활동이 없습니다." />
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { useScoreboardStore } from '~/stores/scoreboard'
import { useAuthService } from '~/composables/useAuthService'
import PageLayout from '~/components/common/PageLayout.vue'
import FilterButtonGroup from '~/components/common/FilterButtonGroup.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import LoadingState from '~/components/LoadingState.vue'
import LeaderboardItem from '~/components/leaderboard/LeaderboardItem.vue'
import { UserIcon } from '@lucide/vue'

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

const activeView = ref<'global' | 'friends' | 'following'>('global')
const currentPeriod = computed(() => scoreboardStore.currentPeriod)
const rankingMonth = ref(scoreboardStore.selectedMonth)
const isLoading = computed(() => scoreboardStore.isLoading)
const myRanking = computed(() => scoreboardStore.myRanking)
const topThree = computed(() => scoreboardStore.topThree)
const avatarErrors = ref<Record<number, boolean>>({})

const handleAvatarError = (userId: number) => {
  avatarErrors.value[userId] = true
}

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

const periods = [
  { value: 'month', label: '이번 달' },
  { value: 'week', label: '이번 주' },
  { value: 'all', label: '전체' }
]

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

// 초기 데이터 로드
onMounted(() => {
  loadLeaderboard()
  if (auth.isAuthenticated.value) {
    scoreboardStore.fetchMyRanking()
  }
})

// 리더보드 로드
const loadLeaderboard = () => {
  if (activeView.value === 'global') {
    scoreboardStore.fetchGlobalLeaderboard(currentPeriod.value, undefined, 100, rankingMonth.value)
  } else if (activeView.value === 'following' && auth.isAuthenticated.value) {
    scoreboardStore.fetchFriendsLeaderboard(currentPeriod.value, undefined, 'following', rankingMonth.value)
  } else if (activeView.value === 'friends' && auth.isAuthenticated.value) {
    scoreboardStore.fetchFriendsLeaderboard(currentPeriod.value, undefined, 'mutual', rankingMonth.value)
  }
}

// 기간 변경
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

// 보기 모드 변경 감시
watch(activeView, () => {
  loadLeaderboard()
})

// 페이지 떠날 때 정리
onUnmounted(() => {
  scoreboardStore.clearScoreboardData()
})
</script>

<style scoped>
.content-wrapper {
  padding: 1rem;
  max-width: 768px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 내 순위 카드 */
.my-ranking-card {
  background: var(--color-accent-primary-light);
  border-radius: 16px;
  padding: 1.5rem;
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.ranking-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ranking-info {
  display: flex;
  flex-direction: column;
}

.ranking-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0 0 0.25rem 0;
  font-weight: 500;
}

.ranking-main {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.ranking-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  font-family: 'Pretendard', sans-serif;
}

.ranking-unit {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.ranking-sub {
  font-size: 0.875rem;
  color: var(--color-accent-primary);
  margin: 0.5rem 0 0 0;
  font-weight: 500;
}

.ranking-stats {
  display: flex;
  gap: 1.5rem;
  text-align: right;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-slate-400);
  margin: 0;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  font-family: 'Pretendard', sans-serif;
}

.stat-detail {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  white-space: nowrap;
}

/* 필터 섹션 */
.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
}

.month-filter {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

.month-input {
  min-height: 40px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-slate-200);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
}

.month-input:focus {
  border-color: var(--primary-color);
  outline: 2px solid var(--primary-light);
  outline-offset: 2px;
}

.score-explainer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--color-slate-200);
  border-radius: 12px;
  background: var(--color-bg-card);
}

.explainer-title {
  margin: 0 0 0.25rem 0;
  color: var(--color-slate-800);
  font-weight: 700;
}

.explainer-copy {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

.explainer-metrics {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.explainer-metrics span {
  padding: 0.375rem 0.625rem;
  border-radius: 999px;
  background: var(--color-slate-100);
  color: var(--color-slate-700);
  font-size: 0.75rem;
  font-weight: 700;
}

/* 리더보드 카드 */
.leaderboard-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-slate-200);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.leaderboard-empty-panel {
  padding: 1.5rem;
}

/* Top 3 섹션 */
.top-three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-slate-50);
  border-bottom: 1px solid var(--color-slate-200);
}

.top-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px solid var(--color-slate-200);
  position: relative;
  transition: transform 0.2s ease;
}

.top-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.rank-1 {
  order: 2;
  border-color: var(--color-warning-bg);
  background: linear-gradient(to bottom, var(--color-warning-bg), var(--color-bg-card));
  transform: scale(1.05);
  z-index: 1;
}

.rank-2 {
  order: 1;
  margin-top: 1rem;
}

.rank-3 {
  order: 3;
  margin-top: 1rem;
}

.medal-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 0.75rem;
}

.top-avatar {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-bg-card);
  box-shadow: var(--shadow-sm);
}

.top-avatar-placeholder {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  border: 2px solid var(--color-bg-card);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-slate-100);
  color: var(--color-accent-primary);
  font-size: 1.25rem;
}

.rank-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 1.25rem;
  height: 1.25rem;
  background: var(--color-slate-800);
  color: var(--color-bg-card);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.rank-1 .rank-badge { background: #F59E0B; }
.rank-2 .rank-badge { background: #94A3B8; }
.rank-3 .rank-badge { background: #B45309; }

.top-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0 0 0.5rem 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.top-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.top-days {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-slate-800);
  font-family: 'Pretendard', sans-serif;
}

.top-rate {
  font-size: 0.75rem;
  color: var(--color-slate-500);
  font-weight: 500;
}

.top-hasena {
  font-size: 0.75rem;
  color: var(--primary-color);
  font-weight: 600;
}

/* 테이블 */
.table-wrapper {
  overflow-x: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th {
  padding: 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-slate-500);
  background: var(--color-slate-50);
  border-bottom: 1px solid var(--color-slate-200);
  white-space: nowrap;
}

.th-rank { width: 60px; text-align: center; }
.th-user { width: auto; }

.text-center { text-align: center; }

/* 애니메이션 */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 반응형 */
@media (max-width: 640px) {
  .content-wrapper {
    padding-bottom: 7rem;
  }

  .filter-section {
    flex-direction: column;
    gap: 0.75rem;
  }

  .score-explainer {
    align-items: flex-start;
    flex-direction: column;
  }

  .ranking-stats {
    gap: 1rem;
  }

  .mobile-hide {
    display: none;
  }

  .leaderboard-table,
  .leaderboard-table tbody {
    display: block;
  }

  .leaderboard-table thead {
    display: none;
  }

  .top-three {
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .top-card {
    padding: 0.75rem 0.5rem;
  }

  .rank-1 {
    transform: none;
  }

  .rank-2,
  .rank-3 {
    margin-top: 0.5rem;
  }

  .medal-icon {
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .top-avatar,
  .top-avatar-placeholder {
    width: 2.5rem;
    height: 2.5rem;
  }

  .top-name {
    margin-bottom: 0.25rem;
  }

  .top-stats {
    gap: 0;
  }
}
</style>
