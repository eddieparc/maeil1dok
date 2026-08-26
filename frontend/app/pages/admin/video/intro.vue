<template>
  <PageLayout title="성경 영상 개론 관리" fallback-path="/">
    <template #header-action>
      <button v-if="isStaff" @click="openUploadModal" class="btn btn-primary btn-sm">
        엑셀 업로드
      </button>
    </template>

    <!-- 스크롤 영역 -->
    <div class="scroll-area">
      <!-- 인증 초기화 중 -->
      <div v-if="isAuthLoading" class="loading-indicator fade-in">
        <p>인증 정보를 확인하는 중...</p>
      </div>

      <div v-else-if="!authStore.isAuthenticated.value" class="unauthorized-prompt fade-in" style="animation-delay: 0.2s">
        <p class="text-lg text-gray-600 mb-4">
          로그인이 필요한 페이지입니다.
        </p>
        <button @click="$router.push('/login?redirect=/admin/video/intro')" class="login-button">로그인하기</button>
      </div>

      <div v-else-if="!isStaff" class="unauthorized-prompt fade-in" style="animation-delay: 0.2s">
        <p>관리자 권한이 필요한 페이지입니다.</p>
      </div>

      <div v-else class="content-section fade-in" style="animation-delay: 0.2s">
        <!-- 플랜 선택 필터 -->
        <div class="filter-section">
          <label class="filter-label">플랜 선택:</label>
          <select v-model="selectedPlanId" class="plan-select" @change="fetchVideoIntros">
            <option value="">모든 플랜</option>
            <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select>
        </div>

        <!-- 영상 개론 목록 -->
        <div v-if="loading" class="loading-indicator">
          <p>데이터를 불러오는 중...</p>
        </div>

        <div v-else-if="videoIntros.length === 0" class="empty-state">
          <p>등록된 영상 개론이 없습니다.</p>
          <p class="empty-state-hint">엑셀 업로드 버튼을 눌러 영상 개론을 추가해보세요.</p>
        </div>

        <div v-else class="video-intro-grid">
          <div v-for="intro in videoIntros" :key="intro.id" class="video-intro-card">
            <div class="video-intro-card-content">
              <div class="card-layout">
                <div class="card-info">
                  <h3 class="video-intro-title">{{ intro.book }}</h3>
                  <p class="video-intro-period">
                    {{ formatDate(intro.start_date) }} ~ {{ formatDate(intro.end_date) }}
                  </p>
                  <p class="video-intro-plan">
                    플랜: {{ intro.plan_name }}
                  </p>
                  <div class="video-intro-link">
                    <a :href="intro.url_link" target="_blank" rel="noopener noreferrer" class="link-button">
                      영상 보기
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round" />
                        <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round" />
                      </svg>
                    </a>
                  </div>
                </div>
                <div class="card-actions">
                  <button @click="deleteVideoIntro(intro.id)" class="action-button delete">삭제</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 업로드 모달 -->
    <BaseModal
      v-model="showUploadModal"
      title="영상 개론 엑셀 업로드"
      size="lg"
      :close-on-overlay="!uploading"
      :close-on-esc="!uploading"
    >
      <form @submit.prevent="uploadExcel" class="space-y-4">
        <div>
          <label class="label">플랜 선택</label>
          <select v-model="uploadForm.planId" class="select select-bordered w-full" required>
            <option value="" disabled>플랜을 선택하세요</option>
            <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select>
        </div>

        <div>
          <label class="label">엑셀 파일</label>
          <input type="file" ref="fileInput" accept=".xlsx, .xls" class="file-input w-full" required
            @change="handleFileChange" />
          <div class="text-xs text-gray-500 mt-1">최대 5MB 크기의 .xlsx 또는 .xls 파일</div>
        </div>

        <div class="mt-4 p-3 bg-[var(--color-accent-primary-light)] rounded-md border border-[var(--color-accent-primary-light)]">
          <p class="text-sm font-medium text-[var(--color-accent-primary)] mb-2">엑셀 파일 작성 방법:</p>
          <ul class="text-xs text-[var(--color-accent-primary)] space-y-1 pl-4 list-disc">
            <li>필수 컬럼: <strong>시작일, 종료일, 성경, URL</strong> (정확히 이 이름으로 작성)</li>
            <li>날짜 형식: 다음 형식 모두 지원
              <ul class="pl-4 mt-1 list-disc">
                <li><strong>YYYY년 MM월 DD일</strong> (예: 2025년 2월 2일)</li>
                <li><strong>YYYY-MM-DD</strong> (예: 2025-02-02)</li>
                <li>일반 엑셀 날짜 셀 형식</li>
              </ul>
            </li>
            <li>URL은 반드시 <strong>http://</strong> 또는 <strong>https://</strong>로 시작해야 함</li>
            <li>성경 이름은 정확히 작성 (예: 창세기, 요한복음 등)</li>
          </ul>
          <div class="mt-3">
            <a href="/sample-video-intro.xlsx" class="text-xs text-[var(--color-accent-primary)] flex items-center hover:underline"
              target="_blank" rel="noopener noreferrer">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                  clip-rule="evenodd"></path>
              </svg>
              샘플 엑셀 파일 다운로드
            </a>
          </div>
        </div>

        <!-- 업로드 오류 메시지 표시 영역 -->
        <div v-if="uploadErrors.length > 0" class="mt-3 p-3 bg-red-50 rounded-md border border-red-100">
          <p class="text-sm font-medium text-red-800 mb-2">
            다음 오류를 확인해주세요 ({{ uploadErrors.length }}건):
          </p>
          <ul class="text-xs text-red-700 space-y-1 pl-4 list-disc max-h-40 overflow-y-auto">
            <li v-for="(error, i) in uploadErrors" :key="i">{{ error }}</li>
          </ul>
        </div>
      </form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" @click="showUploadModal = false" class="btn btn-outline"
            :disabled="uploading">취소</button>
          <button type="button" @click="uploadExcel" class="btn btn-primary" :disabled="uploading || !isUploadFormValid">
            <span v-if="uploading">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
                viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              업로드 중...
            </span>
            <span v-else>업로드</span>
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 토스트 -->
    <Toast ref="toast" />
  </PageLayout>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useToast } from '~/composables/useToast'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import PageLayout from '~/components/common/PageLayout.vue'
import Toast from '~/components/Toast.vue'
import BaseModal from '~/components/ui/modal/BaseModal.vue'

const authStore = useAuthService()
const api = useApi()
const modal = useModal()
const toast = ref(null)

// Toast 컴포넌트 직접 사용
const showToastMessage = async (message, type = 'info') => {
  if (toast.value) {
    toast.value.show(message, type);
  } else {
    await modal.alert({
      title: type === 'error' ? '오류' : type === 'warning' ? '경고' : '알림',
      description: message,
      icon: type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'
    });
  }
}

const plans = ref([])
const videoIntros = ref([])
const selectedPlanId = ref('')
const showUploadModal = ref(false)
const loading = ref(false)
const uploading = ref(false)

const uploadForm = ref({
  planId: '',
  file: null
})

// 새로운 상태 추가
const uploadErrors = ref([])
const fileValidationError = ref('')

// 파일 유효성 검사 계산된 속성 추가
const isUploadFormValid = computed(() => {
  return uploadForm.value.planId && uploadForm.value.file && !fileValidationError.value
})

// 초기화 완료 여부
const isAuthLoading = computed(() => !authStore.isInitialized.value)

// 관리자 권한 체크 - 수정
const isStaff = computed(() => {
  // authStore.user.value는 { id, username, nickname, profile_image, is_staff } 구조
  // is_staff는 user 객체의 직접 속성임
  return authStore.isAuthenticated.value && Boolean(authStore.user.value?.is_staff);
})

// 페이지 접근 권한 체크 - 수정
const checkAccess = async () => {
  if (!isStaff.value) {
    try {
      await showToastMessage('관리자 권한이 필요합니다.', 'error');
    } catch (e) {
      await modal.alert({
        title: '권한 필요',
        description: '관리자 권한이 필요합니다.',
        icon: 'error'
      });
    }
    return false;
  }

  return true;
}

// 플랜 목록 조회 - 수정
const fetchPlans = async () => {
  if (!await checkAccess()) return

  try {
    loading.value = true
    const response = await api.GET('/api/v1/todos/bible-plans/')

    // 응답 구조 처리 - data 속성 확인
    if (response.data && Array.isArray(response.data)) {
      plans.value = response.data
    } else if (Array.isArray(response)) {
      plans.value = response
    } else if (response.results && Array.isArray(response.results)) {
      plans.value = response.results
    } else {
      showToastMessage('플랜 목록 형식이 올바르지 않습니다.', 'error')
    }
  } catch (error) {
    showToastMessage('플랜 목록을 불러오는데 실패했습니다.', 'error')
  } finally {
    loading.value = false
  }
}

// 영상 개론 목록 조회 - 수정
const fetchVideoIntros = async () => {
  if (!await checkAccess()) return

  loading.value = true
  try {

    const selectedPlan = Number(selectedPlanId.value)
    const planId = selectedPlanId.value && Number.isInteger(selectedPlan)
      ? selectedPlan
      : undefined
    const response = await api.GET('/api/v1/todos/video/intro/', {
      params: { plan_id: planId }
    })

    // 응답 구조 처리 - data 속성 확인
    if (Array.isArray(response.data)) {
      videoIntros.value = response.data
    } else {
      showToastMessage('영상 개론 목록 형식이 올바르지 않습니다.', 'error')
    }
  } catch (error) {
    showToastMessage('영상 개론 목록을 불러오는데 실패했습니다.', 'error')
  } finally {
    loading.value = false
  }
}

// 영상 개론 삭제
const deleteVideoIntro = async (id) => {
  const confirmed = await modal.confirm({
    title: '삭제 확인',
    description: '정말 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
    icon: 'warning'
  })
  if (!confirmed) return

  try {
    await api.DELETE(api.path('/api/v1/todos/video/intro/{id}/', { id }))
    showToastMessage('영상 개론이 삭제되었습니다.', 'success')
    fetchVideoIntros()
  } catch (error) {
    showToastMessage('영상 개론 삭제에 실패했습니다.', 'error')
  }
}

// 파일 선택 핸들러 개선
const handleFileChange = (event) => {
  fileValidationError.value = ''
  uploadErrors.value = []

  const file = event.target.files[0]
  if (!file) {
    uploadForm.value.file = null
    return
  }

  // 파일 확장자 검사
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    fileValidationError.value = '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'
    showToastMessage(fileValidationError.value, 'error')
    event.target.value = '' // 입력 초기화
    uploadForm.value.file = null
    return
  }

  // 파일 크기 검사 (5MB 제한)
  if (file.size > 5 * 1024 * 1024) {
    fileValidationError.value = '파일 크기는 5MB를 초과할 수 없습니다.'
    showToastMessage(fileValidationError.value, 'error')
    event.target.value = '' // 입력 초기화
    uploadForm.value.file = null
    return
  }

  uploadForm.value.file = file
}

// 업로드 폼 초기화 함수 개선
const resetUploadForm = () => {
  uploadForm.value = {
    planId: '',
    file: null
  }
  fileValidationError.value = ''
  uploadErrors.value = []

  // 파일 입력 필드 초기화
  if (document.querySelector('input[type="file"]')) {
    document.querySelector('input[type="file"]').value = ''
  }
}

// 모달 표시 함수 개선
const openUploadModal = () => {
  resetUploadForm()
  showUploadModal.value = true
}

// 엑셀 업로드 함수 개선
const uploadExcel = async () => {

  // 폼 유효성 재검사
  if (!uploadForm.value.planId) {
    showToastMessage('플랜을 선택해주세요.', 'error')
    return
  }

  if (!uploadForm.value.file) {
    showToastMessage('엑셀 파일을 선택해주세요.', 'error')
    return
  }

  // 이전 오류 초기화
  uploadErrors.value = []

  uploading.value = true

  try {
    const formData = new FormData()
    formData.append('plan_id', uploadForm.value.planId)
    formData.append('file', uploadForm.value.file)

    // post 대신 upload 메서드 사용
    const response = await api.upload('/api/v1/todos/video/intro/upload/', formData)

    showToastMessage(response.detail, 'success')

    // 에러가 있는 경우 표시하되 모달은 닫지 않음
    if (response.errors && response.errors.length > 0) {
      uploadErrors.value = response.errors
      showToastMessage(`일부 데이터에 오류가 있습니다. 오류 내용을 확인해주세요.`, 'warning')
      // 모달은 유지하고 오류만 표시
    } else {
      // 오류가 없으면 모달 닫고 목록 새로고침
      showUploadModal.value = false
      resetUploadForm()
      fetchVideoIntros()
    }

  } catch (error) {
    // API 오류 응답 처리
    let errorMessage = '업로드에 실패했습니다.';

    if (error.response) {
      // 서버 응답이 있는 경우
      errorMessage = error.response.data?.detail || errorMessage;

      // 오류 배열이 있는 경우
      if (error.response.data?.errors && Array.isArray(error.response.data.errors)) {
        uploadErrors.value = error.response.data.errors;
      }
    } else if (error.detail) {
      errorMessage = error.detail;
    } else if (error.message) {
      errorMessage = error.message;
    }

    showToastMessage(errorMessage, 'error')
  } finally {
    uploading.value = false
  }
}

// 날짜 포맷팅
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 초기 데이터 로드 - 수정
onMounted(async () => {
  // 인증 상태가 이미 로드되었는지 확인
  if (authStore.isAuthenticated.value && authStore.user.value) {
    await nextTick();
    if (await checkAccess()) {
      fetchPlans();
      fetchVideoIntros();
    }
  } else {
    // 인증 상태가 로드될 때까지 기다림
    const unwatch = watch(() => authStore.user.value, async (newUser) => {
      if (newUser) {
        await nextTick();
        if (await checkAccess()) {
          fetchPlans();
          fetchVideoIntros();
        }
        unwatch(); // 감시 중단
      }
    }, { immediate: true });
  }
})

// 인증 상태 변경 감지 유지
watch(() => authStore.isAuthenticated, async (newValue) => {
  if (newValue && isStaff.value) {
    await fetchPlans();
    await fetchVideoIntros();
  } else {
    plans.value = [];
    videoIntros.value = [];
  }
})

// 추가: 사용자 정보 변경 감지
watch(() => authStore.user.value, async (newUser) => {
  if (authStore.isAuthenticated.value && newUser?.is_staff) {
    await fetchPlans();
    await fetchVideoIntros();
  }
}, { deep: true })
</script>

<style scoped>
.create-button {
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.create-button:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.scroll-area {
  padding: 1rem;
}

.unauthorized-prompt {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.filter-section {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  background: white;
  padding: 0.75rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.filter-label {
  font-weight: 500;
  margin-right: 0.5rem;
  color: var(--text-primary);
}

.plan-select {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #E5E7EB;
  border-radius: 0.375rem;
  background: white;
}

.video-intro-grid {
  display: grid;
  gap: 1rem;
}

.video-intro-card {
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
}

.video-intro-card:hover {
  border-color: #D1D5DB;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.video-intro-card-content {
  padding: 1rem;
}

.card-layout {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}

.video-intro-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.video-intro-period {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.video-intro-plan {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.video-intro-link {
  margin-top: 0.5rem;
}

.link-button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: #F3F4F6;
  color: var(--text-primary);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.link-button:hover {
  background: #E5E7EB;
}

.action-button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
  text-align: center;
}

.action-button.delete {
  background: var(--error);
  color: white;
}

.action-button:hover {
  transform: translateY(-1px);
}

.loading-indicator,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.empty-state-hint {
  font-size: 0.875rem;
  color: #6B7280;
  margin-top: 0.5rem;
}

.file-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #E5E7EB;
  border-radius: 0.375rem;
  background: white;
}

/* 애니메이션 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.4s ease-out forwards;
}

.scroll-area,
.create-button {
  --primary-color: var(--color-accent-primary);
  --primary-light: var(--color-accent-primary-light);
  --primary-dark: var(--color-accent-primary-hover);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
}

.label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #E5E7EB;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(97, 116, 117, 0.1);
}

.btn {
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-outline {
  background: white;
  border: 1px solid #E5E7EB;
  color: var(--text-primary);
}

.btn-outline:hover {
  background: #F9FAFB;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .scroll-area {
    padding: 0.75rem;
  }

  .video-intro-card-content {
    padding: 0.75rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
}

/* 애니메이션 스타일 추가 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* 추가 스타일 */
.list-disc {
  list-style-type: disc;
}

.overflow-y-auto {
  overflow-y: auto;
}

.max-h-40 {
  max-height: 10rem;
}
</style>
