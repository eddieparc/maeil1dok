<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { ExternalLink, Pencil, Play, RefreshCw } from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import type { components } from '~/types/generated/api-schema'
import type { ApiQueryParameters } from '~/types/api-contract'
import AppButton from '~/components/ui/AppButton.vue'
import SegmentedControl from '~/components/ui/SegmentedControl.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import HasenaSummaryEditor from './HasenaSummaryEditor.vue'

type Summary = components['schemas']['HasenaSummaryListItem']
type Filter = NonNullable<ApiQueryParameters<'/api/v1/todos/hasena/summaries/', 'get'>['status']>
const statusLabels: Record<Summary['status'], string> = { reviewed: '검수 완료', review_needed: '검수 필요', failed: '생성 실패' }
const auth = useAuthService()
const api = useApi()
const modal = useModal()
const instanceId = useId()
const editorId = `hasena-editor-${instanceId}`
const filterId = `hasena-filter-${instanceId}`
const panelId = `hasena-results-${instanceId}`
const selectedFilter = ref<Filter>('all')
const filters = [
  { value: 'all', label: '전체', id: `${filterId}-all`, controls: panelId },
  { value: 'review_needed', label: '검수 필요', id: `${filterId}-review_needed`, controls: panelId },
  { value: 'failed', label: '실패', id: `${filterId}-failed`, controls: panelId },
]
const summaries = ref<Summary[]>([])
const total = ref<number | null>(null)
const page = ref(0)
const pageSize = 20
const loading = ref(false)
const listError = ref('')
const failedReset = ref(true)
const operationError = ref('')
const notice = ref('')
const regenerating = ref<string | null>(null)
const editing = ref(false)
let alive = true
const authorized = computed(() => auth.isInitialized.value && !auth.isLoading.value && !auth.isSessionUnknown.value && auth.isAuthenticated.value && auth.isStaff.value)
const busy = computed(() => loading.value || regenerating.value !== null || editing.value)
// Pagination advances only on a successful server page, not on click or row count.
const hasMore = computed(() => total.value !== null && page.value * pageSize < total.value)
const state = computed(() => loading.value && page.value === 0 ? 'loading' : page.value === 0 && listError.value ? 'error' : 'ready')
const canAct = () => alive && authorized.value
const message = (error: unknown, fallback: string) => error instanceof Error ? `${fallback} ${error.message}` : fallback

onMounted(() => fetchSummaries())
onBeforeUnmount(() => {
  alive = false
  if (modal.isModalOpen(editorId)) modal.cancel(editorId)
})

async function fetchSummaries(reset = true): Promise<void> {
  if (!canAct() || loading.value) return
  loading.value = true
  listError.value = ''
  const requestedPage = reset ? 1 : page.value + 1
  try {
    const { data } = await api.GET('/api/v1/todos/hasena/summaries/', { params: { status: selectedFilter.value, page: requestedPage, page_size: pageSize } })
    if (!canAct()) return
    if (!data.success) throw new Error('서버에서 목록을 반환하지 않았어요.')
    const rows = reset ? [] : summaries.value
    summaries.value = [...new Map([...rows, ...data.summaries].map(row => [row.video_id, row])).values()]
    total.value = data.total
    page.value = data.page
    operationError.value = ''
  } catch (error) {
    if (canAct()) {
      failedReset.value = reset
      listError.value = message(error, '요약 목록을 불러오지 못했어요.')
    }
  } finally {
    if (alive) loading.value = false
  }
}
function selectFilter(value: string | number) {
  // Filters share the mutation/pagination lock, so an old page cannot land in
  // another filter. A failed new filter never displays the previous total/rows.
  if (!canAct() || busy.value || value === selectedFilter.value) return
  if (value !== 'all' && value !== 'review_needed' && value !== 'failed') return
  selectedFilter.value = value
  summaries.value = []
  total.value = null
  page.value = 0
  operationError.value = ''
  notice.value = ''
  return fetchSummaries()
}
function loadMore() {
  if (!busy.value && hasMore.value && !(listError.value && failedReset.value)) return fetchSummaries(false)
}
async function edit(summary: Summary): Promise<void> {
  if (!canAct() || busy.value || !summary.has_summary) return
  editing.value = true
  operationError.value = ''
  notice.value = ''
  try {
    const saved = await modal.open<boolean>(HasenaSummaryEditor, {
      id: editorId, size: 'lg', position: 'center',
      // The editor synchronizes this instance's ESC/overlay policy with saving
      // and guards its own close buttons. Auth unmount still cancels.
      closeOnEsc: false, closeOnOverlay: false, showCloseButton: false,
      props: { videoId: summary.video_id },
    })
    if (saved && canAct()) {
      notice.value = '검수 완료로 저장했어요. 현재 필터의 서버 목록을 다시 확인합니다.'
      await fetchSummaries()
    }
  } catch (error) {
    // The shared modal rejects with undefined on user dismissal/unmount.
    if (error !== undefined && canAct()) operationError.value = message(error, '수정 창을 닫는 중 오류가 발생했어요.')
  } finally {
    if (alive) editing.value = false
  }
}
async function regenerate(videoId: string): Promise<void> {
  if (!canAct() || busy.value) return
  regenerating.value = videoId
  operationError.value = ''
  notice.value = ''
  try {
    const data = await api.POST('/api/v1/todos/hasena/summaries/regenerate/', { video_id: videoId } satisfies components['schemas']['HasenaSummaryRegenerateRequest'])
    if (!canAct()) return
    if (!data.success) throw new Error('서버에서 재생성 결과를 반환하지 않았어요.')
    notice.value = '재생성했어요. 검수 필요 목록에서 새 요약을 확인해주세요.'
    await fetchSummaries()
  } catch (error) {
    if (!canAct()) return
    // useApi throws non-2xx bodies. Only an explicit persisted failure warrants
    // an automatic list read; transport/DB ambiguity remains read-only retryable.
    const failure = error instanceof Error && 'data' in error ? error.data : null
    const persistedFailure = typeof failure === 'object' && failure !== null
      && 'failure_persisted' in failure && failure.failure_persisted === true
      && 'status' in failure && failure.status === 'failed'
    if (persistedFailure) await fetchSummaries()
    if (canAct()) operationError.value = message(error, persistedFailure
      ? '재생성에 실패했어요. 기존 요약은 유지됩니다.'
      : '재생성 결과를 확인하지 못했어요. 목록을 새로고침해 결과를 확인하거나 다시 시도해주세요.')
  } finally {
    if (alive) regenerating.value = null
  }
}
</script>

<template>
  <section class="hasena-content" :data-hasena-state="state" :aria-busy="loading || undefined">
    <header class="hasena-toolbar">
      <p>영상별 자동 요약을 확인하고 수정합니다<span v-if="total !== null"> · 총 <strong data-hasena-total>{{ total }}</strong>건</span></p>
      <SegmentedControl :model-value="selectedFilter" :options="filters" :disabled="busy" aria-label="요약 필터" @update:model-value="selectFilter" />
    </header>
    <p v-if="notice" class="hasena-notice" role="status">{{ notice }}</p>
    <div v-if="operationError" data-hasena-operation-error class="hasena-error" role="alert">
      <p>{{ operationError }}</p>
      <AppButton data-hasena-refresh variant="secondary" :disabled="busy" @click="fetchSummaries()">목록 새로고침</AppButton>
    </div>

    <div :id="panelId" role="tabpanel" :aria-labelledby="`${filterId}-${selectedFilter}`" class="hasena-results">
      <div v-if="state === 'loading'" class="hasena-skeletons" role="status" aria-label="AI 요약 불러오는 중">
        <Skeleton v-for="index in 4" :key="index" :height="132" />
      </div>
      <div v-if="listError" class="hasena-error" role="alert" data-hasena-list-error>
        <p>{{ listError }}</p>
        <AppButton v-if="failedReset || !hasMore" data-hasena-retry variant="secondary" :disabled="busy" @click="fetchSummaries(failedReset)">다시 시도</AppButton>
      </div>
      <p v-if="state === 'ready' && total === 0" data-hasena-empty class="hasena-empty">조건에 맞는 AI 요약이 없어요.</p>
      <article v-for="summary in summaries" :key="summary.video_id" class="hasena-row" :data-hasena-row="summary.video_id">
        <a class="hasena-video" :href="`https://www.youtube.com/watch?v=${encodeURIComponent(summary.video_id)}`" target="_blank" rel="noopener noreferrer" :aria-label="`${summary.title || summary.video_id} 영상 보기 (새 창)`">
          <img :src="`https://i.ytimg.com/vi/${encodeURIComponent(summary.video_id)}/mqdefault.jpg`" alt="" loading="lazy" width="140" height="79" />
          <Play :size="24" aria-hidden="true" />
          <ExternalLink :size="14" class="hasena-external" aria-hidden="true" />
        </a>
        <div class="hasena-copy">
          <div class="hasena-meta">
            <time v-if="summary.video_date" :data-hasena-video-date="summary.video_date" :datetime="summary.video_date">{{ summary.video_date }}</time>
            <span v-else>영상 날짜 없음</span>
            <span class="hasena-badge" :data-hasena-status="summary.status" :data-hasena-edited="summary.is_edited">{{ statusLabels[summary.status] }}</span>
            <span v-if="regenerating === summary.video_id" data-hasena-operation="pending" role="status">재생성 중…</span>
          </div>
          <h2>{{ summary.title || summary.video_id }}</h2>
          <p v-if="summary.has_summary" data-hasena-preview class="hasena-preview">{{ summary.summary_preview }}</p>
          <p v-else class="hasena-preview">저장된 요약이 없어요. 재생성으로 다시 시도해주세요.</p>
          <p v-if="summary.error_message" :data-hasena-failure="summary.error_code" class="hasena-failure">{{ summary.error_message }}</p>
          <p class="hasena-model"><span v-if="summary.model_used" :data-hasena-model="summary.model_used">{{ summary.model_used }} · </span>{{ summary.status === 'failed' ? '실패 기록 갱신' : '요약 갱신' }} <time :datetime="summary.updated_at">{{ summary.updated_at }}</time></p>
        </div>
        <div class="hasena-actions">
          <AppButton size="sm" variant="secondary" :data-hasena-edit="summary.video_id" :disabled="busy || !summary.has_summary" @click="edit(summary)"><Pencil :size="16" aria-hidden="true" />수정</AppButton>
          <AppButton size="sm" variant="ghost" :data-hasena-regenerate="summary.video_id" :disabled="busy" :loading="regenerating === summary.video_id" @click="regenerate(summary.video_id)"><RefreshCw v-if="regenerating !== summary.video_id" :size="16" aria-hidden="true" />{{ regenerating === summary.video_id ? '재생성 중…' : '재생성' }}</AppButton>
        </div>
      </article>
      <footer v-if="hasMore" class="hasena-pagination">
        <span>{{ summaries.length }} / {{ total }}건 표시</span>
        <AppButton data-hasena-more variant="secondary" :disabled="busy || Boolean(listError && failedReset)" :loading="loading" @click="loadMore">{{ listError ? '더 불러오기 다시 시도' : '더 불러오기' }}</AppButton>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.hasena-content { display: grid; gap: 16px; min-width: 0; }
.hasena-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.hasena-toolbar p, .hasena-model { margin: 0; color: var(--color-text-secondary); font-size: 12px; line-height: 1.5; }
.hasena-notice { margin: 0; color: var(--color-accent-primary); font-size: 14px; }
.hasena-results, .hasena-skeletons { display: grid; gap: 12px; }
.hasena-row { display: grid; grid-template-columns: 140px minmax(0, 1fr) auto; gap: 20px; align-items: center; padding: var(--card-padding); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); }
.hasena-row:hover { background: var(--color-bg-hover); }
.hasena-video { position: relative; display: grid; place-items: center; width: 140px; aspect-ratio: 16 / 9; min-height: var(--hit-min); min-width: var(--hit-min); border-radius: var(--radius-control); overflow: hidden; color: var(--color-text-secondary); background: var(--color-bg-tertiary); }
.hasena-video img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.hasena-video > svg { position: relative; padding: 4px; box-sizing: content-box; border-radius: var(--radius-pill); color: var(--color-text-inverse); background: var(--color-accent-primary); }
.hasena-video .hasena-external { position: absolute; right: 4px; bottom: 4px; }
.hasena-video:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.hasena-copy { min-width: 0; overflow-wrap: anywhere; }
.hasena-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--color-text-secondary); font-size: 12px; }
.hasena-badge { padding: 4px 8px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); color: var(--color-warning); font-size: 11px; font-weight: 700; }
.hasena-badge[data-hasena-status="reviewed"] { background: var(--color-accent-bg); color: var(--color-accent-primary); }
[data-theme="dark"] .hasena-badge[data-hasena-status="reviewed"] { background: transparent; border-color: var(--color-accent-primary); }
.hasena-badge[data-hasena-status="failed"] { color: var(--color-error); border-color: var(--color-error); }
.hasena-failure { margin: 0 0 8px; color: var(--color-error); font-size: 12px; line-height: 1.5; }
.hasena-copy h2 { margin: 8px 0 4px; font-size: 15px; font-weight: 700; line-height: 1.4; }
.hasena-preview { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin: 0 0 8px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; white-space: pre-line; }
.hasena-model { font-size: 11px; }
.hasena-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.hasena-error { padding: 16px; color: var(--color-error); background: var(--color-error-bg); border-radius: var(--radius-control); overflow-wrap: anywhere; }
.hasena-error p { margin: 0 0 12px; }
.hasena-empty { padding: 40px 20px; text-align: center; color: var(--color-text-secondary); }
.hasena-pagination { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 12px; color: var(--color-text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
@media (max-width: 1023px) {
  .hasena-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .hasena-toolbar { align-items: stretch; flex-direction: column; }
  .hasena-actions { justify-content: flex-end; }
}
</style>
