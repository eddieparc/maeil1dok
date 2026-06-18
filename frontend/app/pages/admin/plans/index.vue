<template>
  <div class="container">
    <!-- 헤더 -->
    <PageHeader title="성경 읽기 플랜 관리" fallback-path="/">
      <template #right>
        <button v-if="isStaff" @click="showCreateModal = true" class="create-button">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          새 플랜
        </button>
      </template>
    </PageHeader>

    <!-- 스크롤 영역 -->
    <div class="scroll-area">
      <!-- 인증 초기화 중 -->
      <div v-if="isAuthLoading" class="loading-indicator fade-in">
        <div class="spinner"></div>
        <p>인증 정보를 확인하는 중...</p>
      </div>

      <!-- 인증 및 권한 관련 UI -->
      <div v-else-if="!authStore.isAuthenticated.value" class="message-card fade-in" style="animation-delay: 0.2s">
        <div class="message-icon warning">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H9"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v6m0 0V9m0 0h6m-6 0H6"></path>
          </svg>
        </div>
        <div class="message-content">
          <h3>로그인이 필요합니다</h3>
          <p>이 페이지는 로그인 후 이용 가능합니다.</p>
          <button @click="$router.push('/login?redirect=/admin/plans')" class="login-button">로그인하기</button>
        </div>
      </div>

      <div v-else-if="!isStaff" class="message-card fade-in" style="animation-delay: 0.2s">
        <div class="message-icon error">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="message-content">
          <h3>권한이 없습니다</h3>
        <p>관리자 권한이 필요한 페이지입니다.</p>
        </div>
      </div>

      <!-- 로딩 상태 표시 개선 -->
      <div v-else-if="isLoading" class="flex flex-col gap-3 fade-in">
        <SkeletonPlanRow v-for="i in 4" :key="i" />
      </div>

      <!-- 에러 메시지 표시 개선 -->
      <div v-else-if="error" class="message-card error-card fade-in">
        <div class="message-icon error">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="message-content">
          <h3>오류가 발생했습니다</h3>
          <p>{{ error }}</p>
          <button @click="fetchPlans" class="retry-button">
            다시 시도
          </button>
        </div>
      </div>

      <!-- 콘텐츠 영역 개선 -->
      <div v-else class="content-section fade-in" style="animation-delay: 0.2s">
        <div v-if="!plans || plans.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-gray-300">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <p>등록된 플랜이 없습니다</p>
          <button @click="showCreateModal = true" class="create-empty-button">
            새 플랜 만들기
          </button>
        </div>

        <!-- 플랜 카드 그리드 개선 -->
        <div v-else class="plan-grid">
          <div v-for="(plan, index) in plans" :key="plan?.id || index" class="plan-card" :class="{'default-plan': plan?.is_default, 'inactive-plan': !plan?.is_active}">
            <div class="plan-card-content">
              <div class="plan-header">
                <div>
                  <h3 class="plan-title">
                    {{ plan?.name || '이름 없음' }}
                    <span v-if="plan?.is_default" class="default-badge">기본 플랜</span>
                    <span v-if="!plan?.is_active" class="inactive-badge">신규 구독 중단</span>
                  </h3>
                  <p class="plan-description">{{ plan?.description || '설명 없음' }}</p>
                </div>
              </div>
              <div class="plan-meta">
                <span class="meta-item">
                  <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  구독자: {{ plan?.subscriber_count || 0 }}명
                </span>
                <span class="meta-item">
                  <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                  생성자: {{ plan?.created_by_username || '알 수 없음' }}
                </span>
              </div>
              <div class="plan-actions">
                <button v-if="plan && !plan.is_default" @click="setAsDefault(plan)" class="action-button default"
                  :disabled="isLoading">
                  <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  기본 플랜으로 설정
                </button>
                <button v-if="plan" @click="toggleActive(plan)" :class="[
                      'action-button',
                      plan.is_active ? 'deactivate' : 'activate'
                ]" :disabled="isLoading || plan.is_default">
                  <svg v-if="plan.is_active" class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <svg v-else class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                    {{ plan.is_active ? '비활성화' : '활성화' }}
                  </button>
                <button v-if="plan" @click="editPlan(plan)" class="action-button edit"
                  :disabled="isLoading">
                  <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                  수정
                </button>
                <button v-if="plan" @click="managePlanSchedules(plan)" class="action-button schedule"
                  :disabled="isLoading">
                  <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  일정 관리
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 플랜 생성/수정 모달 -->
    <BaseModal
      v-model="showCreateModal"
      :title="editingPlan ? '플랜 수정' : '새 플랜 만들기'"
      size="md"
      :close-on-overlay="!isLoading"
      :close-on-esc="!isLoading"
    >
      <form @submit.prevent="savePlan" class="space-y-4">
        <div class="form-group">
          <label class="form-label">플랜 이름</label>
          <input v-model="planForm.name" type="text" class="form-input" required
            placeholder="플랜 이름을 입력하세요" :disabled="isLoading">
        </div>
        <div class="form-group">
          <label class="form-label">설명</label>
          <textarea v-model="planForm.description" class="form-textarea" rows="3"
            placeholder="플랜에 대한 설명을 입력하세요" :disabled="isLoading"></textarea>
        </div>
      </form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" @click="showCreateModal = false" class="btn btn-outline"
            :disabled="isLoading">취소</button>
          <button type="button" @click="savePlan" class="btn btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="button-spinner"></span>
            {{ isLoading ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 세부 일정 관리 모달 -->
    <BaseModal
      v-model="showScheduleModal"
      :title="`${selectedPlan?.name || ''} - 세부 일정 관리`"
      size="xl"
      :close-on-overlay="!isLoading"
      :close-on-esc="!isLoading"
      @close="closeScheduleModal"
    >
      <!-- 탭 메뉴 -->
      <div class="tab-menu">
        <button 
          :class="['tab-button', { active: scheduleTab === 'list' }]" 
          @click="scheduleTab = 'list'"
        >
          일정 목록
        </button>
        <button 
          :class="['tab-button', { active: scheduleTab === 'upload' }]" 
          @click="scheduleTab = 'upload'"
        >
          엑셀 업로드
        </button>
      </div>
      
      <!-- 일정 목록 탭 -->
      <div v-if="scheduleTab === 'list'" class="list-tab">
        <!-- 필터 및 검색 -->
        <div class="filter-section">
          <div class="search-container">
          <input 
            type="text"
              v-model="scheduleSearch" 
              placeholder="성경 검색..."
              class="search-input"
            />
          </div>
          
          <button @click="showAddScheduleModal = true" class="btn btn-primary">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            새 일정 추가
          </button>
        </div>
        
        <!-- 로딩 상태 -->
        <div v-if="loadingSchedules" class="fade-in">
          <SkeletonList :count="7" variant="schedule" />
        </div>
        
        <!-- 목록 비었을 때 -->
        <div v-else-if="!schedules.length" class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-gray-300">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <p>등록된 세부 일정이 없습니다</p>
          <p class="text-sm text-gray-500 mt-2">새 일정을 추가하거나 엑셀 파일을 업로드하세요.</p>
        </div>
        
        <!-- 일정 목록 테이블 -->
        <div v-else class="schedule-table-container">
          <table class="schedule-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>성경</th>
                <th>범위</th>
                <th>오디오</th>
                <th>가이드</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="schedule in filteredSchedules" :key="schedule.id">
                <td>{{ formatDate(schedule.date) }}</td>
                <td>{{ schedule.book }}</td>
                <td>{{ schedule.start_chapter }}장 ~ {{ schedule.end_chapter }}장</td>
                <td>
                  <a v-if="schedule.audio_link" :href="schedule.audio_link" target="_blank" rel="noopener noreferrer" class="link-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </a>
                  <span v-else>-</span>
                </td>
                <td>
                  <a v-if="schedule.guide_link" :href="schedule.guide_link" target="_blank" rel="noopener noreferrer" class="link-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </a>
                  <span v-else>-</span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button @click="editSchedule(schedule)" class="table-action-btn edit">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button @click="confirmDeleteSchedule(schedule)" class="table-action-btn delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- 엑셀 업로드 탭 -->
      <div v-else-if="scheduleTab === 'upload'" class="upload-tab">
        <form @submit.prevent="uploadScheduleExcel" class="upload-form">
          <div class="form-group">
            <label class="form-label">엑셀 파일 선택</label>
            <input 
              type="file" 
              ref="scheduleFileInput" 
              accept=".xlsx, .xls" 
              class="file-input" 
              @change="handleScheduleFileChange"
            required
            />
            <p class="text-xs text-gray-500 mt-1">최대 5MB 크기의 .xlsx 또는 .xls 파일</p>
          </div>
          
          <!-- 업로드 옵션 -->
          <div class="form-group">
            <label class="form-label">업로드 옵션</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" v-model="uploadMode" value="merge" />
                기존 일정과 병합 (같은 날짜는 업데이트)
              </label>
              <label class="radio-label">
                <input type="radio" v-model="uploadMode" value="replace" />
                모든 일정 교체 (기존 일정 삭제 후 새로 추가)
              </label>
            </div>
          </div>
          
          <!-- 엑셀 파일 안내 -->
          <div class="info-box">
            <p class="text-sm font-medium text-blue-800 mb-2">엑셀 파일 작성 방법:</p>
            <ul class="text-xs text-blue-700 space-y-1 pl-4 list-disc">
              <li>필수 컬럼: <strong>날짜, 성경, 시작장, 끝장</strong> (정확히 이 이름으로 작성)</li>
              <li>선택 컬럼: <strong>오디오, 가이드</strong> (URL 링크)</li>
              <li>날짜 형식: 다음 형식 모두 지원
                <ul class="pl-4 mt-1 list-disc">
                  <li><strong>YYYY년 MM월 DD일</strong> (예: 2025년 2월 2일)</li>
                  <li><strong>YYYY-MM-DD</strong> (예: 2025-02-02)</li>
                  <li>일반 엑셀 날짜 셀 형식</li>
                </ul>
              </li>
              <li>URL은 반드시 <strong>http://</strong> 또는 <strong>https://</strong>로 시작해야 함</li>
            </ul>
            <div class="mt-3">
              <a href="/sample-schedule.xlsx" class="text-xs text-blue-600 flex items-center hover:underline" target="_blank" rel="noopener noreferrer">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                    clip-rule="evenodd"></path>
                </svg>
                샘플 엑셀 파일 다운로드
              </a>
            </div>
          </div>
          
          <!-- 업로드 버튼 -->
          <div class="form-actions">
            <button 
              type="submit" 
              class="btn btn-primary" 
              :disabled="uploading || !scheduleFile"
            >
              <span v-if="uploading" class="button-spinner"></span>
              {{ uploading ? '업로드 중...' : '엑셀 파일 업로드' }}
            </button>
          </div>
        </form>
      </div>
    </BaseModal>
    
    <!-- 일정 추가/수정 모달 -->
    <BaseModal
      v-model="showAddScheduleModal"
      :title="editingSchedule ? '일정 수정' : '새 일정 추가'"
      size="lg"
      :close-on-overlay="!savingSchedule"
      :close-on-esc="!savingSchedule"
      @close="closeAddScheduleModal"
    >
      <form @submit.prevent="saveSchedule" class="schedule-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">날짜 *</label>
            <input
              type="date"
              v-model="scheduleForm.date"
              class="form-input"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">성경 *</label>
            <input
              type="text"
              v-model="scheduleForm.book"
              class="form-input"
              placeholder="예: 창세기, 요한복음"
              required
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">시작장 *</label>
            <input
              type="number"
              v-model.number="scheduleForm.start_chapter"
              min="1"
              class="form-input"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">끝장 *</label>
            <input
              type="number"
              v-model.number="scheduleForm.end_chapter"
              min="1"
              class="form-input"
              required
            />
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">오디오 링크</label>
          <input
            type="url"
            v-model="scheduleForm.audio_link"
            class="form-input"
            placeholder="https://"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">가이드 링크</label>
          <input
            type="url"
            v-model="scheduleForm.guide_link"
            class="form-input"
            placeholder="https://"
          />
        </div>
      </form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button 
            type="button"
            class="btn btn-outline"
            @click="closeAddScheduleModal"
            :disabled="savingSchedule"
          >
            취소
          </button>
          <button 
            type="button"
            class="btn btn-primary"
            @click="saveSchedule"
            :disabled="savingSchedule"
          >
            <span v-if="savingSchedule" class="button-spinner"></span>
            {{ savingSchedule ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- Toast 컴포넌트 사용 -->
    <Toast ref="toast" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useToast } from '~/composables/useToast'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import Toast from '~/components/Toast.vue'
import BaseModal from '~/components/ui/modal/BaseModal.vue'
import SkeletonPlanRow from '~/components/ui/skeleton/SkeletonPlanRow.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'

const { toasts, showToastMessage } = useToast()
const authStore = useAuthService()
const api = useApi()
const modal = useModal()
const toast = ref(null)
const isLoading = ref(false)
const error = ref(null)

const plans = ref([])
const showCreateModal = ref(false)
const editingPlan = ref(null)
const planForm = ref({
  name: '',
  description: ''
})

// 초기화 완료 여부
const isAuthLoading = computed(() => !authStore.isInitialized.value)

// 관리자 권한 체크
const isStaff = computed(() => {
  // authStore.user.value는 { id, username, nickname, profile_image, is_staff } 구조
  // is_staff는 user 객체의 직접 속성임
  return authStore.isAuthenticated.value && Boolean(authStore.user.value?.is_staff);
})

onMounted(() => {
  if (authStore.isAuthenticated.value && isStaff.value) {
    fetchPlans();
  }
})

// 인증 상태 변화 감지하여 플랜 로드
watch(() => isStaff.value, (newIsStaff) => {
  if (newIsStaff) {
    fetchPlans();
  }
})

// 플랜 목록 조회 - 수정
const fetchPlans = async () => {
  if (!isStaff.value) return
  
  try {
    isLoading.value = true;
    error.value = null;

    // 정확한 API 경로 사용
    const response = await api.get('/api/v1/todos/bible-plans/')
    
    // useApi.get()은 { data: 실제응답 } 형태로 반환
    const data = response?.data;

    // 응답 데이터 구조 확인 및 처리
    if (data && Array.isArray(data.results)) {
      // DRF 페이지네이션 응답: { count, results: [...] }
      plans.value = data.results;
    } else if (Array.isArray(data)) {
      // 응답이 배열인 경우
      plans.value = data;
    } else {
      plans.value = [];
      error.value = '응답 데이터 형식이 올바르지 않습니다';
    }

  } catch (err) {
    plans.value = [];
    error.value = '플랜 목록을 불러오는데 실패했습니다.';
    showToastMessage('플랜 목록을 불러오는데 실패했습니다.', 'error');
  } finally {
    isLoading.value = false;
  }
}

// 플랜 저장 (생성 또는 수정) - 수정
const savePlan = async () => {
  if (!planForm.value.name.trim()) {
    showToastMessage('플랜 이름은 필수입니다.', 'error');
    return;
  }
  
  try {
    isLoading.value = true;
    
    if (editingPlan.value) {
      // 플랜 수정 - patch 대신 put 사용
      await api.put(`/api/v1/todos/bible-plans/${editingPlan.value.id}/`, planForm.value)
      showToastMessage('플랜이 수정되었습니다.')
    } else {
      // 새 플랜 생성
      await api.post('/api/v1/todos/bible-plans/', planForm.value)
      showToastMessage('새 플랜이 생성되었습니다.')
    }
    
    // 모달 닫고 목록 새로고침
    showCreateModal.value = false
    editingPlan.value = null
    planForm.value = { name: '', description: '' }
    await fetchPlans()
  } catch (error) {
    // 에러 메시지 표시 개선
    let errorMessage = '플랜 저장에 실패했습니다.';
    if (error.message.includes('500')) {
      errorMessage = '서버 오류가 발생했습니다. 관리자에게 문의하세요.';
    }
    showToastMessage(errorMessage, 'error')
  } finally {
    isLoading.value = false;
  }
}

// 기본 플랜으로 설정 - 수정
const setAsDefault = async (plan) => {
  try {
    isLoading.value = true;
    
    // 1. 먼저 모든 플랜의 is_default를 false로 설정 (기존 기본 플랜 초기화)
    for (const p of plans.value) {
      if (p.is_default && p.id !== plan.id) {
        await api.patch(`/api/v1/todos/bible-plans/${p.id}/`, {
          is_default: false
        });
      }
    }
    
    // 2. 선택한 플랜을 기본 플랜으로 설정
    await api.patch(`/api/v1/todos/bible-plans/${plan.id}/`, {
      is_default: true
    });
    
    showToastMessage(`${plan.name}이(가) 기본 플랜으로 설정되었습니다.`);
    await fetchPlans();
  } catch (error) {
    let errorMessage = '기본 플랜 설정에 실패했습니다.';
    if (error.message.includes('500')) {
      errorMessage = '서버에서 오류가 발생했습니다. 관리자에게 문의하세요.';
    }
    showToastMessage(errorMessage, 'error');
  } finally {
    isLoading.value = false;
  }
}

// 활성화/비활성화 토글 - 수정
const toggleActive = async (plan) => {
  try {
    isLoading.value = true;
    
    // 단일 필드만 업데이트하는 PATCH 요청
    await api.patch(`/api/v1/todos/bible-plans/${plan.id}/`, {
      is_active: !plan.is_active
    });
    
    const statusText = plan.is_active ? '비활성화' : '활성화';
    showToastMessage(`${plan.name}이(가) ${statusText}되었습니다.`);
    await fetchPlans();
  } catch (error) {
    let errorMessage = '플랜 상태 변경에 실패했습니다.';
    if (error.message.includes('500')) {
      errorMessage = '서버에서 오류가 발생했습니다. 관리자에게 문의하세요.';
    }
    showToastMessage(errorMessage, 'error');
  } finally {
    isLoading.value = false;
  }
}

// 플랜 수정 모달 열기 - 데이터 유효성 검사 추가
const editPlan = (plan) => {
  if (!plan || !plan.id) {
    showToastMessage('유효하지 않은 플랜 데이터입니다.', 'error');
    return;
  }
  
  editingPlan.value = plan
  planForm.value = {
    name: plan.name || '',
    description: plan.description || ''
  }
  showCreateModal.value = true
}

// 인증 상태 변경 감지 유지 - 수정
watch(() => authStore.isAuthenticated, async (newValue) => {
  if (newValue) {
    await nextTick();
    if (isStaff.value) {
    await fetchPlans();
    }
  } else {
    plans.value = [];
  }
})

// 추가: 사용자 정보 변경 감지
watch(() => authStore.user.value, async (newUser) => {
  if (authStore.isAuthenticated.value && newUser) {
    await nextTick();
    if (isStaff.value) {
    await fetchPlans();
    }
  }
}, { deep: true })

// 추가 상태 변수
const showScheduleModal = ref(false)
const selectedPlan = ref(null)
const scheduleTab = ref('list')
const schedules = ref([])
const loadingSchedules = ref(false)
const scheduleSearch = ref('')
const uploadMode = ref('merge')
const scheduleFile = ref(null)
const uploading = ref(false)
const showAddScheduleModal = ref(false)
const editingSchedule = ref(null)
const savingSchedule = ref(false)
const scheduleForm = ref({
  date: '',
  book: '',
  start_chapter: 1,
  end_chapter: 1,
  audio_link: '',
  guide_link: ''
})

// 필터링된 일정 목록
const filteredSchedules = computed(() => {
  if (!scheduleSearch.value) return schedules.value
  
  const searchTerm = scheduleSearch.value.toLowerCase()
  return schedules.value.filter(schedule => 
    schedule.book.toLowerCase().includes(searchTerm)
  )
})

// 일정 관리 모달 열기
const managePlanSchedules = async (plan) => {
  selectedPlan.value = plan
  showScheduleModal.value = true
  scheduleTab.value = 'list'
  
  if (plan && plan.id) {
    await fetchSchedules(plan.id)
  } else {
    showToastMessage('플랜 정보가 올바르지 않습니다.', 'error')
  }
}

// 일정 관리 모달 닫기
const closeScheduleModal = () => {
  showScheduleModal.value = false
  selectedPlan.value = null
  schedules.value = []
}

// 일정 추가/수정 모달 닫기
const closeAddScheduleModal = () => {
  showAddScheduleModal.value = false
  editingSchedule.value = null
  resetScheduleForm()
}

// 날짜 포매팅 함수 (내장 JavaScript 사용)
const formatDate = (dateString) => {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  const options = { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    weekday: 'short'
  }
  
  // 한국어 날짜 형식 (YYYY-MM-DD (요일))
  return date.toLocaleDateString('ko-KR', options).replace(/\. /g, '-').replace('.', '')
}

// 입력 필드용 날짜 포맷 (YYYY-MM-DD)
const formatDateForInput = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 오늘 날짜를 기본값으로 설정
const getTodayFormatted = () => {
  return formatDateForInput(new Date())
}

// scheduleForm 초기화 코드 수정
const resetScheduleForm = () => {
  scheduleForm.value = {
    date: getTodayFormatted(),
    book: '',
    start_chapter: 1,
    end_chapter: 1,
    audio_link: '',
    guide_link: ''
  }
}

// 일정 수정 모달 열기 함수 수정
const editSchedule = (schedule) => {
  editingSchedule.value = schedule
  scheduleForm.value = {
    date: formatDateForInput(schedule.date),
    book: schedule.book,
    start_chapter: schedule.start_chapter,
    end_chapter: schedule.end_chapter,
    audio_link: schedule.audio_link || '',
    guide_link: schedule.guide_link || ''
  }
  showAddScheduleModal.value = true
}

// 일정 목록 조회 함수 수정
const fetchSchedules = async (planId) => {
  try {
    loadingSchedules.value = true
    const url = `/api/v1/todos/schedules/?plan_id=${planId}`
    
    const response = await api.get(url)
    
    // 응답 형식 검사 및 변환 수정
    if (response && response.data && Array.isArray(response.data)) {
      // 데이터가 response.data에 있는 경우
      schedules.value = response.data
    } else if (Array.isArray(response)) {
      // 데이터가 response 자체인 경우
      schedules.value = response
    } else if (response && typeof response === 'object') {
      // 다른 형태의 객체인 경우 (results 필드에 배열이 있을 수 있음)
      schedules.value = response.results || []
    } else {
      // 기타 경우
      schedules.value = []
    }
  } catch (err) {
    showToastMessage('세부 일정 목록을 불러오는 중 오류가 발생했습니다.', 'error')
    schedules.value = []
  } finally {
    loadingSchedules.value = false
  }
}

// 일정 파일 선택 처리
const handleScheduleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    // 파일 크기 검사 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      showToastMessage('파일 크기는 5MB를 초과할 수 없습니다.', 'error')
      event.target.value = null
      scheduleFile.value = null
      return
    }
    
    scheduleFile.value = file
  } else {
    scheduleFile.value = null
  }
}

// 엑셀 파일 업로드
const uploadScheduleExcel = async () => {
  if (!selectedPlan.value) {
    showToastMessage('플랜이 선택되지 않았습니다.', 'error')
    return
  }

  if (!scheduleFile.value) {
    showToastMessage('파일을 선택해주세요.', 'error')
    return
  }

  try {
    uploading.value = true
    
    const formData = new FormData()
    formData.append('file', scheduleFile.value)
    formData.append('plan_id', selectedPlan.value.id.toString())
    formData.append('update_mode', uploadMode.value === 'replace' ? 'replace' : 'update')
    
    // URL 경로 수정 (하이픈으로 변경)
    const response = await api.post('/api/v1/todos/schedules/upload-excel/', formData)
    
    // 성공 메시지 표시
    showToastMessage(response.detail || '일정이 성공적으로 업로드되었습니다.')
    
    // 오류가 있는 경우 상세 오류 표시
    if (response.errors && response.errors.length > 0) {
      showToastMessage(`일부 행에서 오류가 발생했습니다.`, 'warning')
    }
    
    // 목록 새로고침
    await fetchSchedules(selectedPlan.value.id)
    
    // 폼 초기화
    scheduleFile.value = null
    if (this.$refs.scheduleFileInput) {
      this.$refs.scheduleFileInput.value = null
    }
  } catch (error) {
    // 상세 오류 메시지 표시
    let errorMessage = '파일 업로드 중 오류가 발생했습니다.'
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.errors) {
      errorMessage = '데이터 형식 오류가 발생했습니다.'
    }
    
    showToastMessage(errorMessage, 'error')
  } finally {
    uploading.value = false
  }
}

// 일정 추가 모달 열기
const openAddScheduleModal = () => {
  resetScheduleForm()
  showAddScheduleModal.value = true
}

// 일정 삭제 확인
const confirmDeleteSchedule = async (schedule) => {
  const confirmed = await modal.confirm({
    title: '일정 삭제',
    description: `"${schedule.book} ${schedule.start_chapter}-${schedule.end_chapter}장" 일정을 삭제하시겠습니까?`,
    confirmText: '삭제',
    cancelText: '취소',
    icon: 'warning'
  })
  if (confirmed) {
    await deleteSchedule(schedule.id)
  }
}

// 일정 삭제
const deleteSchedule = async (scheduleId) => {
  try {
    loadingSchedules.value = true
    
    await api.delete(`/api/v1/todos/schedules/${scheduleId}/`)
    showToastMessage('일정이 삭제되었습니다.')
    
    // 목록 새로고침
    await fetchSchedules(selectedPlan.value.id)
  } catch (error) {
    let errorMessage = '일정 삭제에 실패했습니다.'
    if (error.message.includes('500')) {
      errorMessage = '서버 오류가 발생했습니다. 관리자에게 문의하세요.'
    }
    showToastMessage(errorMessage, 'error')
  } finally {
    loadingSchedules.value = false
  }
}

// 일정 저장 (추가 또는 수정)
const saveSchedule = async () => {
  if (!scheduleForm.value.date || !scheduleForm.value.book) {
    showToastMessage('날짜와 성경은 필수 입력 항목입니다.', 'error')
    return
  }
  
  try {
    savingSchedule.value = true

    if (editingSchedule.value) {
      // 기존 일정 수정
      await api.put(`/api/v1/todos/schedules/${editingSchedule.value.id}/`, {
        ...scheduleForm.value,
        plan: selectedPlan.value.id
      })
      showToastMessage('일정이 수정되었습니다.')
    } else {
      // 새 일정 추가
      await api.post('/api/v1/todos/schedules/', {
        ...scheduleForm.value,
        plan: selectedPlan.value.id
      })
      showToastMessage('새 일정이 추가되었습니다.')
    }

    closeAddScheduleModal()
    await fetchSchedules(selectedPlan.value.id)
  } catch (error) {
    let errorMessage = '일정 저장에 실패했습니다.'
    if (error.message && error.message.includes('500')) {
      errorMessage = '서버 오류가 발생했습니다. 관리자에게 문의하세요.'
    }
    showToastMessage(errorMessage, 'error')
  } finally {
    savingSchedule.value = false
  }
}

// 뒷정리
watch(showScheduleModal, (newVal) => {
  if (!newVal) {
    schedules.value = []
  }
})
</script>

<style scoped>
/* 기본 스타일 */
/* 페이지 로컬 변수 — 전역 :root를 덮어쓰지 않도록 컨테이너로 스코프 */
.container {
  --primary-color: var(--color-accent-primary);
  --primary-light: var(--color-accent-primary-light);
  --primary-dark: var(--color-accent-primary-hover);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --background-light: var(--color-bg-tertiary);
  --border-color: var(--color-border-default);
  --success-color: var(--color-success);
  --warning-color: var(--color-warning);
  --error-color: var(--color-error);
}

.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--background-light);
}

/* 헤더 스타일 개선 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background-color: white;
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 10;
}

h1 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.back-button {
  padding: 0.5rem;
  margin: -0.5rem;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.back-button:hover {
  background: var(--primary-light);
  color: var(--primary-color);
}

.create-button {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-button:hover {
  background: var(--primary-dark);
}

/* 스크롤 영역 */
.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* 메시지 카드 스타일 */
.message-card {
  display: flex;
  align-items: flex-start;
  padding: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 32rem;
  margin: 0 auto;
}

.message-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  margin-right: 1rem;
}

.message-icon.warning {
  background-color: #FEF3C7;
  color: #D97706;
}

.message-icon.error {
  background-color: #FEE2E2;
  color: #DC2626;
}

.message-content {
  flex: 1;
}

.message-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.message-content p {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.error-card {
  border-left: 4px solid var(--error-color);
}

/* 로딩 인디케이터 개선 */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--primary-light);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 빈 상태 개선 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  background: white;
  border-radius: 0.75rem;
  border: 1px dashed #E5E7EB;
}

.empty-icon {
  margin-bottom: 1rem;
}

.create-empty-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-empty-button:hover {
  background: var(--primary-dark);
}

/* 플랜 그리드 개선 */
.content-section {
  max-width: 1200px;
  margin: 0 auto;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.plan-card {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.default-plan {
  border: 2px solid var(--primary-color);
}

.plan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.plan-card-content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.plan-header {
  margin-bottom: 1rem;
}

.plan-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
}

.default-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  margin-left: 0.5rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: 1rem;
  font-weight: 500;
}

.inactive-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  margin-left: 0.5rem;
  background-color: #9CA3AF;
  color: white;
  border-radius: 1rem;
  font-weight: 500;
}

.inactive-plan {
  opacity: 0.7;
  border: 1px dashed #9CA3AF;
}

.inactive-plan .plan-title,
.inactive-plan .plan-description {
  color: #6B7280;
}

.plan-description {
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.plan-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  margin-top: auto;
}

.meta-item {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.meta-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.375rem;
}

.plan-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.action-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.375rem;
}

.action-button.default {
  background: var(--primary-light);
  color: var(--primary-dark);
}

.action-button.default:hover {
  background: var(--primary-color);
  color: white;
}

.action-button.activate {
  background: #DCFCE7;
  color: #166534;
}

.action-button.activate:hover {
  background: #16A34A;
  color: white;
}

.action-button.deactivate {
  background: #FEE2E2;
  color: #991B1B;
}

.action-button.deactivate:hover {
  background: #DC2626;
  color: white;
}

.action-button.edit {
  background: #EFF6FF;
  color: #1E40AF;
}

.action-button.edit:hover {
  background: var(--info);
  color: white;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #E5E7EB;
  border-radius: 0.5rem;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(79, 111, 82, 0.1);
}

.btn {
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.button-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

/* 버튼 비활성화 */
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 애니메이션 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

.retry-button {
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1rem;
}

.retry-button:hover {
  background: var(--primary-dark);
}

.login-button {
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.login-button:hover {
  background: var(--primary-dark);
}

/* 반응형 디자인 */
@media (max-width: 640px) {
  .header {
    padding: 0.75rem 1rem;
  }
  
  .scroll-area {
    padding: 1rem;
  }
  
  .plan-grid {
    grid-template-columns: 1fr;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
}

/* 추가 스타일 */
.action-button.schedule {
  background-color: #4c51bf;
  color: white;
}

.action-button.schedule:hover {
  background-color: #434190;
}

.tab-menu {
  display: flex;
  border-bottom: 1px solid #E5E7EB;
  margin-bottom: 1rem;
}

.tab-button {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-container {
  position: relative;
  flex: 1;
  max-width: 300px;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  padding-left: 2rem;
  border: 1px solid #E5E7EB;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.search-icon {
  position: absolute;
  left: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
}

.schedule-table-container {
  overflow-x: auto;
}

.schedule-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.schedule-table th,
.schedule-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #E5E7EB;
}

.schedule-table th {
  background-color: #F9FAFB;
  font-weight: 500;
  color: var(--text-primary);
}

.link-icon {
  color: var(--primary-color);
  display: inline-flex;
  padding: 0.25rem;
  border-radius: 9999px;
  transition: all 0.2s;
}

.link-icon:hover {
  background-color: rgba(79, 111, 82, 0.1);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.table-action-btn {
  padding: 0.25rem;
  background: none;
  border: none;
  border-radius: 9999px;
  transition: all 0.2s;
}

.table-action-btn.edit {
  color: #4A5568;
}

.table-action-btn.delete {
  color: #E53E3E;
}

.table-action-btn:hover {
  background-color: #F7FAFC;
}

.upload-form {
  max-width: 100%;
}

.info-box {
  background-color: #EBF8FF;
  border: 1px solid #BEE3F8;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
}

.radio-group {
  margin-top: 0.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-row .form-group {
  flex: 1;
}

@media (max-width: 640px) {
  .form-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .filter-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .search-container {
    width: 100%;
    max-width: none;
  }
}

/* 디버깅 버튼 추가 (개발 중에만 사용) */
.debug-section {
  padding: 1rem;
  background-color: white;
  border-top: 1px solid var(--border-color);
}

.debug-button {
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.debug-button:hover {
  background-color: var(--primary-dark);
}
</style> 