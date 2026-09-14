<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertCircle, ExternalLink, FileSpreadsheet, Play, RefreshCw, Trash2 } from '@lucide/vue'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import { useToast } from '~/composables/useToast'
import type { ApiResponseBody } from '~/types/api-contract'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import BaseModal from '~/components/ui/modal/BaseModal.vue'

type PlanPage = ApiResponseBody<'/api/v1/todos/bible-plans/', 'get'>
type Plan = PlanPage['results'][number]
type VideoIntro = ApiResponseBody<'/api/v1/todos/video/intro/', 'get'>[number]
type UploadResponse = ApiResponseBody<'/api/v1/todos/video/intro/upload/', 'post'>

const emit = defineEmits<{ 'plan-name-change': [name: string] }>()
const api = useApi()
const modal = useModal()
const toast = useToast()
const plans = ref<Plan[]>([])
const videos = ref<VideoIntro[]>([])
const selectedPlanId = ref<number | null>(null)
const loadingPlans = ref(true)
const loadingVideos = ref(false)
const planError = ref('')
const videoError = ref('')
const deletingId = ref<number | null>(null)
const uploadOpen = ref(false)
const uploading = ref(false)
const uploadPlanId = ref<number | null>(null)
const uploadFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const fileError = ref('')
const uploadError = ref('')
const uploadErrors = ref<string[]>([])
let lifecycle = 0
let videoRequest = 0

const activePlans = computed(() => plans.value.filter(plan => plan.is_active !== false))
const selectedPlan = computed(() => activePlans.value.find(plan => plan.id === selectedPlanId.value) ?? null)
const uploadValid = computed(() => uploadPlanId.value !== null && uploadFile.value !== null && !fileError.value)

function errorDetail(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback
  const candidate = error as { data?: unknown; message?: unknown }
  if (typeof candidate.data === 'object' && candidate.data !== null) {
    const detail = (candidate.data as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail) return detail
  }
  return typeof candidate.message === 'string' && candidate.message ? candidate.message : fallback
}

function rowErrors(error: unknown): string[] {
  if (typeof error !== 'object' || error === null) return []
  const data = (error as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return []
  const errors = (data as { errors?: unknown }).errors
  return Array.isArray(errors) ? errors.filter((item): item is string => typeof item === 'string') : []
}

function setSelectedPlan(planId: number | null): void {
  selectedPlanId.value = planId
  emit('plan-name-change', activePlans.value.find(plan => plan.id === planId)?.name ?? '')
}

async function loadPlans(): Promise<void> {
  const owner = lifecycle
  loadingPlans.value = true
  planError.value = ''
  try {
    const collected: Plan[] = []
    let page = 1
    let next: string | null | undefined
    do {
      const { data } = await api.GET('/api/v1/todos/bible-plans/', { params: { page } })
      if (owner !== lifecycle) return
      collected.push(...data.results)
      next = data.next
      page += 1
    } while (next)

    plans.value = collected
    const retained = activePlans.value.find(plan => plan.id === selectedPlanId.value)
    const initial = retained ?? activePlans.value.find(plan => plan.is_default) ?? activePlans.value[0] ?? null
    setSelectedPlan(initial?.id ?? null)
    if (initial) await loadVideos(initial.id)
    else videos.value = []
  } catch (error) {
    if (owner !== lifecycle) return
    plans.value = []
    videos.value = []
    setSelectedPlan(null)
    planError.value = errorDetail(error, '플랜 목록을 불러오지 못했어요.')
  } finally {
    if (owner === lifecycle) loadingPlans.value = false
  }
}

async function loadVideos(planId = selectedPlanId.value): Promise<void> {
  const request = ++videoRequest
  if (planId === null) {
    videos.value = []
    videoError.value = ''
    return
  }
  loadingVideos.value = true
  videoError.value = ''
  videos.value = []
  try {
    const { data } = await api.GET('/api/v1/todos/video/intro/', { params: { plan_id: planId } })
    if (request !== videoRequest || planId !== selectedPlanId.value) return
    videos.value = data
  } catch (error) {
    if (request !== videoRequest || planId !== selectedPlanId.value) return
    videoError.value = errorDetail(error, '개론 영상 목록을 불러오지 못했어요.')
  } finally {
    if (request === videoRequest) loadingVideos.value = false
  }
}

function selectPlan(event: Event): void {
  const planId = Number((event.target as HTMLSelectElement).value)
  if (!Number.isInteger(planId) || !activePlans.value.some(plan => plan.id === planId)) return
  setSelectedPlan(planId)
  void loadVideos(planId)
}

async function deleteVideo(intro: VideoIntro): Promise<void> {
  if (deletingId.value !== null) return
  const owner = lifecycle
  deletingId.value = intro.id
  try {
    const confirmed = await modal.confirm({
      title: '개론 영상을 삭제할까요?',
      description: `${intro.book} 개론 영상을 삭제하면 복구할 수 없어요.`,
      confirmText: '삭제',
      cancelText: '취소',
      confirmVariant: 'danger',
      icon: 'warning',
    })
    if (!confirmed || owner !== lifecycle || !videos.value.some(video => video.id === intro.id)) return
    await api.DELETE(api.path('/api/v1/todos/video/intro/{id}/', { id: intro.id }))
    if (owner !== lifecycle) return
    videos.value = videos.value.filter(video => video.id !== intro.id)
    toast.success('개론 영상을 삭제했어요.')
  } catch (error) {
    if (owner === lifecycle) toast.error(errorDetail(error, '개론 영상 삭제에 실패했어요.'))
  } finally {
    if (owner === lifecycle) deletingId.value = null
  }
}

function resetUpload(): void {
  uploadPlanId.value = selectedPlanId.value ?? plans.value[0]?.id ?? null
  uploadFile.value = null
  fileError.value = ''
  uploadError.value = ''
  uploadErrors.value = []
  if (fileInput.value) fileInput.value.value = ''
}

function openUploadModal(): void {
  resetUpload()
  uploadOpen.value = true
}

defineExpose({ openUploadModal })

function setUploadOpen(value: boolean): void {
  if (uploading.value) return
  uploadOpen.value = value
  if (!value) resetUpload()
}

function chooseFile(event: Event): void {
  fileError.value = ''
  uploadError.value = ''
  uploadErrors.value = []
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  uploadFile.value = null
  if (!file) return
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    fileError.value = '엑셀 파일(.xlsx, .xls)만 선택할 수 있어요.'
    input.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    fileError.value = '파일 크기는 5MB를 초과할 수 없어요.'
    input.value = ''
    return
  }
  uploadFile.value = file
}

async function reconcileUploadedPlan(planId: number): Promise<void> {
  const plan = activePlans.value.find(candidate => candidate.id === planId)
  if (!plan) return
  if (selectedPlanId.value !== planId) setSelectedPlan(planId)
  await loadVideos(planId)
}

async function uploadExcel(): Promise<void> {
  if (uploading.value || !uploadValid.value || uploadPlanId.value === null || !uploadFile.value) return
  const owner = lifecycle
  const planId = uploadPlanId.value
  uploadError.value = ''
  uploadErrors.value = []
  uploading.value = true
  const body = new FormData()
  body.append('plan_id', String(planId))
  body.append('file', uploadFile.value)
  try {
    const response: UploadResponse = await api.POST('/api/v1/todos/video/intro/upload/', body)
    if (owner !== lifecycle) return
    const errors = response.errors?.filter((item): item is string => typeof item === 'string') ?? []
    uploadErrors.value = errors
    await reconcileUploadedPlan(planId)
    if (owner !== lifecycle) return
    if (errors.length) {
      toast.warning(response.detail)
      return
    }
    toast.success(response.detail)
    uploadOpen.value = false
    resetUpload()
  } catch (error) {
    if (owner !== lifecycle) return
    uploadError.value = errorDetail(error, '엑셀 업로드에 실패했어요.')
    uploadErrors.value = rowErrors(error)
    toast.error(uploadError.value)
  } finally {
    if (owner === lifecycle) uploading.value = false
  }
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day))
}

onMounted(loadPlans)
onBeforeUnmount(() => {
  lifecycle += 1
  videoRequest += 1
})
</script>

<template>
  <section class="admin-video-workspace" data-admin-video-workspace="true" aria-label="개론 영상 목록">
    <div v-if="loadingPlans" class="video-card-grid" data-video-state="plans-loading" role="status" aria-label="플랜과 개론 영상 불러오는 중" aria-busy="true">
      <div v-for="index in 6" :key="index" class="video-card video-card-skeleton">
        <Skeleton height="auto" radius="0" class="thumbnail-skeleton" />
        <div class="skeleton-copy"><Skeleton width="52%" :height="18" /><Skeleton width="78%" /><Skeleton :height="44" rounded="full" /></div>
      </div>
    </div>

    <div v-else-if="planError" class="state-card" data-plan-error="true" role="alert">
      <AlertCircle :size="28" aria-hidden="true" />
      <p>{{ planError }}</p>
      <AppButton variant="secondary" @click="loadPlans"><RefreshCw :size="18" aria-hidden="true" />다시 시도</AppButton>
    </div>

    <template v-else>
      <div class="plan-filter">
        <label for="admin-video-plan">플랜</label>
        <select id="admin-video-plan" data-plan-select="true" :value="selectedPlanId ?? ''" :disabled="loadingVideos || !activePlans.length" @change="selectPlan">
          <option v-if="!activePlans.length" value="">선택 가능한 활성 플랜이 없습니다</option>
          <option v-for="plan in activePlans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
        </select>
      </div>

      <div v-if="loadingVideos" class="video-card-grid" data-video-state="loading" role="status" aria-label="개론 영상 불러오는 중" aria-busy="true">
        <div v-for="index in 6" :key="index" class="video-card video-card-skeleton">
          <Skeleton height="auto" radius="0" class="thumbnail-skeleton" />
          <div class="skeleton-copy"><Skeleton width="52%" :height="18" /><Skeleton width="78%" /><Skeleton :height="44" rounded="full" /></div>
        </div>
      </div>

      <div v-else-if="videoError" class="state-card" data-video-error="true" role="alert">
        <AlertCircle :size="28" aria-hidden="true" />
        <p>{{ videoError }}</p>
        <AppButton data-retry-videos="true" variant="secondary" @click="loadVideos()"><RefreshCw :size="18" aria-hidden="true" />다시 시도</AppButton>
      </div>

      <div v-else-if="!videos.length" class="state-card" data-video-empty="true">
        <FileSpreadsheet :size="30" aria-hidden="true" />
        <p>{{ selectedPlan ? '이 플랜에 등록된 개론 영상이 없어요.' : '개론 영상을 표시할 활성 플랜이 없어요.' }}</p>
      </div>

      <div v-else class="video-card-grid">
        <article v-for="intro in videos" :key="intro.id" class="video-card" :data-video-intro="intro.id">
          <div class="video-placeholder" aria-hidden="true"><Play :size="24" fill="currentColor" /></div>
          <div class="video-card-copy">
            <div class="video-card-heading">
              <h2>{{ intro.book }} 개론</h2>
              <span>{{ formatDate(intro.start_date) }} - {{ formatDate(intro.end_date) }}</span>
            </div>
            <p class="video-plan-name">{{ intro.plan_name }}</p>
            <a class="video-url" :href="intro.url_link" target="_blank" rel="noopener noreferrer">{{ intro.url_link }}</a>
            <div class="video-actions">
              <AppButton :to="intro.url_link" target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
                <ExternalLink :size="16" aria-hidden="true" />링크 열기
              </AppButton>
              <AppButton :data-delete-video="intro.id" variant="danger" size="sm" :disabled="deletingId !== null" :loading="deletingId === intro.id" @click="deleteVideo(intro)">
                <Trash2 :size="16" aria-hidden="true" />삭제
              </AppButton>
            </div>
          </div>
        </article>
      </div>
    </template>

    <BaseModal :model-value="uploadOpen" title="영상 개론 엑셀 업로드" size="lg" :close-on-overlay="!uploading" :close-on-esc="!uploading" @update:model-value="setUploadOpen">
      <form class="upload-form" @submit.prevent="uploadExcel">
        <label for="video-upload-plan">플랜 선택</label>
        <select id="video-upload-plan" data-upload-plan="true" :value="uploadPlanId ?? ''" :disabled="uploading" required @change="uploadPlanId = Number(($event.target as HTMLSelectElement).value)">
          <option value="" disabled>플랜을 선택하세요</option>
          <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}{{ plan.is_active === false ? ' (비활성)' : '' }}</option>
        </select>

        <label for="video-upload-file">엑셀 파일</label>
        <input id="video-upload-file" ref="fileInput" data-upload-file="true" type="file" accept=".xlsx,.xls" :disabled="uploading" required @change="chooseFile">
        <p class="field-help">최대 5MB의 .xlsx 또는 .xls 파일을 선택하세요.</p>
        <p v-if="fileError" class="field-error" data-file-error="true" role="alert">{{ fileError }}</p>

        <div class="upload-guide">
          <FileSpreadsheet :size="20" aria-hidden="true" />
          <div><strong>필수 열</strong><p>시작일, 종료일, 성경, URL</p></div>
        </div>

        <div v-if="uploading" class="upload-progress" data-upload-progress="true" role="progressbar" aria-label="엑셀 업로드 중" aria-valuetext="서버에서 파일 처리 중">
          <span />
        </div>
        <p v-if="uploadError" class="upload-message" data-upload-error="true" role="alert">{{ uploadError }}</p>
        <div v-if="uploadErrors.length" class="upload-errors" data-upload-errors="true" role="alert">
          <strong>확인이 필요한 행 {{ uploadErrors.length }}건</strong>
          <ul><li v-for="(error, index) in uploadErrors" :key="index">{{ error }}</li></ul>
        </div>
      </form>
      <template #footer>
        <div class="modal-actions">
          <AppButton variant="ghost" :disabled="uploading" @click="setUploadOpen(false)">취소</AppButton>
          <AppButton data-upload-submit="true" :disabled="!uploadValid" :loading="uploading" @click="uploadExcel">업로드</AppButton>
        </div>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.admin-video-workspace { min-width: 0; color: var(--color-text-primary); }
.plan-filter { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.plan-filter label, .upload-form > label { color: var(--color-text-secondary); font-size: 13px; font-weight: 700; }
.plan-filter select, .upload-form select, .upload-form input[type="file"] {
  box-sizing: border-box; min-width: 0; min-height: var(--hit-min); padding: 8px 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; font-size: 13px;
}
.plan-filter select { width: min(100%, 360px); }
.plan-filter select:focus-visible, .upload-form select:focus-visible, .upload-form input:focus-visible, .video-url:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary);
}
.video-card-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.video-card { min-width: 0; overflow: hidden; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); box-shadow: var(--shadow-card); transition: border-color var(--duration-micro) ease, box-shadow var(--duration-micro) ease, transform var(--duration-micro) ease; }
.video-card:hover { border-color: var(--color-border-dark); box-shadow: var(--shadow-card-hover); transform: translateY(-1px); }
.video-placeholder, .thumbnail-skeleton { aspect-ratio: 16 / 9; }
.video-placeholder { display: grid; place-items: center; color: var(--color-text-inverse); background: linear-gradient(160deg, var(--color-video-gradient-start), var(--color-video-gradient-end)); }
.video-card-copy, .skeleton-copy { display: flex; flex-direction: column; gap: 8px; padding: 14px; }
.video-card-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.video-card-heading h2 { min-width: 0; margin: 0; font-size: 14px; font-weight: 700; line-height: 1.4; letter-spacing: var(--tracking-display); overflow-wrap: anywhere; }
.video-card-heading span { flex: none; color: var(--color-text-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.video-plan-name { margin: 0; color: var(--color-text-secondary); font-size: 12px; }
.video-url { display: block; min-height: var(--hit-min); padding-block: 4px; overflow: hidden; color: var(--color-text-tertiary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 36px; text-overflow: ellipsis; white-space: nowrap; }
.video-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.video-actions :deep(.app-button) { min-height: var(--hit-min); }
.state-card { display: flex; flex-direction: column; align-items: center; gap: 14px; min-height: 220px; padding: 28px 20px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); color: var(--color-text-secondary); text-align: center; }
.state-card > svg { color: var(--color-accent-primary); }
.state-card p { margin: auto 0 0; font-size: 14px; line-height: 1.5; }
.upload-form { display: flex; flex-direction: column; gap: 8px; }
.upload-form > label:not(:first-child) { margin-top: 8px; }
.upload-form input[type="file"] { width: 100%; padding: 6px; }
.field-help, .field-error, .upload-message { margin: 0; font-size: 12px; line-height: 1.5; }
.field-help { color: var(--color-text-tertiary); }
.field-error, .upload-message { color: var(--color-error); }
.upload-guide { display: flex; align-items: flex-start; gap: 10px; margin-top: 8px; padding: 12px; border-radius: var(--radius-control); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 12px; }
.upload-guide svg { flex: none; }
.upload-guide strong, .upload-guide p { margin: 0; line-height: 1.5; }
.upload-progress { height: 4px; margin-top: 8px; overflow: hidden; border-radius: var(--radius-pill); background: var(--color-bg-tertiary); }
.upload-progress span { display: block; width: 45%; height: 100%; border-radius: inherit; background: var(--color-accent-primary); animation: upload-progress 1s ease-in-out infinite alternate; }
.upload-errors { max-height: 160px; overflow-y: auto; padding: 12px; border: 1px solid var(--color-error); border-radius: var(--radius-control); background: var(--color-error-bg); color: var(--color-error-text); font-size: 12px; line-height: 1.5; }
.upload-errors ul { margin: 6px 0 0; padding-left: 18px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
@keyframes upload-progress { from { transform: translateX(-100%); } to { transform: translateX(225%); } }
@media (min-width: 1024px) {
  .video-card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .video-card { transition: none; }
  .video-card:hover { transform: none; }
  .upload-progress span { animation: none; width: 100%; }
}
</style>
