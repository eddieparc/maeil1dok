<template>
  <tr
    class="leaderboard-mobile-card"
    data-testid="leaderboard-mobile-card"
    :class="{ 'highlight-row': isHighlighted }"
  >
    <td class="rank-cell">
      <span :class="rankClass" :aria-label="`${rank}위 순위`">
        {{ rank }}
      </span>
    </td>
    <td class="user-cell">
      <div class="user-info">
        <NuxtImg
          v-if="user.profile_image && !imageError"
          :src="user.profile_image"
          :alt="user.nickname"
          class="user-avatar"
          loading="lazy"
          @error="handleImageError"
        />
        <div v-else class="user-avatar-placeholder">
          <UserIcon :size="18" />
        </div>
        <div>
          <NuxtLink
            :to="`/profile/${user.id}`"
            class="user-name"
          >
            {{ user.nickname }}
          </NuxtLink>
          <span v-if="user.is_me" class="me-badge">나</span>
          <p v-if="user.role" class="user-role">{{ user.role }}</p>
        </div>
      </div>
    </td>
    <td class="text-center activity-cell" :aria-label="`활동 점수 ${activityScore}점, 통독 ${bibleCompletedDays}일, 하세나 ${hasenaCompletedDays}일`">
      <span class="days-count">{{ activityScore }}</span>
      <span class="activity-breakdown">통독 {{ bibleCompletedDays }} · 하세나 {{ hasenaCompletedDays }}</span>
    </td>
    <td class="text-center progress-cell">
      <div class="progress-wrapper">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="`width: ${Math.min(progressRate, 100)}%`"
          ></div>
        </div>
        <span class="progress-text">{{ progressRate }}%</span>
      </div>
    </td>
    <td class="text-center mobile-hide">
      <span class="streak current">{{ currentStreak }}일</span>
    </td>
    <td class="text-center mobile-hide">
      <span class="streak longest">{{ longestStreak }}일</span>
    </td>
  </tr>
</template>

<script setup>
import { computed, ref } from 'vue'
import { UserIcon } from '@lucide/vue'

const imageError = ref(false)

const props = defineProps({
  rank: {
    type: Number,
    required: true
  },
  user: {
    type: Object,
    required: true,
    validator: (value) => value.id && value.nickname
  },
  completedDays: {
    type: Number,
    default: 0
  },
  bibleCompletedDays: {
    type: Number,
    default: 0
  },
  hasenaCompletedDays: {
    type: Number,
    default: 0
  },
  activityScore: {
    type: Number,
    default: 0
  },
  progressRate: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  isHighlighted: {
    type: Boolean,
    default: false
  }
})

const rankClass = computed(() => {
  const classes = ['rank-number']
  if (props.rank === 1) classes.push('gold')
  else if (props.rank === 2) classes.push('silver')
  else if (props.rank === 3) classes.push('bronze')
  return classes
})

const handleImageError = () => {
  imageError.value = true
}
</script>

<style scoped>
tr {
  transition: background-color var(--transition-fast);
}

tr:hover {
  background: var(--color-slate-50);
}

.highlight-row {
  background: var(--primary-light) !important;
}

.rank-cell {
  padding: 1rem;
  font-weight: 600;
}

.rank-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-slate-100);
  color: var(--color-slate-600);
  font-size: 0.875rem;
}

.rank-number.gold {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #8B4513;
  font-weight: 700;
}

.rank-number.silver {
  background: linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 100%);
  color: #4A5568;
  font-weight: 700;
}

.rank-number.bronze {
  background: linear-gradient(135deg, #CD7F32 0%, #B87333 100%);
  color: white;
  font-weight: 700;
}

.user-cell {
  padding: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-slate-200);
}

.user-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--color-slate-200);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-slate-100);
  color: var(--primary-color);
  font-size: 1rem;
  flex-shrink: 0;
}

.user-name {
  display: inline-block;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
  white-space: nowrap;
  word-break: keep-all;
}

.user-name:hover {
  color: var(--primary-color);
}

.me-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: var(--primary-color);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.25rem;
}

.user-role {
  margin: 0.25rem 0 0 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.text-center {
  text-align: center;
  padding: 1rem;
}

.days-count {
  font-weight: 600;
  color: var(--text-primary);
}

.activity-breakdown {
  display: block;
  margin-top: 0.125rem;
  color: var(--text-secondary);
  font-size: 0.6875rem;
  white-space: nowrap;
}

.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.progress-bar {
  width: 80px;
  height: 6px;
  background: var(--color-slate-200);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  transition: width var(--transition-normal);
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 42px;
}

.streak {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
}

.streak.current {
  background: var(--primary-light);
  color: var(--primary-dark);
}

.streak.longest {
  background: var(--color-slate-100);
  color: var(--color-slate-600);
}

@media (max-width: 768px) {
  tr.leaderboard-mobile-card {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) minmax(84px, auto);
    align-items: center;
    row-gap: 0.125rem;
    margin: 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 12px;
    background: var(--color-bg-card);
    box-shadow: var(--shadow-sm);
  }

  tr.leaderboard-mobile-card + tr.leaderboard-mobile-card {
    margin-top: 0;
  }

  tr.leaderboard-mobile-card td {
    border-bottom: 0;
  }

  .mobile-hide {
    display: none;
  }

  .rank-cell,
  .user-cell,
  .text-center {
    padding: 0.875rem 0.5rem;
  }

  .rank-cell {
    grid-column: 1;
    grid-row: 1 / span 2;
    align-self: center;
  }

  .user-cell {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }

  .activity-cell {
    grid-column: 2;
    grid-row: 2;
    padding-top: 0;
    text-align: left;
  }

  .progress-cell {
    grid-column: 3;
    grid-row: 1 / span 2;
    align-self: center;
  }

  .user-info {
    gap: 0.5rem;
  }

  .user-avatar,
  .user-avatar-placeholder {
    width: 32px;
    height: 32px;
  }

  .user-avatar-placeholder {
    font-size: 0.875rem;
  }

  .rank-number {
    min-width: 28px;
    height: 28px;
    font-size: 0.8125rem;
  }

  .progress-bar {
    width: 48px;
  }

  .progress-text {
    min-width: 34px;
    font-size: 0.75rem;
  }

  .progress-wrapper {
    gap: 0.25rem;
  }

  .activity-breakdown {
    font-size: 0.625rem;
    white-space: normal;
  }
}
</style>
