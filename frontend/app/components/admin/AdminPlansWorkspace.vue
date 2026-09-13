<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { CalendarDays, ChartNoAxesColumn, ExternalLink, Plus, Search, Upload } from '@lucide/vue'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import { useToast } from '~/composables/useToast'
import AdminPlanFormContent from './AdminPlanFormContent.vue'
import { planAdminError, scheduleLink, type AdminPlan, type AdminSchedule, type PlanAdminSubmission } from './planAdmin'

const api = useApi()
const modal = useModal()
const toast = useToast()
const ownerId = useId()
const ownedModals = new Set<string>()
let alive = true
let planRequest = 0
let scheduleRequest = 0
const plans = ref<AdminPlan[]>([])
const allSchedules = ref<AdminSchedule[]>([])
const selectedId = ref<number | null>(null)
const plansLoading = ref(true)
const schedulesLoading = ref(true)
const plansError = ref('')
const schedulesError = ref('')
const actionError = ref('')
const busy = ref(false)
const formOpen = ref(false)
const search = ref('')
const month = ref('')
const tab = ref<'list' | 'statistics'>('list')
const selected = computed(() => plans.value.find(plan => plan.id === selectedId.value))
const counts = computed(() => {
  const result = new Map<number, number>()
  for (const schedule of allSchedules.value) result.set(schedule.plan, (result.get(schedule.plan) ?? 0) + 1)
  return result
})
const schedules = computed(() => allSchedules.value.filter(schedule => schedule.plan === selectedId.value).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id))
const months = computed(() => [...new Set(schedules.value.map(schedule => schedule.date.slice(0, 7)))].sort())
const filtered = computed(() => schedules.value.filter(schedule => (!month.value || schedule.date.startsWith(month.value)) && schedule.book.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
const statistics = computed(() => ({
  schedules: filtered.value.length,
  days: new Set(filtered.value.map(schedule => schedule.date)).size,
  books: new Set(filtered.value.map(schedule => schedule.book)).size,
  chapters: filtered.value.reduce((sum, schedule) => sum + schedule.end_chapter - schedule.start_chapter + 1, 0),
  audio: filtered.value.filter(schedule => scheduleLink(schedule.audio_link)).length,
  guide: filtered.value.filter(schedule => scheduleLink(schedule.guide_link)).length,
}))
const scheduleState = computed(() => schedulesLoading.value ? 'loading' : schedulesError.value ? 'error' : 'ready')
function selectPlan(id: number) {
  if (selectedId.value === id) return
  selectedId.value = id
  search.value = ''
  month.value = ''
  tab.value = 'list'
}
async function loadPlans(preferredId?: number) {
  const request = ++planRequest
  plansLoading.value = true
  plansError.value = ''
  try {
    const collected: AdminPlan[] = []
    let page = 1
    // Follow the documented page parameter, never a server-supplied URL origin.
    while (true) {
      const { data } = await api.GET('/api/v1/todos/bible-plans/', { params: { page } })
      if (!alive || request !== planRequest) return
      collected.push(...data.results)
      if (!data.next) break
      page++
    }
    plans.value = collected
    const nextId = preferredId ?? selectedId.value
    if (!collected.some(plan => plan.id === nextId)) {
      selectedId.value = null
      const first = collected.find(plan => plan.is_default) ?? collected[0]
      if (first) selectPlan(first.id)
    } else if (preferredId !== undefined) selectPlan(preferredId)
  } catch (cause) {
    if (alive && request === planRequest) plansError.value = planAdminError(cause)
  } finally {
    if (alive && request === planRequest) plansLoading.value = false
  }
}
async function loadSchedules() {
  const request = ++scheduleRequest
  schedulesLoading.value = true
  schedulesError.value = ''
  try {
    // Staff sees all plans (including inactive) here. The collection is not
    // paginated; using it once supplies truthful counts for every plan card.
    const { data } = await api.GET('/api/v1/todos/schedules/')
    if (!alive || request !== scheduleRequest) return
    allSchedules.value = data
  } catch (cause) {
    if (alive && request === scheduleRequest) schedulesError.value = planAdminError(cause)
  } finally {
    if (alive && request === scheduleRequest) schedulesLoading.value = false
  }
}
async function changePlan(plan: AdminPlan, action: 'default' | 'active') {
  if (busy.value || formOpen.value || plansLoading.value) return
  busy.value = true
  actionError.value = ''
  try {
    if (action === 'default') await api.POST(api.path('/api/v1/todos/bible-plans/{id}/set_default/', { id: plan.id }))
    else await api.POST(api.path('/api/v1/todos/bible-plans/{id}/toggle_active/', { id: plan.id }))
    if (!alive) return
    toast.success('플랜이 변경되었습니다.')
    await loadPlans()
  } catch (cause) {
    if (alive) actionError.value = planAdminError(cause)
  } finally {
    if (alive) busy.value = false
  }
}
async function openForm(kind: 'plan' | 'schedule' | 'upload', plan?: AdminPlan, schedule?: AdminSchedule) {
  if (busy.value || formOpen.value) return
  const id = `plan-admin-${ownerId}`
  ownedModals.add(id)
  formOpen.value = true
  actionError.value = ''
  try {
    await modal.open(AdminPlanFormContent, {
      id, size: kind === 'plan' ? 'md' : 'lg', showCloseButton: false,
      // The mounted form enables idle dismissal and locks it only while saving.
      closeOnEsc: false, closeOnOverlay: false,
      props: { kind, plan, schedule, submit: async (submission: PlanAdminSubmission) => {
        if (!alive) throw new Error('관리자 화면이 닫혔습니다.')
        busy.value = true
        try {
          if (submission.kind === 'plan') {
            const saved = plan
              ? await api.PUT(api.path('/api/v1/todos/bible-plans/{id}/', { id: plan.id }), submission.fields)
              : await api.POST('/api/v1/todos/bible-plans/', submission.fields)
            if (!alive) return
            toast.success('플랜이 저장되었습니다.')
            await loadPlans(plan ? undefined : saved.id)
          } else if (submission.kind === 'schedule' && plan) {
            const body = { ...submission.fields, plan: plan.id }
            if (schedule) await api.PUT(api.path('/api/v1/todos/schedules/{id}/', { id: schedule.id }), body)
            else await api.POST('/api/v1/todos/schedules/', body)
            if (!alive) return
            toast.success('일정이 저장되었습니다.')
            await loadSchedules()
          } else if (submission.kind === 'upload' && plan) {
            const body = new FormData()
            body.append('file', submission.file)
            body.append('plan_id', String(plan.id))
            body.append('update_mode', submission.mode)
            const result = await api.POST('/api/v1/todos/schedules/upload-excel/', body)
            if (!alive) return
            if (result.errors?.length) {
              actionError.value = result.errors.join('\n')
              toast.warning(result.detail)
            } else toast.success(result.detail)
            await loadSchedules()
          }
        } finally {
          if (alive) busy.value = false
        }
      } },
    })
  } catch (reason) {
    // Service cancellation is the expected teardown path, not an API failure.
    if (alive && reason instanceof Error) actionError.value = planAdminError(reason)
  } finally {
    ownedModals.delete(id)
    if (alive) formOpen.value = false
  }
}
async function deleteSchedule(schedule: AdminSchedule) {
  if (busy.value || formOpen.value) return
  busy.value = true
  actionError.value = ''
  const confirmation = modal.confirm({ title: '일정 삭제', description: `${schedule.date} · ${schedule.book} ${schedule.start_chapter}-${schedule.end_chapter}장 일정을 삭제하면 연결된 읽기 기록도 삭제됩니다.`, confirmText: '삭제', confirmVariant: 'danger', icon: 'warning' })
  const confirmationId = modal.stack.value.at(-1)?.id
  if (confirmationId) ownedModals.add(confirmationId)
  try {
    if (!await confirmation || !alive) return
    await api.DELETE(api.path('/api/v1/todos/schedules/{id}/', { id: schedule.id }))
    if (!alive) return
    toast.success('일정이 삭제되었습니다.')
    await loadSchedules()
  } catch (cause) {
    if (alive) actionError.value = planAdminError(cause)
  } finally {
    if (confirmationId) ownedModals.delete(confirmationId)
    if (alive) busy.value = false
  }
}
onMounted(() => { void loadPlans(); void loadSchedules() })
onBeforeUnmount(() => {
  alive = false
  planRequest++
  scheduleRequest++
  for (const id of ownedModals) modal.cancel(id)
})
</script>

<template>
  <div class="plans-workspace">
    <section class="plan-pane" aria-labelledby="admin-plans-heading" :aria-busy="plansLoading">
      <header class="section-header">
        <h2 id="admin-plans-heading">플랜</h2>
        <AppButton size="sm" :disabled="busy || formOpen || plansLoading" data-action="new-plan" @click="openForm('plan')"><Plus :size="16" aria-hidden="true" />새 플랜</AppButton>
      </header>
      <div v-if="plansLoading" role="status" class="loading" data-plans-state="loading">
        <span>플랜을 불러오는 중</span><Skeleton v-for="i in 3" :key="i" height="132px" />
      </div>
      <div v-else-if="plansError" role="alert" class="message" data-plans-state="error">
        <p>{{ plansError }}</p><AppButton variant="secondary" data-action="retry-plans" @click="loadPlans()">다시 시도</AppButton>
      </div>
      <div v-else-if="!plans.length" class="message" data-plans-state="empty">등록된 플랜이 없습니다. 새 플랜을 만들어주세요.</div>
      <div v-else class="plan-list" data-plans-state="ready">
        <article v-for="plan in plans" :key="plan.id" class="plan-card" :class="{ selected: selectedId === plan.id }" :data-plan-id="plan.id">
          <button class="plan-select" :aria-pressed="selectedId === plan.id" :data-select-plan="plan.id" @click="selectPlan(plan.id)">
            <span class="plan-title">{{ plan.name }}<span v-if="plan.is_default" class="badge">기본</span><span v-if="!plan.is_active" class="badge inactive">비활성</span></span>
            <span v-if="plan.description" class="plan-description">{{ plan.description }}</span>
            <span class="plan-count">구독 {{ plan.subscriber_count }}명 · <span :data-count-plan="plan.id">{{ schedulesLoading ? '일정 확인 중' : schedulesError ? '일정 확인 실패' : `일정 ${counts.get(plan.id) ?? 0}개` }}</span></span>
          </button>
          <div class="actions">
            <AppButton variant="secondary" size="sm" :disabled="busy || formOpen" :data-edit-plan="plan.id" @click="openForm('plan', plan)">수정</AppButton>
            <AppButton variant="secondary" size="sm" :disabled="busy || formOpen" :data-toggle-plan="plan.id" @click="changePlan(plan, 'active')">{{ plan.is_active ? '비활성' : '활성' }}</AppButton>
            <AppButton v-if="!plan.is_default && plan.is_active" variant="ghost" size="sm" :disabled="busy || formOpen" :data-default-plan="plan.id" @click="changePlan(plan, 'default')">기본 지정</AppButton>
          </div>
        </article>
      </div>
    </section>
    <section id="schedules" class="schedule-pane" aria-labelledby="admin-schedules-heading" :data-schedules-state="scheduleState" :aria-busy="schedulesLoading">
      <header class="section-header">
        <div><h2 id="admin-schedules-heading">일정<span v-if="selected"> · {{ selected.name }}</span></h2><p v-if="selected && scheduleState === 'ready'">{{ schedules.length }}개 일정</p></div>
        <div class="actions">
          <AppButton variant="secondary" size="sm" data-action="upload" :disabled="!selected || busy || formOpen || plansLoading" @click="openForm('upload', selected)"><Upload :size="16" aria-hidden="true" />엑셀 업로드</AppButton>
          <AppButton size="sm" data-action="new-schedule" :disabled="!selected || busy || formOpen || plansLoading" @click="openForm('schedule', selected)"><Plus :size="16" aria-hidden="true" />일정 추가</AppButton>
        </div>
      </header>
      <p v-if="actionError" role="alert" class="message error" data-action-error>{{ actionError }}</p>
      <div v-if="selected" class="filters">
        <div class="segments" role="group" aria-label="일정 보기">
          <button :aria-pressed="tab === 'list'" data-tab="list" @click="tab = 'list'"><CalendarDays :size="16" aria-hidden="true" />일정 목록</button>
          <button :aria-pressed="tab === 'statistics'" data-tab="statistics" @click="tab = 'statistics'"><ChartNoAxesColumn :size="16" aria-hidden="true" />통계</button>
        </div>
        <label class="search"><Search :size="18" aria-hidden="true" /><input v-model="search" name="schedule-search" type="search" aria-label="성경 검색" placeholder="성경 검색" /></label>
        <div class="months" role="group" aria-label="일정 월">
          <button :aria-pressed="month === ''" data-month="" @click="month = ''">전체</button>
          <button v-for="value in months" :key="value" :aria-pressed="month === value" :data-month="value" @click="month = value">{{ value.slice(0, 4) }}년 {{ Number(value.slice(5)) }}월</button>
        </div>
      </div>
      <div v-if="schedulesLoading" role="status" class="loading"><span>일정을 불러오는 중</span><Skeleton v-for="i in 7" :key="i" height="52px" /></div>
      <div v-else-if="schedulesError" role="alert" class="message"><p>{{ schedulesError }}</p><AppButton variant="secondary" data-action="retry-schedules" @click="loadSchedules">다시 시도</AppButton></div>
      <div v-else-if="!selected" class="message" data-schedule-empty="selection">플랜을 선택해주세요.</div>
      <div v-else-if="!schedules.length" class="message" data-schedule-empty="collection">등록된 일정이 없습니다. 일정을 추가하거나 엑셀 파일을 업로드해주세요.</div>
      <div v-else-if="!filtered.length" class="message" data-schedule-empty="filter"><p>검색 조건에 맞는 일정이 없습니다.</p><AppButton variant="secondary" data-action="clear-filters" @click="search = ''; month = ''">필터 초기화</AppButton></div>
      <template v-else>
        <p class="result-count" role="status">검색 결과 {{ filtered.length }}개 · 전체 {{ schedules.length }}개</p>
        <dl v-if="tab === 'statistics'" class="statistics">
          <div><dt>일정</dt><dd data-stat="schedules">{{ statistics.schedules }}</dd></div>
          <div><dt>읽기 날짜</dt><dd data-stat="days">{{ statistics.days }}</dd></div>
          <div><dt>성경 책</dt><dd data-stat="books">{{ statistics.books }}</dd></div>
          <div><dt>장 수 (중복 포함)</dt><dd data-stat="chapters">{{ statistics.chapters }}</dd></div>
          <div><dt>오디오 연결</dt><dd data-stat="audio">{{ statistics.audio }}</dd></div>
          <div><dt>가이드 연결</dt><dd data-stat="guide">{{ statistics.guide }}</dd></div>
        </dl>
        <div v-else class="schedule-table" role="table" aria-label="일정 목록">
          <div class="schedule-row table-heading" role="row"><span v-for="heading in ['날짜', '성경', '범위', '오디오', '가이드', '관리']" :key="heading" role="columnheader">{{ heading }}</span></div>
          <div v-for="schedule in filtered" :key="schedule.id" class="schedule-row" role="row" :data-schedule-id="schedule.id">
            <span role="cell" data-label="날짜">{{ schedule.date }}</span><strong role="cell" data-label="성경">{{ schedule.book }}</strong><span role="cell" data-label="범위">{{ schedule.start_chapter }}-{{ schedule.end_chapter }}장</span>
            <span v-for="link in (['audio_link', 'guide_link'] as const)" :key="link" role="cell" :data-label="link === 'audio_link' ? '오디오' : '가이드'">
              <a v-if="scheduleLink(schedule[link])" :href="scheduleLink(schedule[link])" target="_blank" rel="noopener noreferrer" :aria-label="`${schedule.date} ${schedule.book} ${link === 'audio_link' ? '오디오' : '가이드'} 열기`">연결됨<ExternalLink :size="14" aria-hidden="true" /></a><span v-else>없음</span>
            </span>
            <div role="cell" class="actions" data-label="관리"><AppButton variant="secondary" size="sm" :disabled="busy || formOpen" :data-edit-schedule="schedule.id" :aria-label="`${schedule.date} ${schedule.book} 일정 수정`" @click="openForm('schedule', selected, schedule)">수정</AppButton><AppButton variant="danger" size="sm" :disabled="busy || formOpen" :data-delete-schedule="schedule.id" :aria-label="`${schedule.date} ${schedule.book} 일정 삭제`" @click="deleteSchedule(schedule)">삭제</AppButton></div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.plans-workspace { display: grid; grid-template-columns: 360px minmax(0, 1fr); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); color: var(--color-text-primary); min-width: 0; }
.plan-pane { border-right: 1px solid var(--color-border-default); padding: 20px; min-width: 0; }
.schedule-pane { padding: 24px; min-width: 0; scroll-margin-top: 24px; }
.section-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
h2 { font-size: 18px; margin: 0; overflow-wrap: anywhere; }
.section-header p { margin: 6px 0 0; color: var(--color-text-secondary); font-size: 13px; }
.plan-list, .loading { display: grid; gap: 10px; }
.plan-card { border: 1px solid var(--color-border-default); border-radius: 16px; padding: 14px; }
.plan-card.selected { border-color: var(--color-accent-primary); box-shadow: inset 0 0 0 1px var(--color-accent-primary); }
.plan-select { display: grid; gap: 8px; width: 100%; padding: 0 0 12px; text-align: left; border: 0; background: transparent; color: inherit; cursor: pointer; min-height: 44px; font: inherit; }
.plan-title { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
.badge { background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 11px; padding: 3px 8px; border-radius: var(--radius-pill); }
.badge.inactive { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.plan-description, .plan-count { font-size: 12px; line-height: 1.6; color: var(--color-text-secondary); overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 4px; }
.actions :deep(.app-button--sm) { padding-inline: 10px; }
.filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.segments, .months { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.segments { border-radius: var(--radius-pill); background: var(--color-bg-tertiary); padding: 3px; }
.segments button, .months button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 8px 12px; border-radius: var(--radius-pill); border: 1px solid transparent; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 13px; cursor: pointer; }
.segments button[aria-pressed='true'], .months button[aria-pressed='true'] { background: var(--color-accent-bg); border-color: var(--color-accent-primary); color: var(--color-accent-primary); }
.months { width: 100%; }
.search { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 180px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); padding: 0 12px; color: var(--color-text-secondary); }
.search input { min-width: 0; width: 100%; min-height: 44px; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.message { padding: 24px 12px; font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; }
.error, [role='alert'] { color: var(--color-error); }
.result-count { font-size: 12px; color: var(--color-text-secondary); }
.schedule-table { border: 1px solid var(--color-border-default); border-radius: 16px; overflow-x: auto; }
.schedule-row { display: grid; grid-template-columns: 100px minmax(80px, 1.2fr) 75px 80px 80px 116px; gap: 10px; align-items: center; min-width: 580px; padding: 10px 12px; border-bottom: 1px solid var(--color-border-default); font-size: 13px; font-variant-numeric: tabular-nums; }
.schedule-row:last-child { border-bottom: 0; }
.schedule-row:hover { background: var(--color-bg-primary); }
.table-heading { background: var(--color-bg-primary); color: var(--color-text-secondary); font-size: 12px; font-weight: 700; }
.schedule-row a { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--color-accent-primary); }
.statistics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.statistics div { padding: 20px; border: 1px solid var(--color-border-default); border-radius: 16px; }
.statistics dt { font-size: 12px; color: var(--color-text-secondary); }
.statistics dd { margin: 12px 0 0; font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
@media (max-width: 1023px) {
  .plans-workspace { grid-template-columns: minmax(0, 1fr); }
  .plan-pane { border-right: 0; border-bottom: 1px solid var(--color-border-default); }
  .plan-pane, .schedule-pane { padding: 16px; }
  .schedule-table { border: 0; display: grid; gap: 12px; overflow: visible; }
  .schedule-row { min-width: 0; grid-template-columns: minmax(0, 1fr); border: 1px solid var(--color-border-default); border-radius: 16px; padding: 16px; }
  .schedule-row:last-child { border-bottom: 1px solid var(--color-border-default); }
  .table-heading { display: none; }
  .schedule-row [data-label] { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .schedule-row [data-label]::before { content: attr(data-label); min-width: 52px; font-size: 12px; font-weight: 400; color: var(--color-text-secondary); }
  .statistics { grid-template-columns: minmax(0, 1fr); }
}
</style>
