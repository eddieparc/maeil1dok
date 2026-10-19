<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import type { components } from '~/types/generated/api-schema'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/Skeleton.vue'

const props = defineProps<{ modalId: string; videoId: string }>()
const auth = useAuthService()
const api = useApi()
const modal = useModal()
const title = ref('')
const summary = ref('')
const loading = ref(false)
const ready = ref(false)
const saving = ref(false)
// This content is mounted by the shared host after its instance is registered.
// Configure that instance, not a competing Escape listener: the shared focus
// trap captures Escape before events can reach the editor's DOM.
const modalOptions = modal.stack.value.find(instance => instance.id === props.modalId)!.options
watch(saving, pending => {
  modalOptions.closeOnEsc = !pending
  modalOptions.closeOnOverlay = !pending
}, { immediate: true, flush: 'sync' })
const error = ref('')
let alive = true
const canAct = () => alive && modal.isModalOpen(props.modalId) && auth.isInitialized.value && !auth.isLoading.value && !auth.isSessionUnknown.value && auth.isAuthenticated.value && auth.isStaff.value
const canSave = computed(() => ready.value && !loading.value && !saving.value && Boolean(summary.value.trim()) && title.value.length <= 200)
const state = computed(() => loading.value ? 'loading' : ready.value ? 'ready' : 'error')
const message = (failure: unknown, fallback: string) => failure instanceof Error ? `${fallback} ${failure.message}` : fallback
onMounted(() => load())
onBeforeUnmount(() => { alive = false })

function cancel() {
  if (!saving.value) modal.cancel(props.modalId)
}
async function load(): Promise<void> {
  if (!canAct() || loading.value || saving.value) return
  loading.value = true
  ready.value = false
  error.value = ''
  try {
    // Never generate while reading an editor; never seed it from the preview.
    const { data } = await api.GET('/api/v1/todos/hasena/summary/', { params: { video_id: props.videoId } })
    if (!canAct()) return
    if (!data.success) throw new Error('서버에서 요약을 반환하지 않았어요.')
    title.value = data.title
    summary.value = data.summary
    ready.value = true
  } catch (failure) {
    if (canAct()) error.value = message(failure, '전체 요약을 불러오지 못했어요.')
  } finally {
    if (alive) loading.value = false
  }
}
async function save(): Promise<void> {
  if (!canAct() || !canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const data = await api.PUT(api.path('/api/v1/todos/hasena/summaries/{video_id}/', { video_id: props.videoId }), { title: title.value, summary: summary.value } satisfies components['schemas']['HasenaSummaryUpdateRequest'])
    if (!canAct()) return
    if (!data.success) throw new Error('서버에서 저장을 확인하지 못했어요.')
    modal.close(props.modalId, true)
  } catch (failure) {
    if (canAct()) error.value = message(failure, '저장 결과를 확인하지 못했어요. 입력 내용은 유지됩니다.')
  } finally {
    if (alive) saving.value = false
  }
}
</script>

<template>
  <div class="hasena-editor" :data-editor-state="state" :aria-busy="loading || saving || undefined">
    <header>
      <div>
        <h2 :id="`modal-title-${modalId}`">AI 요약 수정</h2>
        <p>{{ videoId }}</p>
      </div>
      <AppButton data-editor-close variant="ghost" :disabled="saving" aria-label="닫기" @click="cancel"><X :size="20" aria-hidden="true" /></AppButton>
    </header>
    <div class="hasena-editor-body">
      <div v-if="loading" class="hasena-editor-loading" role="status" aria-label="전체 요약 불러오는 중"><Skeleton :height="44" /><Skeleton :height="200" /></div>
      <div v-if="error" data-editor-error class="hasena-editor-error" role="alert">
        <p>{{ error }}</p>
        <AppButton v-if="!ready" data-editor-retry variant="secondary" :disabled="loading" @click="load">다시 시도</AppButton>
      </div>
      <template v-if="ready">
        <label :for="`${modalId}-title`">영상 제목</label>
        <input :id="`${modalId}-title`" v-model="title" data-editor-title type="text" maxlength="200" :disabled="saving" />
        <label :for="`${modalId}-summary`">요약 내용</label>
        <textarea :id="`${modalId}-summary`" v-model="summary" data-editor-summary rows="10" required :disabled="saving" />
        <p class="hasena-editor-hint">저장하면 검수 완료로 기록되고 이전 생성 실패가 해제됩니다. 재생성하면 다시 검수가 필요해요.</p>
      </template>
    </div>
    <footer>
      <AppButton data-editor-cancel variant="ghost" :disabled="saving" @click="cancel">취소</AppButton>
      <AppButton data-editor-save :disabled="!canSave" :loading="saving" @click="save">{{ saving ? '저장 중…' : '저장' }}</AppButton>
    </footer>
  </div>
</template>

<style scoped>
.hasena-editor { display: flex; flex-direction: column; min-height: 0; max-height: inherit; color: var(--color-text-primary); }
.hasena-editor header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px; border-bottom: 1px solid var(--color-border-default); }
.hasena-editor header > div { min-width: 0; }
.hasena-editor h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: var(--tracking-display); }
.hasena-editor header p { margin: 8px 0 0; color: var(--color-text-secondary); font-size: 12px; overflow-wrap: anywhere; }
.hasena-editor-body { min-height: 0; padding: 20px 24px; overflow-y: auto; display: grid; gap: 12px; }
.hasena-editor-loading { display: grid; gap: 12px; }
.hasena-editor label { font-size: 14px; font-weight: 600; }
.hasena-editor input, .hasena-editor textarea { box-sizing: border-box; width: 100%; min-width: 0; min-height: var(--hit-min); padding: 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-primary); color: var(--color-text-primary); font: inherit; font-size: 14px; line-height: 1.5; }
.hasena-editor textarea { min-height: 200px; resize: vertical; }
.hasena-editor input:focus-visible, .hasena-editor textarea:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.hasena-editor-hint { margin: 0; color: var(--color-text-secondary); font-size: 12px; line-height: 1.5; }
.hasena-editor-error { margin: 0; color: var(--color-error); font-size: 14px; overflow-wrap: anywhere; }
.hasena-editor-error p { margin: 0 0 12px; }
.hasena-editor footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--color-border-default); }
</style>
