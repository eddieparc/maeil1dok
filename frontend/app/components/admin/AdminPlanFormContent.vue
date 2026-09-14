<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import AppButton from '~/components/ui/AppButton.vue'
import { useModal } from '~/composables/useModal'
import { planAdminError, scheduleLink, type AdminPlan, type AdminSchedule, type PlanAdminSubmission } from './planAdmin'

const props = defineProps<{
  modalId: string
  kind: 'plan' | 'schedule' | 'upload'
  plan?: AdminPlan
  schedule?: AdminSchedule
  submit: (submission: PlanAdminSubmission) => Promise<void>
}>()
const modal = useModal()
const busy = ref(false)
// The shared host owns Escape/scrim cancellation. Lock its registered instance
// synchronously before submitting, through both the write and caller refresh.
const modalOptions = modal.stack.value.find(instance => instance.id === props.modalId)!.options
watch(busy, pending => {
  modalOptions.closeOnEsc = !pending
  modalOptions.closeOnOverlay = !pending
}, { immediate: true, flush: 'sync' })
const error = ref('')
let alive = true
onBeforeUnmount(() => { alive = false })
const title = computed(() => props.kind === 'plan' ? (props.plan ? '플랜 수정' : '새 플랜') : props.kind === 'schedule' ? (props.schedule ? '일정 수정' : '일정 추가') : '엑셀 업로드')
const form = reactive({
  name: props.plan?.name ?? '', description: props.plan?.description ?? '',
  date: props.schedule?.date ?? '', book: props.schedule?.book ?? '',
  start_chapter: props.schedule?.start_chapter ?? 1, end_chapter: props.schedule?.end_chapter ?? 1,
  audio_link: props.schedule?.audio_link ?? '', guide_link: props.schedule?.guide_link ?? '',
})
const file = ref<File | null>(null)
const mode = ref<'update' | 'replace'>('update')
function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  error.value = ''
  if (file.value && (!/\.xlsx?$/i.test(file.value.name) || file.value.size > 5 * 1024 * 1024)) {
    file.value = null
    input.value = ''
    error.value = '5MB 이하의 .xlsx 또는 .xls 파일을 선택해주세요.'
  }
}
async function save() {
  if (busy.value) return
  error.value = ''
  let submission: PlanAdminSubmission
  if (props.kind === 'plan') {
    if (!form.name.trim() || form.name.trim().length > 100) {
      error.value = '플랜 이름을 1~100자로 입력해주세요.'
      return
    }
    submission = { kind: 'plan', fields: { name: form.name.trim(), description: form.description.trim() } }
  } else if (props.kind === 'schedule') {
    const date = new Date(`${form.date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== form.date || form.date.startsWith('0000') || !form.book.trim() || form.book.trim().length > 50) {
      error.value = '유효한 날짜와 성경 이름(1~50자)을 입력해주세요.'
      return
    }
    if (!Number.isInteger(form.start_chapter) || !Number.isInteger(form.end_chapter) || form.start_chapter < 1 || form.end_chapter < form.start_chapter) {
      error.value = '시작 장은 1 이상의 정수, 끝 장은 시작 장 이상의 정수여야 합니다.'
      return
    }
    if ([form.audio_link, form.guide_link].some(link => link.trim() && (!scheduleLink(link.trim()) || link.trim().length > 200))) {
      error.value = '링크는 200자 이하의 http:// 또는 https:// 주소여야 합니다.'
      return
    }
    submission = { kind: 'schedule', fields: { date: form.date, book: form.book.trim(), start_chapter: form.start_chapter, end_chapter: form.end_chapter, audio_link: form.audio_link.trim(), guide_link: form.guide_link.trim() } }
  } else {
    if (!file.value) { error.value = '엑셀 파일을 선택해주세요.'; return }
    submission = { kind: 'upload', file: file.value, mode: mode.value }
  }
  busy.value = true
  try {
    await props.submit(submission)
    if (alive) modal.close(props.modalId, true)
  } catch (cause) {
    if (alive) error.value = planAdminError(cause)
  } finally {
    if (alive) busy.value = false
  }
}
</script>

<template>
  <form class="plan-admin-form" novalidate :aria-busy="busy" @submit.prevent="save">
    <h2 :id="`modal-title-${modalId}`">{{ title }}</h2>
    <p v-if="kind !== 'plan' && plan" class="context">{{ plan.name }}</p>
    <div class="fields" data-modal-scrollable>
      <template v-if="kind === 'plan'">
        <label>플랜 이름<input v-model="form.name" name="name" required maxlength="100" :disabled="busy" /></label>
        <label>설명<textarea v-model="form.description" name="description" rows="4" :disabled="busy" /></label>
      </template>
      <template v-else-if="kind === 'schedule'">
        <div class="pair">
          <label>날짜<input v-model="form.date" name="date" type="date" required :disabled="busy" /></label>
          <label>성경<input v-model="form.book" name="book" required maxlength="50" :disabled="busy" /></label>
        </div>
        <div class="pair">
          <label>시작 장<input v-model.number="form.start_chapter" name="start_chapter" type="number" min="1" step="1" required :disabled="busy" /></label>
          <label>끝 장<input v-model.number="form.end_chapter" name="end_chapter" type="number" min="1" step="1" required :disabled="busy" /></label>
        </div>
        <label>오디오 링크<input v-model="form.audio_link" name="audio_link" type="url" maxlength="200" placeholder="https://" :disabled="busy" /></label>
        <label>가이드 링크<input v-model="form.guide_link" name="guide_link" type="url" maxlength="200" placeholder="https://" :disabled="busy" /></label>
      </template>
      <template v-else>
        <label>엑셀 파일<input name="file" type="file" accept=".xlsx,.xls" :disabled="busy" @change="chooseFile" /></label>
        <p class="context">최대 5MB · 필수 열: 날짜, 성경, 시작장, 끝장 · 선택 열: 오디오, 가이드</p>
        <p class="context">날짜는 YYYY-MM-DD, YYYY년 MM월 DD일 또는 엑셀 날짜 셀을 사용하세요. 링크는 http:// 또는 https://로 시작해야 합니다.</p>
        <fieldset :disabled="busy">
          <legend>업로드 방식</legend>
          <label class="choice"><input v-model="mode" type="radio" name="mode" value="update" />병합 (같은 날짜·성경은 업데이트)</label>
          <label class="choice"><input v-model="mode" type="radio" name="mode" value="replace" />모든 일정 교체</label>
        </fieldset>
        <p v-if="mode === 'replace'" class="warning">기존 일정과 연결된 읽기 기록이 삭제됩니다. 업로드 전에 파일을 확인해주세요.</p>
      </template>
      <p v-if="error" role="alert" data-form-error class="error">{{ error }}</p>
    </div>
    <footer>
      <AppButton variant="ghost" :disabled="busy" @click="modal.close(modalId, false)">취소</AppButton>
      <AppButton type="submit" :loading="busy">{{ kind === 'upload' ? '업로드' : '저장' }}</AppButton>
    </footer>
  </form>
</template>

<style scoped>
.plan-admin-form { display: flex; flex-direction: column; min-height: 0; padding: 24px; gap: 16px; color: var(--color-text-primary); }
h2 { margin: 0; font-size: 20px; padding-right: 44px; }
.fields { display: grid; gap: 16px; overflow-y: auto; min-height: 0; }
label { display: grid; gap: 8px; font-size: 14px; font-weight: 600; min-width: 0; }
input, textarea { box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; }
textarea { resize: vertical; }
input:focus-visible, textarea:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.context { margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; }
fieldset { border: 1px solid var(--color-border-default); border-radius: var(--radius-control); padding: 12px; }
.choice { display: flex; align-items: center; min-height: 44px; }
.choice input { width: 20px; min-height: 20px; accent-color: var(--color-accent-primary); }
.error, .warning { margin: 0; color: var(--color-error); white-space: pre-wrap; line-height: 1.6; }
footer { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 640px) { .pair { grid-template-columns: 1fr; } .plan-admin-form { padding: 20px; } }
</style>
