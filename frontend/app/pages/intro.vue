<template>
  <PageLayout title="개론" fallback-path="/">
    <template #header-action>
      <button v-if="videoIntroId" class="list-button-right" @click="goToIntroList">
        목록
      </button>
    </template>

    <div class="sanctuary-theme">
    <div class="bg-pattern"></div>
    
    <div class="intro-container">
      <!-- URL에 ID 파라미터가 있는 경우: 특정 영상 개론 표시 -->
      <template v-if="videoIntroId">
        <main class="main-content">
          <!-- 로딩 상태 -->
          <div v-if="isLoading" class="state-container loading fade-in" style="animation-delay: 0.2s">
            <div class="loading-spinner"></div>
            <p>영상 정보를 불러오는 중...</p>
          </div>

          <!-- 에러 상태 -->
          <div v-else-if="error" class="state-container error fade-in" style="animation-delay: 0.2s">
            <div class="error-icon">!</div>
            <h3>정보를 불러올 수 없습니다</h3>
            <p>{{ error }}</p>
            <button class="retry-button" @click="fetchVideoIntro">다시 시도</button>
          </div>

          <!-- 콘텐츠 -->
          <template v-else-if="videoIntro">
            <!-- 비디오 섹션 -->
            <div class="card video-card fade-in" style="animation-delay: 0.1s">
              <div class="video-wrapper">
                <div class="video-container">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    :src="getEmbedUrl(videoIntro.url_link)" 
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                  ></iframe>
                </div>
                <a :href="videoIntro.url_link" target="_blank" rel="noopener noreferrer" class="youtube-deep-link">
                  <span class="youtube-icon">▶</span>
                  YouTube 앱으로 시청하기
                </a>
              </div>
            </div>

            <!-- 본문 섹션 -->
            <div class="card content-card fade-in" style="animation-delay: 0.2s">
              <div class="bible-header">
                <h2>{{ videoIntro.book }} 개론</h2>
              </div>
              <div class="verse-container">
                <p class="description">{{ videoIntro.book }}의 전체적인 흐름과 주제를 이해하고 깊이 있게 말씀을 묵상해보세요.</p>
              </div>
            </div>
          </template>
        </main>

        <!-- 하단 플로팅 버튼 -->
        <div v-if="videoIntro && !isLoading && !error" class="floating-footer fade-in" style="animation-delay: 0.3s">
          <div class="footer-inner">
            <button 
              class="action-button" 
              :class="{ 'completed': isCompleted }" 
              @click="toggleCompletion" 
              :disabled="isCompleting"
            >
              <span v-if="isCompleting" class="loading-spinner small"></span>
              <template v-else>
                <CheckCircleIcon class="btn-icon" />
                <span>{{ completionStatus }}</span>
              </template>
            </button>
          </div>
        </div>
      </template>

      <!-- URL에 ID 파라미터가 없는 경우: IntroListContent (개론 목록) 표시 -->
      <template v-else>
        <IntroListContent />
      </template>
    </div>
  </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useToast } from '~/composables/useToast'
import IntroListContent from '~/components/IntroListContent.vue'
import PageLayout from '~/components/common/PageLayout.vue'
import CheckCircleIcon from '~/components/icons/CheckCircleIcon.vue'
import { useHead } from '#imports'

useHead({
  title: '성경 개론 영상 - 매일일독',
  meta: [
    { name: 'description', content: '성경 각 권의 개론 영상을 시청하세요. 성경의 전체적인 흐름과 주제를 이해하고 깊이 있게 말씀을 묵상할 수 있습니다.' },
    { property: 'og:title', content: '성경 개론 영상 - 매일일독' },
    { property: 'og:description', content: '성경 각 권의 개론 영상을 시청하세요.' },
    { property: 'og:url', content: 'https://maeil1dok.app/intro' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:site_name', content: '매일일독' },
  ],
  link: [
    { rel: 'canonical', href: 'https://maeil1dok.app/intro' },
  ],
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthService()
const { success, error: showError } = useToast()

const videoIntro = ref(null)
const isLoading = ref(true)
const error = ref(null)
const isCompleted = ref(false)
const isCompleting = ref(false)

// ID 파라미터 확인
const videoIntroId = computed(() => {
  // URL 쿼리 파라미터에서 id 값을 가져옴
  return route.query.id || route.params.id
})

// 완료 상태 텍스트
const completionStatus = computed(() => {
  if (isCompleting.value) return '처리 중...'
  if (isCompleted.value) return '완료 취소'
  return '완료'
})

// YouTube URL을 임베드 URL로 변환
const getEmbedUrl = (url) => {
  if (!url) return ''

  // YouTube URL 패턴 확인
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)

  if (match && match[2].length === 11) {
    // 영상 ID 추출 후 임베드 URL 생성
    return `https://www.youtube.com/embed/${match[2]}`
  }

  return url // 변환할 수 없는 경우 원래 URL 반환
}

// 영상 개론 정보 가져오기
const fetchVideoIntro = async () => {
  if (!videoIntroId.value) {
    error.value = '영상 정보가 없습니다.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const response = await api.get(`/api/v1/todos/video/intro/${videoIntroId.value}/`)
    videoIntro.value = response.data

    // 현재 사용자의 이 영상에 대한 완료 상태 확인
    if (authStore.isAuthenticated.value) {
      await checkCompletionStatus()
    }
  } catch (err) {
    error.value = '영상 정보를 불러오는데 실패했습니다.'
  } finally {
    isLoading.value = false
  }
}

// 사용자의 완료 상태 확인
const checkCompletionStatus = async () => {
  if (!authStore.isAuthenticated.value || !videoIntroId.value) {
    return;
  }
  
  try {
    const userIntrosResponse = await api.get('/api/v1/todos/user/video/intro/')
    let userIntros = userIntrosResponse.data
    
    // API 응답 구조 확인 및 처리
    if (!userIntros) {
      return
    }
    
    // results 프로퍼티가 있는 경우 (페이지네이션 응답)
    if (userIntros.results && Array.isArray(userIntros.results)) {
      userIntros = userIntros.results
    } else if (!Array.isArray(userIntros)) {
      return
    }
    
    // 현재 영상에 대한 사용자 진행 상태 찾기
    const videoIntroIdNum = parseInt(videoIntroId.value)
    const currentProgress = userIntros.find(intro => {
      // 데이터 구조에 따라 ID 위치가 다를 수 있음
      if (intro.video_intro && intro.video_intro.id === videoIntroIdNum) {
        return true
      }
      // 또는 ID가 직접 객체에 있을 수 있음
      return intro.id === videoIntroIdNum
    })

    if (currentProgress) {
      // videoIntro 객체에 완료 상태 직접 설정
      if (videoIntro.value) {
        videoIntro.value.is_completed = currentProgress.is_completed
        isCompleted.value = currentProgress.is_completed // isCompleted 변수도 업데이트
      }
    } else {
      // 진행 상태가 없는 경우 기본값으로 설정
      isCompleted.value = false
    }
  } catch (err) {
    // Error handled silently
  }
}

// 영상 시청 완료 표시
const toggleCompletion = async () => {
  if (!authStore.isAuthenticated.value) {
    // 로그인이 필요한 경우 로그인 페이지로 이동
    router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  
  // 완료 처리 중 상태
  isCompleting.value = true

  try {
    // 낙관적 업데이트 (UI 즉시 반영)
    const newCompletionStatus = !videoIntro.value.is_completed
    videoIntro.value.is_completed = newCompletionStatus
    isCompleted.value = newCompletionStatus // isCompleted 변수도 함께 업데이트

    // API 호출하여 서버에 상태 업데이트
    const response = await api.post('/api/v1/todos/video/intro/progress/', {
      video_intro_id: videoIntroId.value,
      is_completed: newCompletionStatus
    })

    // 응답 데이터에서 완료 상태 가져오기 (서버 상태와 일치시키기)
    if (response.data && response.data.is_completed !== undefined) {
      videoIntro.value.is_completed = response.data.is_completed
      isCompleted.value = response.data.is_completed
    }
    
    // 성공 메시지 표시
    if (videoIntro.value.is_completed) {
      success('완료 처리되었습니다.')
    } else {
      success('미완료 처리되었습니다.')
    }
    isCompleting.value = false // 완료 처리 완료 상태
  } catch (err) {
    // 에러 발생 시 상태 롤백
    videoIntro.value.is_completed = !videoIntro.value.is_completed
    isCompleted.value = !isCompleted.value
    showError('완료 상태를 업데이트하는데 오류가 발생했습니다. 다시 시도해주세요.')
    isCompleting.value = false
  }
}

const goToIntroList = () => {
  router.push('/intro');
}

// 페이지 로드 시 영상 정보 가져오기
onMounted(() => {
  if (videoIntroId.value) { // URL에 ID가 있을 경우에만 영상 정보를 가져옵니다.
    fetchVideoIntro()
    checkCompletionStatus() // onMounted에서 최초 완료 상태도 확인
  } else {
    // ID가 없는 경우 (목록 페이지)에는 videoIntro를 null로 초기화하거나 다른 처리를 할 수 있습니다.
    videoIntro.value = null
    isLoading.value = false // 목록 페이지에서는 이 컴포넌트의 로딩 상태를 false로 설정
  }
});

// videoIntroId가 변경될 때마다 데이터를 다시 가져오도록 watch 추가
watch(videoIntroId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchVideoIntro();
    checkCompletionStatus(); // ID 변경 시 완료 상태도 다시 확인
  } else if (!newId) {
    // ID가 없어진 경우 (예: 목록으로 돌아가는 경우)
    videoIntro.value = null;
    isLoading.value = false;
  }
});
</script>

<style scoped>
/* Sanctuary Theme Variables - Uses global theme tokens */
.sanctuary-theme {
  --font-serif: 'Noto Serif KR', 'RIDIBatang', serif;
  --font-sans: 'Pretendard', sans-serif;
  --primary-color: var(--color-accent-primary);
  --primary-dark: var(--color-accent-primary-hover);
  --color-success: var(--color-accent-primary);
  --color-success-dark: var(--color-accent-primary-dark);

  font-family: var(--font-sans);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  min-height: 100vh;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

.bg-pattern {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(var(--color-text-tertiary) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.1;
  z-index: 0;
  pointer-events: none;
}

.intro-container {
  max-width: 768px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  z-index: 1;
  padding-bottom: 3rem;
}

/* Header Button */
.list-button-right {
  margin-left: auto;
  padding: 0.35rem 0.85rem;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-default);
  border-radius: 99px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  font-family: var(--font-sans);
}

.list-button-right:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-dark);
}

/* Main Content */
.main-content {
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: var(--color-bg-card);
  border-radius: 20px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

/* Video Section */
.video-card {
  padding: 0;
}

.video-wrapper {
  position: relative;
  width: 100%;
}

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
  background: #000;
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.youtube-deep-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  border-top: 1px solid var(--color-border-light);
  transition: background 0.2s;
}

.youtube-deep-link:hover {
  background: var(--color-bg-hover);
}

/* Content Section */
.content-card {
  padding: 1.5rem;
  min-height: 200px;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: var(--color-text-secondary);
  gap: 1rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--color-border-default);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small {
  width: 1.25rem;
  height: 1.25rem;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: white;
}

.error-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fee2e2;
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.25rem;
}

[data-theme="dark"] .error-icon {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}

.retry-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.retry-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.bible-header {
  text-align: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed var(--color-border-default);
}

.bible-header h2 {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  color: var(--color-text-primary);
  margin: 0;
  font-weight: 700;
}

.verse-container {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  color: var(--color-text-primary);
  line-height: 1.8;
}

.description {
  margin: 0;
  color: var(--color-text-secondary);
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* Floating Footer */
.floating-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

.footer-inner {
  width: 100%;
  max-width: 768px;
  display: flex;
  justify-content: flex-end;
  padding: 0 1.5rem 2rem 0;
}

@media (min-width: 768px) {
  .footer-inner {
    justify-content: center;
    padding-right: 0;
  }
}

.action-button {
  pointer-events: auto;
  width: auto;
  background: var(--color-success);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 14px rgba(42, 17, 17, 0.4);
}

.btn-icon {
  width: 20px;
  height: 20px;
}

.action-button:hover {
  background: var(--color-success-dark);
}

.action-button:active {
  transform: scale(0.95);
}

.action-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.action-button.completed {
  background: #ef4444;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
}

.action-button.completed:hover {
  background: #dc2626;
}

/* Animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Mobile Responsive Tweaks */
@media (max-width: 640px) {
  .bible-header h2 {
    font-size: 1.25rem;
  }
  
  .verse-container {
    font-size: 1rem;
  }
}
</style>
