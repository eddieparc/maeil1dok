<template>
  <Teleport to="body">
    <Transition name="celebration">
      <div v-if="isOpen" class="celebration-overlay" @click="close">
        <div class="celebration-modal" @click.stop>
          <!-- Emoji Row -->
          <div class="emoji-row">
            <span class="emoji bounce-1">🎉</span>
            <span class="emoji bounce-2">🎊</span>
            <span class="emoji bounce-3">🎉</span>
          </div>

          <!-- Title -->
          <h1 class="title">축하합니다!</h1>
          <h2 class="session-name">"{{ sessionName }}" 완료!</h2>

          <!-- Stats Card -->
          <div class="stats-card">
            <div class="stat">
              <span class="stat-icon">📚</span>
              <span class="stat-value">{{ animatedTotal }}일치</span>
              <span class="stat-label">읽기 완료!</span>
            </div>

            <div class="stat">
              <span class="stat-icon">⏱️</span>
              <span class="stat-value">{{ animatedDays }}일</span>
              <span class="stat-label">만에 달성!</span>
            </div>

            <div v-if="celebration.stats.total_chapters" class="stat">
              <span class="stat-icon">📖</span>
              <span class="stat-value">{{ animatedChapters }}장</span>
              <span class="stat-label">읽었어요!</span>
            </div>

            <div class="stat highlight">
              <span class="stat-icon">🏆</span>
              <span class="stat-value">{{ celebration.title }}</span>
            </div>
          </div>

          <!-- Return Info -->
          <div class="return-info">
            <p>이제 원본 플랜으로 돌아갑니다.</p>
            <p class="plan-name">"{{ originalPlanName }}"</p>
          </div>

          <!-- Warning (if any) -->
          <div v-if="warning" class="warning-info">
            <span class="warning-icon">⚠️</span>
            <span>{{ warning }}</span>
          </div>

          <!-- Button -->
          <button class="confirm-button" @click="close">
            확인
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useConfetti } from '~/composables/useConfetti'

interface CelebrationStats {
  total_completed: number
  total_chapters?: number
  days_taken: number
  started_at: string | null
  completed_at: string | null
}

interface CelebrationData {
  title: string
  subtitle: string
  stats: CelebrationStats
}

const props = defineProps<{
  isOpen: boolean
  sessionName: string
  originalPlanName: string
  celebration: CelebrationData
  warning?: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { fireConfetti } = useConfetti()

// Animated values
const animatedTotal = ref(0)
const animatedDays = ref(0)
const animatedChapters = ref(0)

// Fire confetti when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Slight delay for better effect
    setTimeout(() => {
      fireConfetti()
    }, 200)

    // Start count-up animation
    startCountUp()
  }
}, { immediate: true })

const startCountUp = () => {
  const duration = 1000
  const steps = 30
  const interval = duration / steps

  const targetTotal = props.celebration.stats.total_completed
  const targetDays = props.celebration.stats.days_taken
  const targetChapters = props.celebration.stats.total_chapters || 0

  let step = 0
  const timer = setInterval(() => {
    step++
    const progress = step / steps
    const easeProgress = easeOutCubic(progress)

    animatedTotal.value = Math.floor(targetTotal * easeProgress)
    animatedDays.value = Math.floor(targetDays * easeProgress)
    animatedChapters.value = Math.floor(targetChapters * easeProgress)

    if (step >= steps) {
      clearInterval(timer)
      animatedTotal.value = targetTotal
      animatedDays.value = targetDays
      animatedChapters.value = targetChapters
    }
  }, interval)
}

// Easing function for smooth animation
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

const close = () => {
  emit('close')
}
</script>

<style scoped>
.celebration-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 1rem;
}

.celebration-modal {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 24px;
  padding: 2rem;
  text-align: center;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

.emoji-row {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.emoji {
  display: inline-block;
}

.bounce-1 {
  animation: bounce 0.6s ease infinite;
}

.bounce-2 {
  animation: bounce 0.6s ease infinite 0.15s;
}

.bounce-3 {
  animation: bounce 0.6s ease infinite 0.3s;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
  margin: 0 0 0.5rem;
}

.session-name {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 1.5rem;
}

.stats-card {
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.stat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

.stat:not(:last-child) {
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.stat.highlight {
  padding-top: 1rem;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary, #2A1111);
}

.stat-label {
  font-size: 1rem;
  color: var(--color-text-secondary, #6b7280);
}

.return-info {
  margin-bottom: 1rem;
}

.return-info p {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6b7280);
}

.plan-name {
  font-weight: 600;
  color: var(--color-text-primary, #111827) !important;
  margin-top: 0.25rem !important;
}

.warning-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-warning, #fef3c7);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--color-warning-text, #92400e);
  margin-bottom: 1rem;
}

.warning-icon {
  flex-shrink: 0;
}

.confirm-button {
  width: 100%;
  padding: 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: var(--color-primary, #2A1111);
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.confirm-button:hover {
  background: var(--color-primary-dark, #3A1A1A);
}

/* Transition animations */
.celebration-enter-active {
  transition: opacity 0.3s ease;
}

.celebration-enter-active .celebration-modal {
  animation: pop-in 0.4s ease-out;
}

.celebration-leave-active {
  transition: opacity 0.2s ease;
}

.celebration-enter-from,
.celebration-leave-to {
  opacity: 0;
}

@keyframes pop-in {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  70% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .celebration-modal {
    --color-bg-primary: #1f2937;
    --color-bg-secondary: #374151;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-border: #4b5563;
  }
}
</style>
