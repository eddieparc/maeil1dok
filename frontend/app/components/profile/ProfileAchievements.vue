<template>
  <div class="profile-achievements fade-in">
    <div v-if="achievements.length > 0" class="achievement-shell">
      <div class="achievement-tabs" role="tablist" aria-label="업적 종류">
        <button
          v-for="tab in achievementTabs"
          :id="`achievement-tab-${tab.key}`"
          :key="tab.key"
          type="button"
          class="achievement-tab"
          :class="{ active: activeAchievementTab === tab.key }"
          role="tab"
          :aria-selected="activeAchievementTab === tab.key"
          :aria-controls="`achievement-panel-${tab.key}`"
          @click="activeAchievementTab = tab.key"
        >
          <component :is="tab.icon" :size="18" aria-hidden="true" />
          <span>{{ tab.label }}</span>
          <strong>{{ tab.unlockedCount }} / {{ tab.totalCount }}</strong>
        </button>
      </div>

      <div
        v-if="activeAchievementTab === 'bible'"
        class="plan-tabs"
        role="tablist"
        aria-label="성경통독 플랜"
      >
        <button
          v-for="plan in planTabs"
          :key="plan.id"
          type="button"
          class="plan-tab"
          :class="{ active: selectedPlanId === plan.id }"
          role="tab"
          :aria-selected="selectedPlanId === plan.id"
          @click="selectedPlanId = plan.id"
        >
          {{ plan.name }}
        </button>
      </div>

      <div
        :id="`achievement-panel-${activeAchievementTab}`"
        class="achievement-groups"
        role="tabpanel"
        :aria-labelledby="`achievement-tab-${activeAchievementTab}`"
      >
      <section
        v-for="group in visibleAchievementGroups"
        :key="group.key"
        class="achievement-section"
        role="group"
        :aria-label="`${group.label} 업적`"
      >
        <div class="achievement-section-header">
          <h3>{{ group.label }}</h3>
          <span>{{ group.unlockedCount }} / {{ group.items.length }}</span>
        </div>
        <div class="achievements-grid" role="list">
          <article
            v-for="achievement in group.items"
            :key="achievement.achievement_type"
            class="achievement-card"
            :class="{ unlocked: achievement.unlocked }"
            :title="achievement.description"
            role="listitem"
            :aria-disabled="!achievement.unlocked"
            :aria-label="achievement.unlocked ? `${achievement.title}, 달성` : `${achievement.title}, 잠김, 목표 ${achievement.milestone_value}${milestoneUnit(achievement)}`"
            :aria-describedby="`achievement-${achievement.achievement_type}`"
          >
            <div class="achievement-icon">
              <component :is="getAchievementIcon(achievement.icon)" :size="24" />
            </div>
            <h4 class="achievement-title">{{ achievement.title }}</h4>
            <p :id="`achievement-${achievement.achievement_type}`" class="achievement-description">{{ achievement.description }}</p>
            <div v-if="achievement.unlocked" class="unlock-date">
              {{ formatDate(achievement.unlockedAt) }}
            </div>
            <div v-else class="locked-state">
              <LockIcon :size="18" aria-hidden="true" />
              <p class="locked-label">잠김</p>
              <p class="locked-target">목표 {{ achievement.milestone_value }}{{ milestoneUnit(achievement) }}까지 필요</p>
              <p class="locked-next">{{ nextStepText(achievement) }}</p>
            </div>
          </article>
        </div>
      </section>
      </div>
    </div>

    <EmptyState
      v-else
      title="업적 정보를 불러올 수 없습니다"
      description="잠시 후 다시 시도해주세요."
    >
      <template #icon>
        <TrophyIcon class="empty-icon" :size="48" />
      </template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import EmptyState from '../common/EmptyState.vue'
import {
  AwardIcon,
  BookOpenIcon,
  CalendarCheckIcon,
  FlameIcon,
  LockIcon,
  StarIcon,
  TrophyIcon,
} from '@lucide/vue'

interface Achievement {
  id: number | null
  achievement_type: string
  title: string
  description: string
  icon: string
  order: number
  unlocked: boolean
  unlockedAt: string | null
  milestone_value: number
}

interface AchievementPlan {
  id: number
  name: string
}

const props = defineProps<{
  achievementsData: Achievement[]
  plans?: AchievementPlan[]
}>()

// 실제 API 데이터만 사용 (Mock 데이터 제거)
const achievements = computed(() => props.achievementsData)
const activeAchievementTab = ref<'bible' | 'hasena'>('bible')
const selectedPlanId = ref<number | 'all'>('all')

const achievementGroups = [
  { key: 'reading', label: '통독', matcher: (type: string) => !type.includes('streak') && !type.includes('hasena') },
  { key: 'streak', label: '연속', matcher: (type: string) => type.includes('streak') && !type.includes('hasena') },
  { key: 'hasena', label: '하세나', matcher: (type: string) => type.includes('hasena') },
]

const planTabs = computed(() => [
  { id: 'all' as const, name: '전체 플랜' },
  ...(props.plans ?? []).map(plan => ({ id: plan.id, name: plan.name })),
])

const groupedAchievements = computed(() => {
  return achievementGroups
    .map(group => {
      const items = achievements.value.filter(achievement => group.matcher(achievement.achievement_type))
      return {
        ...group,
        items,
        unlockedCount: items.filter(achievement => achievement.unlocked).length,
      }
    })
    .filter(group => group.items.length > 0)
})

const bibleAchievements = computed(() => {
  return groupedAchievements.value.filter(group => group.key !== 'hasena')
})

const hasenaAchievements = computed(() => {
  return groupedAchievements.value.filter(group => group.key === 'hasena')
})

const visibleAchievementGroups = computed(() => {
  if (activeAchievementTab.value === 'hasena') return hasenaAchievements.value
  return bibleAchievements.value
})

const achievementTabs = computed(() => [
  {
    key: 'bible' as const,
    label: '성경통독',
    icon: BookOpenIcon,
    totalCount: bibleAchievements.value.reduce((sum, group) => sum + group.items.length, 0),
    unlockedCount: bibleAchievements.value.reduce((sum, group) => sum + group.unlockedCount, 0),
  },
  {
    key: 'hasena' as const,
    label: '하세나',
    icon: FlameIcon,
    totalCount: hasenaAchievements.value.reduce((sum, group) => sum + group.items.length, 0),
    unlockedCount: hasenaAchievements.value.reduce((sum, group) => sum + group.unlockedCount, 0),
  },
])

const getAchievementIcon = (icon: string) => {
  if (icon.includes('book')) return BookOpenIcon
  if (icon.includes('calendar')) return CalendarCheckIcon
  if (icon.includes('fire') || icon.includes('flame')) return FlameIcon
  if (icon.includes('star')) return StarIcon
  if (icon.includes('trophy')) return TrophyIcon
  return AwardIcon
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const milestoneUnit = (achievement: Achievement) => {
  if (achievement.achievement_type.includes('book')) return '권'
  if (achievement.achievement_type.includes('bible')) return '권'
  return '일'
}

const nextStepText = (achievement: Achievement) => {
  if (achievement.achievement_type.includes('hasena')) return '하세나 기록을 이어가면 잠금 해제됩니다.'
  if (achievement.achievement_type.includes('streak')) return '연속 통독을 이어가면 잠금 해제됩니다.'
  return '통독 완료를 쌓으면 잠금 해제됩니다.'
}

</script>

<style scoped>
.profile-achievements {
  padding: 1rem;
  min-height: 300px;
}

.achievement-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.achievement-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0.25rem;
  border: 1px solid var(--color-slate-200);
  border-radius: 12px;
  background: var(--color-slate-50);
}

.achievement-tab {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.625rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--color-slate-600);
  font-weight: 700;
  text-align: left;
}

.achievement-tab strong {
  color: var(--color-slate-500);
  font-size: 0.75rem;
}

.achievement-tab.active {
  border-color: var(--color-slate-200);
  background: var(--color-bg-card);
  color: var(--color-slate-900);
  box-shadow: var(--shadow-sm);
}

.plan-tabs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.125rem;
}

.plan-tab {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-slate-200);
  border-radius: 999px;
  background: var(--color-bg-card);
  color: var(--color-slate-600);
  font-size: 0.8125rem;
  font-weight: 700;
}

.plan-tab.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-color);
}

.achievement-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.achievement-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.achievement-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.achievement-section-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 700;
}

.achievement-section-header span {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 700;
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.achievement-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
  background: white;
  border-radius: var(--radius-lg);
  border: 2px solid var(--gray-200);
  text-align: center;
  transition: all var(--transition-normal);
}

:root.dark .achievement-card {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

.achievement-card.unlocked {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, white 0%, var(--primary-light) 100%);
}

:root.dark .achievement-card.unlocked {
  background: linear-gradient(135deg, var(--color-bg-card) 0%, rgba(var(--primary-rgb), 0.1) 100%);
  /* Note: Assuming --primary-rgb is not available, falling back to simple gradient */
  background: linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-tertiary) 100%);
  border-color: var(--primary-color);
}

.achievement-card.unlocked:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.achievement-card:not(.unlocked) {
  background: var(--color-bg-card);
  border-style: dashed;
  border-color: var(--color-slate-400);
}

.achievement-card:not(.unlocked) .achievement-icon {
  background: var(--color-slate-100);
  color: var(--color-slate-500);
}

.achievement-card:not(.unlocked) .achievement-title {
  color: var(--color-slate-700);
}

.achievement-card:not(.unlocked) .achievement-description,
.achievement-card:not(.unlocked) .locked-state {
  color: var(--color-slate-600);
}

.achievement-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--gray-100);
  margin-bottom: 1rem;
}

:root.dark .achievement-icon {
  background: var(--color-bg-tertiary);
}

.achievement-card.unlocked .achievement-icon {
  background: var(--primary-color);
}

.achievement-icon i {
  font-size: 1.75rem;
  color: var(--gray-400);
}

:root.dark .achievement-icon i {
  color: var(--text-muted);
}

.achievement-card.unlocked .achievement-icon i {
  color: white;
}

.achievement-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.achievement-description {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.unlock-date {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--primary-color);
  font-weight: 500;
}

.locked-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.75rem;
  color: var(--text-secondary);
}

.locked-label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
}

.locked-target,
.locked-next {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.35;
}

.empty-icon {
  font-size: 3rem;
  color: var(--gray-300);
}

:root.dark .empty-icon {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .profile-achievements {
    padding-bottom: 7rem;
  }

  .achievement-tabs {
    grid-template-columns: 1fr;
  }

  .achievements-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .achievement-card {
    padding: 1.25rem 0.75rem;
    scroll-margin-bottom: 7rem;
  }

  .locked-target,
  .locked-next {
    scroll-margin-bottom: 7rem;
  }

  .achievement-icon {
    width: 56px;
    height: 56px;
  }

  .achievement-icon i {
    font-size: 1.5rem;
  }
}
</style>
