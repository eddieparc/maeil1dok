<template>
  <tr
    class="leaderboard-mobile-card"
    data-testid="leaderboard-mobile-card"
    :class="{ 'is-me': isHighlighted }"
  >
    <td class="rank-cell">
      <span :class="rankClass" :aria-label="`${rank}위 순위`">{{ rank }}</span>
    </td>
    <td class="user-cell">
      <NuxtLink :to="`/profile/${user.id}`" class="user-info">
        <NuxtImg
          v-if="user.profile_image && !imageError"
          :src="user.profile_image"
          :alt="user.nickname"
          class="user-avatar"
          loading="lazy"
          @error="handleImageError"
        />
        <span v-else class="user-avatar-placeholder"><UserIcon :size="18" aria-hidden="true" /></span>
        <span class="user-details">
          <span class="user-name">{{ user.nickname }}</span>
          <span class="user-streak">연속 {{ currentStreak }}일</span>
          <span v-if="user.role" class="sr-only">{{ user.role }}</span>
          <span v-if="user.is_me" class="sr-only">내 순위</span>
        </span>
      </NuxtLink>
    </td>
    <td class="activity-cell" :aria-label="`활동 점수 ${activityScore}점, 통독 ${bibleCompletedDays}일, 하세나 ${hasenaCompletedDays}일`">
      <span class="days-count">{{ activityScore }}</span>
      <span class="sr-only">통독 {{ bibleCompletedDays }} · 하세나 {{ hasenaCompletedDays }}</span>
    </td>
    <td class="progress-cell">
      <span class="progress-text">{{ progressRate }}%</span>
      <span class="sr-only">최장 연속 {{ longestStreak }}일</span>
    </td>
  </tr>
</template>

<script setup>
import { computed, ref } from 'vue'
import { UserIcon } from '@lucide/vue'

const imageError = ref(false)
const props = defineProps({
  rank: { type: Number, required: true },
  user: { type: Object, required: true, validator: (value) => value.id && value.nickname },
  completedDays: { type: Number, default: 0 },
  bibleCompletedDays: { type: Number, default: 0 },
  hasenaCompletedDays: { type: Number, default: 0 },
  activityScore: { type: Number, default: 0 },
  progressRate: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  isHighlighted: { type: Boolean, default: false }
})
const rankClass = computed(() => ['rank-number', { 'top-rank': props.rank <= 3 }])
const handleImageError = () => { imageError.value = true }
</script>

<style scoped>
.leaderboard-mobile-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 56px 56px;
  align-items: center;
  min-height: 64px;
  padding: 10px 20px;
  border-top: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
}
.is-me { background: var(--color-accent-bg); }
td { min-width: 0; padding: 0; }
.rank-number { color: var(--color-text-tertiary); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rank-number.top-rank { color: var(--color-accent-primary); font-size: 15px; }
.user-info { display: flex; align-items: center; gap: 8px; min-height: 44px; color: inherit; text-decoration: none; border-radius: var(--radius-control); transition: color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.user-info:hover { color: var(--color-accent-primary); }
.user-info:active { transform: scale(0.97); }
.user-info:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 1px var(--color-accent-primary); }
.user-avatar, .user-avatar-placeholder { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.user-avatar-placeholder { display: flex; align-items: center; justify-content: center; background: var(--color-bg-tertiary); color: var(--color-accent-primary); }
.user-details { min-width: 0; }
.user-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.user-streak { display: block; margin-top: 2px; color: var(--color-text-tertiary); font-size: 11px; }
.activity-cell, .progress-cell { text-align: right; font-variant-numeric: tabular-nums; }
.days-count { font-size: 14px; font-weight: 700; }
.progress-text { font-size: 13px; color: var(--color-text-secondary); }
@media (prefers-reduced-motion: reduce) {
  .user-info { transition: none; }
  .user-info:active { transform: none; }
}
</style>
