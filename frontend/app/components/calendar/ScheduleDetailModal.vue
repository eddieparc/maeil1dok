<template>
  <BaseModal
    :model-value="isOpen"
    :title="formattedDate"
    size="md"
    :close-on-overlay="true"
    :close-on-esc="true"
    @update:model-value="handleClose"
    @close="handleClose"
  >
    <div class="schedule-detail-content">
      <div v-if="schedules.length === 0" class="empty-state">
        이 날짜에 예정된 읽기가 없습니다.
      </div>

      <div v-else class="schedule-list">
        <div
          v-for="item in schedules"
          :key="item.schedule_id || `${item.plan_id}-${item.book}`"
          class="schedule-detail"
          :style="{ '--plan-color': item.color }"
          @click="handleNavigate(item)"
        >
          <div class="plan-info">
            <span class="plan-badge" :style="{ backgroundColor: item.color }">
              {{ item.plan_name }}
            </span>
            <span
              class="status-badge"
              :class="item.is_completed ? 'completed' : 'pending'"
            >
              {{ item.is_completed ? '완료' : '미완료' }}
            </span>
          </div>
          <div class="reading-info">
            <span class="reading-text">{{ getFullText(item) }}</span>
            <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useScheduleFormatter } from '~/composables/useScheduleFormatter'
import BaseModal from '~/components/ui/modal/BaseModal.vue'

export interface ScheduleDetail {
  plan_id: number
  plan_name: string
  color: string
  book: string
  chapters?: string
  start_chapter?: number
  end_chapter?: number
  is_completed: boolean
  schedule_id?: number
  schedule_text?: string
}

interface Props {
  isOpen: boolean
  date: { dateStr: string; day: number } | null
  schedules: ScheduleDetail[]
  profileUserId?: number  // 프로필 사용자 ID (뒤로가기용)
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', schedule: ScheduleDetail): void
}>()

const router = useRouter()
const { getBookCode, parseChapters } = useScheduleFormatter()

const formattedDate = computed(() => {
  if (!props.date?.dateStr) return ''
  const [year, month, day] = props.date.dateStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일 (${weekday})`
})

const getFullText = (item: ScheduleDetail) => {
  // 시편은 "편", 그 외는 "장" 사용
  const unit = item.book === '시편' ? '편' : '장'

  if (item.start_chapter && item.end_chapter) {
    if (item.start_chapter === item.end_chapter) {
      return `${item.book} ${item.start_chapter}${unit}`
    }
    return `${item.book} ${item.start_chapter}-${item.end_chapter}${unit}`
  }

  // chapters 필드가 있는 경우 파싱하여 처리
  if (item.chapters) {
    const parsed = parseChapters(item.chapters)
    if (parsed) {
      if (parsed.start === parsed.end) {
        return `${item.book} ${parsed.start}${unit}`
      }
      return `${item.book} ${parsed.start}-${parsed.end}${unit}`
    }
    return `${item.book} ${item.chapters}`
  }

  return item.book
}

const handleClose = () => {
  emit('close')
}

const handleNavigate = (item: ScheduleDetail) => {
  const bookCode = getBookCode(item.book)
  if (!bookCode) {
    emit('navigate', item)
    return
  }

  let chapter = item.start_chapter
  if (!chapter && item.chapters) {
    const parsed = parseChapters(item.chapters)
    if (parsed) {
      chapter = parsed.start
    }
  }

  const query: Record<string, string> = {
    book: bookCode,
    chapter: chapter?.toString() || '1',
    plan: item.plan_id.toString()
  }

  // 프로필 사용자 ID가 있으면 해당 프로필로 뒤로가기
  if (props.profileUserId) {
    query.from = `profile/${props.profileUserId}`
  }

  router.push({
    path: '/bible',
    query
  })
  emit('close')
}
</script>

<style scoped>
.schedule-detail-content {
  min-height: 100px;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary, #64748B);
  padding: 2rem 0;
  font-size: 0.9375rem;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-detail {
  padding: 0.875rem;
  background: var(--color-bg-secondary, #F8FAFC);
  border-radius: 12px;
  border-left: 4px solid var(--plan-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.schedule-detail:hover {
  background: var(--color-bg-hover, #F1F5F9);
  transform: translateX(2px);
}

.plan-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.plan-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
}

.status-badge.completed {
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

.status-badge.pending {
  background: var(--amber-100, #FEF3C7);
  color: var(--amber-700, #B45309);
}

.reading-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reading-text {
  font-size: 0.9375rem;
  color: var(--text-primary, #1E293B);
  font-weight: 500;
}

.arrow-icon {
  color: var(--text-secondary, #64748B);
  flex-shrink: 0;
}

/* Dark mode support */
:root.dark .schedule-detail {
  background: var(--color-bg-secondary);
}

:root.dark .schedule-detail:hover {
  background: var(--color-bg-hover);
}

:root.dark .status-badge.completed {
  background: rgba(34, 197, 94, 0.2);
  color: #4ADE80;
}

:root.dark .status-badge.pending {
  background: rgba(251, 191, 36, 0.2);
  color: #FCD34D;
}
</style>
