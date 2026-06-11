<template>
  <div class="container">
    <PageHeader title="하세나 AI 요약 관리" fallback-path="/" />

    <div class="scroll-area">
      <div v-if="isAuthLoading" class="loading-indicator fade-in">
        <p>인증 정보를 확인하는 중...</p>
      </div>

      <div v-else-if="!authStore.isAuthenticated.value" class="unauthorized-prompt fade-in" role="status">
        <p class="text-lg text-txt-secondary mb-4">로그인이 필요한 페이지입니다.</p>
        <button @click="$router.push('/login?redirect=/admin/hasena')" class="login-button">로그인하기</button>
      </div>

      <div v-else-if="!isStaff" class="unauthorized-prompt fade-in" role="status">
        <p>관리자 권한이 필요한 페이지입니다.</p>
      </div>

      <div v-else class="content-section fade-in">
        <div v-if="loading" class="loading-indicator">
          <p>데이터를 불러오는 중...</p>
        </div>

        <div v-else-if="summaries.length === 0" class="empty-state">
          <p>등록된 AI 요약이 없습니다.</p>
          <p class="empty-state-hint">하세나 페이지에서 영상을 시청하면 AI 요약이 자동으로 생성됩니다.</p>
        </div>

        <div v-else class="summary-list">
          <div v-for="summary in summaries" :key="summary.id" class="summary-card">
            <div class="summary-header">
              <div class="summary-info">
                <span class="video-date">{{ summary.video_date || 'N/A' }}</span>
                <span class="video-id">{{ summary.video_id }}</span>
                <span v-if="summary.is_edited" class="edited-badge">수정됨</span>
              </div>
              <div class="summary-actions">
                <button @click="openEditModal(summary)" class="action-btn edit">수정</button>
                <button @click="regenerateSummary(summary.video_id)" class="action-btn regenerate" :disabled="regenerating === summary.video_id">
                  {{ regenerating === summary.video_id ? '생성 중...' : '재생성' }}
                </button>
                <a :href="`https://www.youtube.com/watch?v=${summary.video_id}`" target="_blank" rel="noopener noreferrer" class="action-btn view">
                  영상 보기
                </a>
              </div>
            </div>
            <div class="summary-preview">
              {{ summary.summary_preview }}
            </div>
            <div class="summary-meta">
              <span>모델: {{ summary.model_used }}</span>
              <span>업데이트: {{ formatDate(summary.updated_at) }}</span>
            </div>
          </div>

          <div v-if="hasMore" class="load-more">
            <button @click="loadMore" :disabled="loadingMore" class="load-more-btn">
              {{ loadingMore ? '로딩 중...' : '더 보기' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 수정 모달 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>AI 요약 수정</h3>
          <button @click="closeEditModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>영상 ID</label>
            <input type="text" :value="editForm.video_id" disabled class="input disabled" />
          </div>
          <div class="form-group">
            <label>제목 (선택)</label>
            <input type="text" v-model="editForm.title" class="input" placeholder="영상 제목" />
          </div>
          <div class="form-group">
            <label>요약 내용</label>
            <textarea v-model="editForm.summary" class="textarea" rows="12" placeholder="요약 내용을 입력하세요"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeEditModal" class="btn-cancel">취소</button>
          <button @click="saveSummary" :disabled="saving" class="btn-save">
            {{ saving ? '저장 중...' : '저장' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'

interface Summary {
  id: number
  video_id: string
  video_date: string | null
  title: string
  summary_preview: string
  is_edited: boolean
  model_used: string
  updated_at: string
}

const authStore = useAuthService()
const api = useApi()

const isAuthLoading = ref(true)
const isStaff = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const summaries = ref<Summary[]>([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const regenerating = ref<string | null>(null)

const showEditModal = ref(false)
const editForm = ref({ video_id: '', title: '', summary: '' })
const saving = ref(false)

const hasMore = computed(() => summaries.value.length < total.value)

onMounted(async () => {
  try {
    if (authStore.isAuthenticated.value) {
      isStaff.value = authStore.isStaff?.value ?? false
      if (isStaff.value) {
        await fetchSummaries()
      }
    }
  } finally {
    isAuthLoading.value = false
  }
})

const fetchSummaries = async (reset = true) => {
  if (reset) {
    loading.value = true
    page.value = 1
    summaries.value = []
  } else {
    loadingMore.value = true
  }

  try {
    const { data } = await api.get(`/api/v1/todos/hasena/summaries/?page=${page.value}&page_size=${pageSize}`)
    if (data.success) {
      if (reset) {
        summaries.value = data.summaries
      } else {
        summaries.value.push(...data.summaries)
      }
      total.value = data.total
    }
  } catch (error) {
    console.error('Failed to fetch summaries:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  page.value++
  await fetchSummaries(false)
}

const regenerateSummary = async (videoId: string) => {
  if (regenerating.value) return
  
  regenerating.value = videoId
  try {
    const { data } = await api.post('/api/v1/todos/hasena/summaries/regenerate/', { video_id: videoId })
    if (data.success) {
      await fetchSummaries()
    }
  } catch (error) {
    console.error('Failed to regenerate summary:', error)
  } finally {
    regenerating.value = null
  }
}

const openEditModal = (summary: Summary) => {
  editForm.value = {
    video_id: summary.video_id,
    title: summary.title || '',
    summary: summary.summary_preview.replace(/\.\.\.$/, '')
  }
  showEditModal.value = true
  
  fetchFullSummary(summary.video_id)
}

const fetchFullSummary = async (videoId: string) => {
  try {
    const { data } = await api.get(`/api/v1/todos/hasena/summary/?video_id=${videoId}`)
    if (data.success) {
      editForm.value.summary = data.summary
      editForm.value.title = data.title || ''
    }
  } catch (error) {
    console.error('Failed to fetch full summary:', error)
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  editForm.value = { video_id: '', title: '', summary: '' }
}

const saveSummary = async () => {
  if (!editForm.value.summary.trim()) return
  
  saving.value = true
  try {
    const { data } = await api.put(`/api/v1/todos/hasena/summaries/${editForm.value.video_id}/`, {
      summary: editForm.value.summary,
      title: editForm.value.title
    })
    if (data.success) {
      await fetchSummaries()
      closeEditModal()
    }
  } catch (error) {
    console.error('Failed to save summary:', error)
  } finally {
    saving.value = false
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style scoped>
.container {
  max-width: 1024px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.scroll-area {
  padding: 1rem;
}

.loading-indicator, .unauthorized-prompt, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-secondary);
}

.login-button {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 1rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.summary-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.video-date {
  font-weight: 600;
  color: var(--color-text-primary);
}

.video-id {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  font-family: monospace;
}

.edited-badge {
  font-size: 0.7rem;
  background: #f59e0b;
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.summary-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.action-btn.edit {
  background: var(--color-accent-primary);
  color: white;
}

.action-btn.regenerate {
  background: #10b981;
  color: white;
}

.action-btn.regenerate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.view {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.summary-preview {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.summary-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.load-more {
  text-align: center;
  padding: 1rem;
}

.load-more-btn {
  padding: 0.75rem 2rem;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--color-bg-card);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-tertiary);
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--color-text-secondary);
}

.input, .textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  font-size: 0.95rem;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.input.disabled {
  background: var(--color-bg-tertiary);
  cursor: not-allowed;
}

.textarea {
  resize: vertical;
  min-height: 200px;
  font-family: inherit;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border-light);
}

.btn-cancel, .btn-save {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.btn-cancel {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn-save {
  background: var(--color-accent-primary);
  color: white;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .summary-header {
    flex-direction: column;
  }
  
  .summary-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
