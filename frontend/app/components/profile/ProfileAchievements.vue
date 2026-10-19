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
          :tabindex="activeAchievementTab === tab.key ? 0 : -1"
          @keydown="handleTabKeydown($event, tab.key)"
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
          :disabled="plan.id !== 'all'"
          :tabindex="plan.id === 'all' ? 0 : -1"
          :title="plan.id !== 'all' ? '플랜별 업적은 아직 제공되지 않습니다' : undefined"
          @click="plan.id === 'all' && (selectedPlanId = plan.id)"
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

// TODO(handoff-v2): AchievementResponse has no plan_id; only aggregate achievements can be shown.
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

const handleTabKeydown = (event: KeyboardEvent, key: 'bible' | 'hasena') => {
  let next: 'bible' | 'hasena'
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = key === 'bible' ? 'hasena' : 'bible'
  else if (event.key === 'Home') next = 'bible'
  else if (event.key === 'End') next = 'hasena'
  else return
  event.preventDefault()
  activeAchievementTab.value = next
  document.getElementById(`achievement-tab-${next}`)?.focus()
}

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
.profile-achievements { padding: var(--card-padding); min-height: 300px; letter-spacing: var(--tracking-body); }
.achievement-shell { display: flex; flex-direction: column; gap: 16px; }
.achievement-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: var(--radius-pill); background: var(--color-bg-tertiary); }
.achievement-tab { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); font-size: 13px; font-weight: 500; }
.achievement-tab strong { color: var(--color-text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
.achievement-tab.active { background: var(--color-bg-card); color: var(--color-text-primary); font-weight: 700; box-shadow: var(--shadow-segment-thumb); }
.plan-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 3px; }
.plan-tab { flex: 0 0 auto; padding: 8px 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; }
.plan-tab.active { border-color: var(--color-accent-primary); background: var(--color-accent-primary-light); color: var(--color-accent-primary); }
.achievement-groups { display: flex; flex-direction: column; gap: 20px; }
.achievement-section { display: flex; flex-direction: column; gap: 12px; }
.achievement-section-header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.achievement-section-header h3 { margin: 0; color: var(--color-text-primary); font-size: 15px; font-weight: 700; }
.achievement-section-header span { color: var(--color-text-secondary); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.achievements-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.achievement-card { display: flex; flex-direction: column; align-items: center; padding: 20px 12px; background: var(--color-bg-card); border-radius: var(--radius-card); border: 1px dashed var(--color-border-dark); text-align: center; }
.achievement-card.unlocked { border-style: solid; border-color: var(--color-accent-primary); background: var(--color-accent-primary-light); }
.achievement-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--color-bg-tertiary); color: var(--color-text-tertiary); margin-bottom: 12px; }
.achievement-card.unlocked .achievement-icon { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.achievement-title { font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 8px; }
.achievement-description { font-size: 13px; color: var(--color-text-secondary); margin: 0; line-height: 1.5; }
.unlock-date { margin-top: 12px; font-size: 12px; color: var(--color-accent-primary); font-weight: 500; font-variant-numeric: tabular-nums; }
.locked-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; margin-top: 12px; color: var(--color-text-secondary); }
.locked-label { margin: 0; font-size: 12px; font-weight: 700; }
.locked-target,
.locked-next { margin: 0; font-size: 12px; line-height: 1.4; }
.empty-icon { color: var(--color-text-tertiary); }
button { min-width: var(--hit-min); min-height: var(--hit-min); cursor: pointer; transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button:hover:not(:disabled) { background: var(--color-bg-hover); }
button:active:not(:disabled) { transform: scale(0.97); }
button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; border-color: var(--color-accent-primary); }
@media (max-width: 359px) {
  .achievements-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
  button:active { transform: none; }
}
</style>
