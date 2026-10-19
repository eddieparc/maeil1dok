<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { NuxtLink } from '#components'
import { Check, ChevronDown, ChevronRight, Info, Play, SlidersHorizontal } from '@lucide/vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useSelectedPlanStore } from '~/stores/selectedPlan'
import AppButton from '~/components/ui/AppButton.vue'
import BottomSheet from '~/components/ui/BottomSheet.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import { introDateRange, isCurrentIntro, useIntroProgress, type Intro } from '~/components/intro/useIntroProgress'
import type { components } from '~/types/generated/api-schema'

const api = useApi()
const auth = useAuthService()
const selectedPlan = useSelectedPlanStore()
const { pending, toggle } = useIntroProgress()
const introductions = ref<Intro[]>([])
const subscriptions = ref<components['schemas']['PlanSubscriptionListResponse'][]>([])
const loading = ref(true)
const error = ref('')
const showPlanSheet = ref(false)
const mounted = ref(false)
let request = 0
const selectedPlanName = computed(() => subscriptions.value.find(plan => plan.plan_id === selectedPlan.selectedPlanId)?.plan_name ?? '플랜 선택')
const defaultPlanName = computed(() => (subscriptions.value.find(plan => plan.is_default) ?? subscriptions.value[0])?.plan_name)
const completedCount = computed(() => introductions.value.filter(intro => intro.is_completed).length)

async function fetchIntroductions(ticket: number) {
  const planId = selectedPlan.selectedPlanId
  if (planId === null) return
  const data: Intro[] = auth.isAuthenticated.value
    ? (await api.GET('/api/v1/todos/user/video/intro/', { params: { plan_id: planId } })).data
    : (await api.GET('/api/v1/todos/video/intro/', { params: { plan_id: planId } })).data.map(intro => ({ ...intro, is_completed: false, completed_at: null }))
  if (ticket !== request) return
  introductions.value = data.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id)
}

async function load() {
  const ticket = ++request
  introductions.value = []
  subscriptions.value = []
  showPlanSheet.value = false
  error.value = ''
  loading.value = true
  if (!mounted.value || auth.authState.value === 'loading') return
  if (auth.authState.value === 'unknown-offline') {
    error.value = '로그인 상태를 확인하지 못했어요. 연결 후 다시 시도해 주세요.'
    loading.value = false
    return
  }
  try {
    const { data } = await api.GET('/api/v1/todos/plan/')
    if (ticket !== request) return
    subscriptions.value = data
    if (!data.some(plan => plan.plan_id === selectedPlan.selectedPlanId)) {
      selectedPlan.setSelectedPlanId((data.find(plan => plan.is_default) ?? data[0])?.plan_id ?? null)
    }
    await fetchIntroductions(ticket)
  } catch {
    if (ticket === request) error.value = '개론 목록을 불러오지 못했어요. 다시 시도해 주세요.'
  } finally {
    if (ticket === request) loading.value = false
  }
}

async function selectPlan(id: number) {
  selectedPlan.setSelectedPlanId(id)
  showPlanSheet.value = false
  const ticket = ++request
  introductions.value = []
  loading.value = true
  error.value = ''
  try {
    await fetchIntroductions(ticket)
  } catch {
    if (ticket === request) error.value = '개론 목록을 불러오지 못했어요. 다시 시도해 주세요.'
  } finally {
    if (ticket === request) loading.value = false
  }
}

async function retry() {
  if (auth.authState.value === 'unknown-offline') await auth.initialize()
  await load()
}
watch([mounted, auth.authState, () => auth.user.value?.id], load)
onMounted(() => { selectedPlan.initializeFromStorage(); mounted.value = true })
onBeforeUnmount(() => { request++ })
</script>

<template>
  <div class="intro-list">
    <div class="intro-controls">
      <AppButton variant="secondary" size="sm" data-testid="intro-plan-trigger" :disabled="loading || !subscriptions.length" :aria-expanded="showPlanSheet" aria-haspopup="dialog" @click="showPlanSheet = true">
        <span class="intro-plan-name">{{ selectedPlanName }}</span><ChevronDown :size="16" aria-hidden="true" />
      </AppButton>
      <span v-if="!loading && !error" class="intro-count" data-testid="intro-count" :data-completed="completedCount" :data-total="introductions.length" aria-live="polite">{{ completedCount }}/{{ introductions.length }} 시청 완료</span>
    </div>
    <p v-if="auth.authState.value === 'unauthenticated' && defaultPlanName" class="intro-guest" data-testid="intro-guest-notice">
      <Info :size="16" aria-hidden="true" /><span>로그인하지 않으면 <strong>{{ defaultPlanName }}</strong>이 기본으로 선택돼요.</span>
    </p>
    <div v-if="loading" class="intro-rows" role="status" aria-label="개론 영상 불러오는 중" aria-busy="true">
      <div v-for="i in 5" :key="i" class="intro-skeleton"><Skeleton width="26px" height="26px" /><Skeleton width="72px" height="48px" /><div><Skeleton width="70%" height="18px" /><Skeleton width="45%" height="12px" /></div></div>
    </div>
    <EmptyState v-else-if="error" data-testid="intro-error" :title="error" action-text="다시 시도" @action="retry" />
    <EmptyState v-else-if="!introductions.length" title="표시할 개론 영상이 없어요" :description="subscriptions.length ? '선택한 플랜에 등록된 영상을 확인해 주세요.' : '플랜을 구독하면 개론 영상을 함께 볼 수 있어요.'">
      <template #action><AppButton to="/plans" variant="secondary">플랜 보기</AppButton></template>
    </EmptyState>
    <ul v-else class="intro-rows">
      <li v-for="intro in introductions" :key="intro.id" class="intro-row" :class="{ 'intro-row--current': isCurrentIntro(intro) }" :data-testid="`intro-row-${intro.id}`" :data-current="isCurrentIntro(intro)">
        <button type="button" class="intro-toggle" :class="{ 'intro-toggle--done': intro.is_completed }" :data-testid="`intro-toggle-${intro.id}`" :aria-label="`${intro.book} 개론 시청 완료`" :aria-pressed="intro.is_completed" :disabled="pending.has(intro.id)" :aria-busy="pending.has(intro.id) || undefined" @click="toggle(intro)">
          <span class="intro-check"><Check v-if="intro.is_completed" :size="16" :stroke-width="2.5" aria-hidden="true" /></span>
        </button>
        <NuxtLink :to="`/intro/${intro.id}`" class="intro-link" :data-testid="`intro-link-${intro.id}`">
          <span class="intro-thumbnail" aria-hidden="true"><Play :size="20" /></span>
          <span class="intro-info"><span class="intro-title">{{ intro.book }} 개론 <span v-if="isCurrentIntro(intro)" class="intro-week">이번 주</span></span><span class="intro-dates">{{ introDateRange(intro) }}</span></span>
          <ChevronRight class="intro-chevron" :size="18" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
    <BottomSheet v-model="showPlanSheet" title="플랜 선택" data-testid="intro-plan-sheet">
      <div class="intro-plans">
        <button v-for="plan in subscriptions" :key="plan.plan_id" type="button" class="intro-plan-option" :class="{ 'intro-plan-option--selected': plan.plan_id === selectedPlan.selectedPlanId }" :data-testid="`intro-plan-${plan.plan_id}`" :aria-pressed="plan.plan_id === selectedPlan.selectedPlanId" @click="selectPlan(plan.plan_id)">
          <span class="intro-plan-radio" aria-hidden="true"><Check v-if="plan.plan_id === selectedPlan.selectedPlanId" :size="14" /></span><span>{{ plan.plan_name }}</span><span v-if="plan.is_default" class="intro-default">기본</span>
        </button>
      </div>
      <template #footer><div class="intro-sheet-actions"><AppButton variant="secondary" @click="showPlanSheet = false">취소</AppButton><AppButton to="/plans" @click="showPlanSheet = false"><SlidersHorizontal :size="16" aria-hidden="true" />플랜 관리</AppButton></div></template>
    </BottomSheet>
  </div>
</template>

<style scoped>
.intro-list { padding: 16px var(--screen-gutter) 32px; color: var(--color-text-primary); letter-spacing: var(--tracking-body); }
.intro-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.intro-controls :deep(.app-button) { max-width: 65%; }
.intro-plan-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.intro-count { flex-shrink: 0; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.intro-guest { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 14px; padding: 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-card); color: var(--color-text-secondary); font-size: 12px; line-height: 1.5; }
.intro-guest svg { flex-shrink: 0; margin-top: 2px; }
.intro-rows { display: grid; gap: 14px; list-style: none; padding: 0; margin: 0; }
.intro-row { display: flex; align-items: center; gap: 4px; padding: 12px 12px 12px 4px; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.intro-row--current { border-color: var(--color-accent-primary); }
.intro-toggle { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--hit-min); min-height: var(--hit-min); border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-tertiary); cursor: pointer; }
.intro-check { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1.5px solid var(--color-border-default); border-radius: var(--radius-pill); }
.intro-toggle--done .intro-check { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: var(--color-text-inverse); }
.intro-toggle:hover { background: var(--color-bg-hover); }
.intro-toggle:disabled { opacity: .5; cursor: wait; }
.intro-link { display: flex; flex: 1; min-width: 0; min-height: var(--hit-min); align-items: center; gap: 12px; border-radius: var(--radius-control); text-decoration: none; color: inherit; }
.intro-link:hover .intro-title { color: var(--color-accent-primary); text-decoration: underline; }
.intro-thumbnail { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 72px; height: 48px; border-radius: 8px; background: linear-gradient(135deg, var(--color-text-secondary), var(--color-text-primary)); color: var(--color-bg-primary); }
.intro-info { display: grid; flex: 1; min-width: 0; gap: 6px; }
.intro-title { font-size: 15px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.intro-week { display: inline-block; margin-left: 4px; padding: 4px 6px; border-radius: var(--radius-pill); background: var(--color-accent-primary); color: var(--color-text-inverse); font-size: 11px; line-height: 1; white-space: nowrap; vertical-align: middle; }
.intro-dates { color: var(--color-text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; }
.intro-chevron { flex-shrink: 0; color: var(--color-text-tertiary); }
.intro-skeleton { display: grid; grid-template-columns: 26px 72px 1fr; align-items: center; gap: 12px; min-height: 74px; padding: 12px; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); }
.intro-skeleton > div:last-child { display: grid; gap: 8px; }
.intro-plans { display: grid; gap: 8px; }
.intro-plan-option { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 12px 14px; border: 1px solid var(--color-border-default); border-radius: 14px; background: var(--color-bg-card); color: var(--color-text-primary); text-align: left; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.intro-plan-option--selected { border-color: var(--color-accent-primary); background: var(--color-accent-bg); }
.intro-plan-option:hover { background: var(--color-bg-hover); }
.intro-plan-radio { display: flex; justify-content: center; align-items: center; flex-shrink: 0; width: 20px; height: 20px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); }
.intro-plan-option--selected .intro-plan-radio { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.intro-default { margin-left: auto; padding: 4px 8px; border-radius: var(--radius-pill); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 11px; white-space: nowrap; }
.intro-sheet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.intro-toggle:active:not(:disabled), .intro-link:active, .intro-plan-option:active { transform: scale(.97); }
@media (max-width: 359px) { .intro-controls { flex-wrap: wrap; } .intro-controls :deep(.app-button) { max-width: 100%; } .intro-link { gap: 8px; } .intro-chevron { display: none; } }
@media (min-width: 1024px) { .intro-list { padding: 28px 36px 40px; } }
@media (prefers-reduced-motion: reduce) { .intro-toggle:active:not(:disabled), .intro-link:active, .intro-plan-option:active { transform: none; } }
</style>
