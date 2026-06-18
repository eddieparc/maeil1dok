<template>
  <div class="group-leaderboard">
    <!-- 기간 필터 -->
    <div class="filter-section">
      <FilterButtonGroup
        v-model="currentPeriod"
        :options="periods"
        label="기간"
        @update:model-value="loadLeaderboard"
      />
    </div>

    <!-- 로딩 -->
    <div v-if="isLoading" class="flex flex-col gap-2">
      <SkeletonLeaderboardRow v-for="i in 5" :key="i" />
    </div>

    <!-- 데이터 있을 때 -->
    <template v-else-if="leaderboard.length > 0">
      <!-- Top 3 하이라이트 -->
      <div v-if="topThree.length > 0" class="top-three">
        <div
          v-for="(entry, index) in topThree"
          :key="entry.user.id"
          :class="['top-card', `rank-${index + 1}`]"
        >
          <div class="medal-icon">{{ medals[index] }}</div>
          <div class="avatar-wrapper">
            <NuxtImg
              v-if="entry.user.profile_image && !avatarErrors[entry.user.id]"
              :src="entry.user.profile_image"
              :alt="entry.user.nickname"
              class="top-avatar"
              loading="lazy"
              @error="() => avatarErrors[entry.user.id] = true"
            />
            <div v-else class="top-avatar-placeholder">
              {{ entry.user.nickname?.charAt(0) || '?' }}
            </div>
            <div class="rank-badge">{{ index + 1 }}</div>
          </div>
          <p class="top-name">{{ entry.user.nickname }}</p>
          <div class="top-stats">
            <span class="top-days">{{ entry.completed_days }}일</span>
            <span class="top-rate">{{ entry.progress_rate }}%</span>
          </div>
          <div v-if="entry.current_streak > 0" class="top-streak">
            {{ entry.current_streak }}일 연속
          </div>
        </div>
      </div>

      <!-- 전체 랭킹 테이블 -->
      <div class="table-wrapper">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th class="th-rank">순위</th>
              <th class="th-user">멤버</th>
              <th class="text-center">완료</th>
              <th class="text-center">진행률</th>
              <th class="text-center mobile-hide">연속</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in leaderboard"
              :key="entry.user.id"
              :class="{ 'highlight-row': entry.user.is_me }"
            >
              <td class="rank-cell">
                <span :class="['rank-number', getRankClass(entry.rank)]">
                  {{ entry.rank }}
                </span>
              </td>
              <td class="user-cell">
                <div class="user-info">
                  <NuxtImg
                    v-if="entry.user.profile_image && !avatarErrors[entry.user.id]"
                    :src="entry.user.profile_image"
                    :alt="entry.user.nickname"
                    class="user-avatar"
                    loading="lazy"
                    @error="() => avatarErrors[entry.user.id] = true"
                  />
                  <div v-else class="user-avatar-placeholder">
                    {{ entry.user.nickname?.charAt(0) || '?' }}
                  </div>
                  <div>
                    <NuxtLink :to="`/profile/${entry.user.id}`" class="user-name">
                      {{ entry.user.nickname }}
                    </NuxtLink>
                    <span v-if="entry.user.is_me" class="me-badge">나</span>
                    <p v-if="entry.user.role" class="user-role">{{ entry.user.role }}</p>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <span class="days-count">{{ entry.completed_days }}</span>
              </td>
              <td class="text-center">
                <div class="progress-wrapper">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="`width: ${Math.min(entry.progress_rate, 100)}%`"
                    ></div>
                  </div>
                  <span class="progress-text">{{ entry.progress_rate }}%</span>
                </div>
              </td>
              <td class="text-center mobile-hide">
                <span class="streak">{{ entry.current_streak }}일</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 빈 상태 -->
    <EmptyState
      v-else
      title="랭킹 데이터가 없습니다"
      description="그룹 멤버가 읽기를 시작하면 랭킹이 표시됩니다."
    >
      <template #icon>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 15l-2 5l9-11h-5l2-5l-9 11h5z"/>
        </svg>
      </template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { useScoreboardStore } from '~/stores/scoreboard'
import FilterButtonGroup from '~/components/common/FilterButtonGroup.vue'
import SkeletonLeaderboardRow from '~/components/ui/skeleton/SkeletonLeaderboardRow.vue'
import EmptyState from '~/components/common/EmptyState.vue'

const props = defineProps({
  groupId: {
    type: Number,
    required: true
  },
  planId: {
    type: Number,
    default: undefined
  }
})

const scoreboardStore = useScoreboardStore()

const currentPeriod = ref<'all' | 'week' | 'month'>('all')
const avatarErrors = ref<Record<number, boolean>>({})
const medals = ['🥇', '🥈', '🥉']

const periods = [
  { value: 'all', label: '전체' },
  { value: 'month', label: '이번 달' },
  { value: 'week', label: '이번 주' }
]

const isLoading = computed(() => scoreboardStore.isLoading)
const leaderboard = computed(() => scoreboardStore.groupLeaderboard)
const topThree = computed(() => scoreboardStore.groupLeaderboard.slice(0, 3))

const getRankClass = (rank: number) => {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return ''
}

const loadLeaderboard = () => {
  scoreboardStore.fetchGroupLeaderboard(props.groupId, currentPeriod.value)
}

onMounted(() => {
  loadLeaderboard()
})

watch(() => props.groupId, () => {
  loadLeaderboard()
})
</script>

<style scoped>
.group-leaderboard {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.filter-section {
  display: flex;
  justify-content: flex-start;
}

/* Top 3 */
.top-three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.top-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.5rem;
  background: var(--color-bg-card, white);
  border-radius: 12px;
  border: 1px solid var(--color-slate-200, #E2E8F0);
  position: relative;
  transition: transform 0.2s ease;
}

.top-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.rank-1 {
  order: 2;
  border-color: var(--color-warning-bg);
  background: linear-gradient(to bottom, var(--color-warning-bg), var(--color-bg-card));
  transform: scale(1.05);
  z-index: 1;
}

.rank-2 { order: 1; margin-top: 0.75rem; }
.rank-3 { order: 3; margin-top: 0.75rem; }

.medal-icon {
  font-size: 1.25rem;
  margin-bottom: 0.375rem;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 0.5rem;
}

.top-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-bg-card, white);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.top-avatar-placeholder {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid var(--color-bg-card, white);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-slate-100, #F1F5F9);
  color: var(--color-slate-600, #475569);
  font-weight: 600;
  font-size: 1rem;
}

.rank-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 1.125rem;
  height: 1.125rem;
  background: var(--color-slate-800);
  color: var(--color-bg-card);
  border-radius: 50%;
  font-size: 0.6875rem;
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
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-slate-800, #1E293B);
  margin: 0 0 0.375rem 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  padding: 0 0.25rem;
}

.top-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.top-days {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-slate-800, #1E293B);
  font-family: 'Pretendard', sans-serif;
}

.top-rate {
  font-size: 0.6875rem;
  color: var(--color-slate-500, #64748B);
  font-weight: 500;
}

.top-streak {
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--primary-color, #3B82F6);
  font-weight: 500;
}

/* 테이블 */
.table-wrapper {
  overflow-x: auto;
  background: var(--color-bg-card, white);
  border: 1px solid var(--color-slate-200, #E2E8F0);
  border-radius: 12px;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th {
  padding: 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-slate-500, #64748B);
  background: var(--color-slate-50, #F8FAFC);
  border-bottom: 1px solid var(--color-slate-200, #E2E8F0);
  white-space: nowrap;
}

.leaderboard-table tbody tr {
  transition: background-color 0.15s ease;
}

.leaderboard-table tbody tr:hover {
  background: var(--color-slate-50, #F8FAFC);
}

.leaderboard-table tbody tr:not(:last-child) td {
  border-bottom: 1px solid var(--color-slate-100, #F1F5F9);
}

.highlight-row {
  background: var(--primary-light, #EFF6FF) !important;
}

.th-rank { width: 56px; text-align: center; }
.th-user { width: auto; }
.text-center { text-align: center; }

.rank-cell {
  padding: 0.75rem;
  text-align: center;
}

.rank-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-slate-100, #F1F5F9);
  color: var(--color-slate-600, #475569);
  font-size: 0.8125rem;
  font-weight: 600;
}

.rank-number.gold {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #8B4513;
  font-weight: 700;
}

.rank-number.silver {
  background: linear-gradient(135deg, #E8E8E8, #C0C0C0);
  color: #4A5568;
  font-weight: 700;
}

.rank-number.bronze {
  background: linear-gradient(135deg, #CD7F32, #B87333);
  color: white;
  font-weight: 700;
}

.user-cell {
  padding: 0.75rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-slate-200, #E2E8F0);
  flex-shrink: 0;
}

.user-avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-slate-200, #E2E8F0);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-slate-100, #F1F5F9);
  color: var(--color-slate-600, #475569);
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.user-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary, #1E293B);
  text-decoration: none;
  transition: color 0.15s ease;
}

.user-name:hover {
  color: var(--primary-color, #3B82F6);
}

.me-badge {
  display: inline-block;
  margin-left: 0.375rem;
  padding: 0.0625rem 0.375rem;
  background: var(--primary-color, #3B82F6);
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 0.25rem;
}

.user-role {
  margin: 0.125rem 0 0;
  font-size: 0.6875rem;
  color: var(--text-secondary, #64748B);
}

.days-count {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary, #1E293B);
}

.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  justify-content: center;
}

.progress-bar {
  width: 64px;
  height: 6px;
  background: var(--color-slate-200, #E2E8F0);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color, #3B82F6), var(--primary-dark, #2563EB));
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #1E293B);
  min-width: 38px;
}

.streak {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--primary-color, #3B82F6);
  padding: 0.75rem;
}

/* 반응형 */
@media (max-width: 640px) {
  .top-three { gap: 0.5rem; }
  .top-card { padding: 0.75rem 0.25rem; }
  .top-avatar, .top-avatar-placeholder { width: 2.5rem; height: 2.5rem; }
  .mobile-hide { display: none; }

  .rank-cell, .user-cell, td.text-center {
    padding: 0.5rem 0.375rem;
  }

  .user-avatar, .user-avatar-placeholder {
    width: 32px;
    height: 32px;
  }

  .progress-bar { width: 48px; }
}

/* 다크모드 */
[data-theme="dark"] .top-card {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

[data-theme="dark"] .rank-1 {
  background: linear-gradient(to bottom, rgba(245, 158, 11, 0.1), var(--color-bg-tertiary));
  border-color: rgba(245, 158, 11, 0.3);
}

[data-theme="dark"] .table-wrapper {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

[data-theme="dark"] .leaderboard-table th {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

[data-theme="dark"] .leaderboard-table tbody tr:hover {
  background: var(--color-bg-hover);
}

[data-theme="dark"] .leaderboard-table tbody tr:not(:last-child) td {
  border-color: var(--color-border);
}

[data-theme="dark"] .highlight-row {
  background: rgba(107, 201, 159, 0.1) !important;
}
</style>
