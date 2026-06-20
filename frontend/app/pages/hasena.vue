<template>
  <div class="sanctuary-theme">
    <div class="bg-pattern"></div>
    
    <div class="container">
      <!-- Header -->
      <PageHeader title="하세나하시조" back-path="/" />

      <main class="main-content">
        <SkeletonHasenaCard v-if="isLoading" />
        
        <template v-else>
          <!-- 비디오 섹션 -->
          <div class="card video-card fade-in" style="animation-delay: 0.1s">
          <div class="video-wrapper">
            <div class="video-container">
              <iframe 
                width="100%" 
                height="100%" 
                :src="videoUrl" 
                title="YouTube video player" 
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>

            <button 
              v-if="isMobile && latestVideoId" 
              class="youtube-deep-link"
              @click="openYouTubeApp"
            >
              <PlayIcon class="youtube-icon" :size="16" />
              YouTube 앱으로 시청하기
            </button>
          </div>
        </div>

        <!-- AI 요약 섹션 (아코디언) -->
        <div class="card summary-card fade-in" style="animation-delay: 0.15s">
          <!-- 아코디언 헤더 -->
          <button 
            class="accordion-header"
            @click="isSummaryExpanded = !isSummaryExpanded"
            :aria-expanded="isSummaryExpanded"
          >
            <div class="accordion-title">
              <span class="ai-icon">
                <SparklesIcon :size="20" />
                AI 요약
              </span>
              <div class="beta-tooltip-container" @click.stop>
                <span class="beta-tag">BETA</span>
                <div class="tooltip">실험 중인 기능입니다.<br>내용이 정확하지 않을 수 있습니다.</div>
              </div>
            </div>
            <ChevronDownIcon class="accordion-chevron" :class="{ 'expanded': isSummaryExpanded }" :size="20" />
          </button>
          
          <!-- 아코디언 콘텐츠 -->
          <div class="accordion-content" :class="{ 'expanded': isSummaryExpanded }">
            
            <!-- 관리자 버튼 -->
            <div v-if="auth.isStaff?.value && latestVideoId && !summaryLoading" class="admin-actions">
              <button class="summary-btn" @click.stop="generateAISummary">
                {{ summaryContent ? '재생성' : '요약 생성' }}
              </button>
            </div>
            
            <div v-if="summaryLoading || (!summaryContent && !summaryError)" class="summary-skeleton-container">
              <div class="skeleton-line title"></div>
              <div class="skeleton-line text"></div>
              <div class="skeleton-line text"></div>
              <div class="skeleton-line text short"></div>
            </div>
            
            <div v-else-if="summaryError && !summaryContent" class="summary-error">
              <p>{{ summaryError }}</p>
              <button v-if="auth.isStaff?.value" class="retry-btn" @click.stop="generateAISummary">다시 시도</button>
            </div>
            
            <div v-else-if="summaryContent" class="summary-content" v-html="formattedSummary"></div>
          </div>
        </div>

        <!-- 본문 섹션 -->
        <div class="card content-card fade-in" style="animation-delay: 0.2s">
          <!-- 에러 상태 -->
          <div v-if="error" class="state-container error">
            <div class="error-icon">!</div>
            <h3>말씀을 불러올 수 없습니다</h3>
            <p>{{ error }}</p>
          </div>

          <!-- 본문 내용 -->
          <div v-else class="bible-content-wrapper">
            <div class="bible-header">
              <div class="bible-header-top">
                <span class="date-badge">{{ formattedDate }}</span>
                <!-- 읽기 설정 바로가기 -->
                <button class="settings-btn" @click="goToReadingSettings" title="읽기 설정">
                  <SlidersHorizontalIcon :size="18" />
                </button>
              </div>
              <h2>{{ bibleTitle }}</h2>
            </div>

            <div class="verse-container" :style="verseContainerStyle" v-html="sanitizedContent"></div>
          </div>
        </div>

        <!-- 스트릭 & 달력 섹션 (로그인 시에만) -->
        <div v-if="auth.isAuthenticated.value" class="card streak-card fade-in" style="animation-delay: 0.25s">
          <!-- 스트릭 통계 -->
          <div class="streak-stats">
            <div class="streak-item current">
              <FlameIcon class="streak-icon" :size="20" />
              <div class="streak-info">
                <span class="streak-value">{{ hasenaStore.stats.current_streak }}</span>
                <span class="streak-label">현재 연속</span>
              </div>
            </div>
            <div class="streak-item longest">
              <TrophyIcon class="streak-icon" :size="20" />
              <div class="streak-info">
                <span class="streak-value">{{ hasenaStore.stats.longest_streak }}</span>
                <span class="streak-label">최장 연속</span>
              </div>
            </div>
            <div class="streak-item total">
              <CalendarDaysIcon class="streak-icon" :size="20" />
              <div class="streak-info">
                <span class="streak-value">{{ hasenaStore.stats.total_completed }}</span>
                <span class="streak-label">총 완료</span>
              </div>
            </div>
          </div>

          <!-- 달력 버튼 -->
          <button class="calendar-btn" @click="isCalendarOpen = true">
            <CalendarDaysIcon :size="20" />
            <span>전체 기록 보기</span>
            <ChevronRightIcon :size="16" />
          </button>
        </div>
        </template>
      </main>

      <!-- 하단 플로팅 바 -->
      <FloatingBottomBar>
        <template #popover>
          <button
            class="hasena-complete-floating-btn"
            :class="{ completed: isButtonCompleted }"
            :disabled="hasenaStore.isLoading"
            :aria-label="buttonText"
            @click="handleComplete"
          >
            <span v-if="hasenaStore.isLoading" class="loading-spinner nav-spinner" aria-hidden="true"></span>
            <CheckCircleIcon v-else class="hasena-complete-icon" :size="18" aria-hidden="true" />
            <span>{{ buttonText }}</span>
          </button>
        </template>

        <template #center>
          <div class="hasena-status-info">
            <span class="hasena-date">{{ shortFormattedDate }}</span>
            <span class="hasena-range">{{ bibleTitle || '하세나하시조' }}</span>
          </div>
        </template>
      </FloatingBottomBar>

      <!-- Toast 컴포넌트 -->
      <Toast ref="toast" />

      <!-- 달력 모달 -->
      <HasenaCalendarModal 
        :is-open="isCalendarOpen" 
        @close="isCalendarOpen = false"
        @updated="onCalendarUpdated"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useHasenaStore } from '~/stores/hasena'
import { useReadingSettingsStore, FONT_FAMILIES, FONT_WEIGHTS } from '~/stores/readingSettings'
import { useRouter } from 'vue-router'
import { useSanitize } from '~/composables/useSanitize'
import Toast from '~/components/Toast.vue'
import HasenaCalendarModal from '~/components/hasena/HasenaCalendarModal.vue'
import FloatingBottomBar from '~/components/common/FloatingBottomBar.vue'
import SkeletonHasenaCard from '~/components/ui/skeleton/SkeletonHasenaCard.vue'
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlameIcon,
  CheckCircleIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TrophyIcon,
} from '@lucide/vue'
import { formatHasenaSummary, parseHasenaContent } from '~/utils/hasenaFormatters'

const api = useApi()
const auth = useAuthService()
const hasenaStore = useHasenaStore()
const readingSettings = useReadingSettingsStore()
const router = useRouter()
const toast = ref(null)
const { sanitize } = useSanitize()

// 달력 모달 상태
const isCalendarOpen = ref(false)

// AI 요약 아코디언 상태 (기본 닫힘)
const isSummaryExpanded = ref(false)

// 읽기 설정 바로가기
const goToReadingSettings = () => {
  router.push('/bible/settings')
}

// 본문 스타일 (읽기 설정 적용)
const verseContainerStyle = computed(() => ({
  fontFamily: FONT_FAMILIES[readingSettings.settings.fontFamily].css,
  fontSize: `${readingSettings.settings.fontSize}px`,
  fontWeight: FONT_WEIGHTS[readingSettings.settings.fontWeight],
  lineHeight: readingSettings.settings.lineHeight,
}))

const onCalendarUpdated = async () => {
  // 달력에서 업데이트 시 오늘 상태 갱신
  await hasenaStore.fetchStatus()
}

// 비디오 관련 상수
const PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'
const videoUrl = ref(`https://www.youtube.com/embed/videoseries?list=${PLAYLIST_ID}`)
const latestVideoId = ref('') // 빈 값으로 초기화
const isMobile = ref(false)
const isIOS = ref(false)
const isAndroid = ref(false)

// YouTube 앱으로 열기 (네이티브앱 / 모바일웹 분기)
const openYouTubeApp = () => {
  if (!latestVideoId.value) return
  
  const videoId = latestVideoId.value
  const webUrl = `https://www.youtube.com/watch?v=${videoId}`
  
  if (window.__nativeBridge?.isNativeApp()) {
    window.__nativeBridge.sendToNative({ type: 'navigate', url: webUrl })
    return
  }

  if (isIOS.value) {
    const appUrl = `youtube://watch?v=${videoId}`
    window.location.href = appUrl
    setTimeout(() => {
      window.open(webUrl, '_blank')
    }, 2000)
  } else if (isAndroid.value) {
    const intentUrl = `intent://watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
    window.location.href = intentUrl
  } else {
    window.open(webUrl, '_blank')
  }
}

// 상태 변수들
const isLoading = ref(true)
const error = ref(null)
const bibleTitle = ref('')
const parsedContent = ref('')
const sanitizedContent = computed(() => sanitize(parsedContent.value))

// AI 요약 관련 상태
const summaryLoading = ref(false)
const summaryError = ref(null)
const summaryContent = ref('')

// Markdown을 HTML로 변환 (고급 파싱 및 스타일링)
const formattedSummary = computed(() => {
  if (!summaryContent.value) return ''
  
  return sanitize(formatHasenaSummary(summaryContent.value))
})

// AI 요약 조회 (생성 없이)
const loadAISummary = async () => {
  if (!latestVideoId.value) return
  
  summaryLoading.value = true
  summaryError.value = null
  summaryContent.value = ''
  
  try {
    const { data } = await api.get(`/api/v1/todos/hasena/summary/?video_id=${latestVideoId.value}`)
    
    if (data.success) {
      summaryContent.value = data.summary
    }
  } catch (err) {
    const status = err?.response?.status || err?.status
    const apiError = err?.response?.data?.error || err?.data?.error

    summaryError.value = status === 404
      ? (apiError || '오늘 AI 요약은 아직 준비 중입니다.')
      : (apiError || 'AI 요약을 불러오지 못했습니다.')
  } finally {
    summaryLoading.value = false
  }
}

const loadLatestHasenaVideo = async () => {
  if (latestVideoId.value) return

  summaryLoading.value = true
  summaryError.value = null

  try {
    const data = await $fetch('/api/hasena/latest-video')

    if (data?.videoId) {
      latestVideoId.value = data.videoId
      await loadAISummary()
      return
    }

    summaryError.value = '최신 하세나 영상을 찾을 수 없습니다.'
  } catch {
    summaryError.value = '최신 영상 정보를 불러오지 못했습니다.'
  } finally {
    if (!latestVideoId.value) {
      summaryLoading.value = false
    }
  }
}

// AI 요약 생성/재생성 (관리자 전용)
const generateAISummary = async () => {
  if (!latestVideoId.value) {
    summaryError.value = '영상 ID를 가져올 수 없습니다.'
    return
  }
  
  summaryLoading.value = true
  summaryError.value = null
  
  try {
    let data
    
    // 기존 요약이 있으면 재생성 API 호출, 없으면 생성 API 호출
    if (summaryContent.value) {
      // 재생성: POST /api/v1/todos/hasena/summaries/regenerate/
      const response = await api.post('/api/v1/todos/hasena/summaries/regenerate/', {
        video_id: latestVideoId.value
      })
      data = response.data
    } else {
      // 신규 생성: GET /api/v1/todos/hasena/summary/?generate=true
      const response = await api.get(`/api/v1/todos/hasena/summary/?video_id=${latestVideoId.value}&generate=true`)
      data = response.data
    }
    
    if (data.success) {
      summaryContent.value = data.summary
    } else {
      summaryError.value = data.error || '요약을 생성할 수 없습니다.'
    }
  } catch (err) {
    summaryError.value = err?.data?.error || err?.response?.data?.error || '요약 생성 중 오류가 발생했습니다.'
  } finally {
    summaryLoading.value = false
  }
}

// 날짜 관련
const today = new Date()
const formattedDate = ref(new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).format(today))
const shortFormattedDate = computed(() => new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short'
}).format(today))

// API 날짜 포맷
const formatApiDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 하세나 본문 가져오기
const fetchHasenaContent = async () => {
  try {
    isLoading.value = true
    error.value = null

    const targetDate = formatApiDate(today)
    const response = await fetch(`/hasena-proxy/write.php?bo_table=hasena_record&targetDate=${targetDate}&forceView=true`)

    if (!response.ok) {
      throw new Error('본문을 불러오는데 실패했습니다')
    }

    const html = await response.text()
    const content = parseHasenaContent(html)
    bibleTitle.value = content.title
    parsedContent.value = content.html

    // 로그인한 경우에만 완료 상태 조회
    if (auth.isAuthenticated.value) {
      await fetchHasenaStatus()
    }
  } catch (err) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

// 하세나 완료 상태 조회
const fetchHasenaStatus = async () => {
  // 로그인하지 않은 경우 조회하지 않음
  if (!auth.isAuthenticated.value) return
  
  try {
    await hasenaStore.fetchStatus()
  } catch (error) {
    // Toast 컴포넌트 메서드 호출
    if (toast.value) {
      toast.value.show('완료 상태를 불러오는데 실패했습니다', 'error')
    }
  }
}

// 반응형 상태 관리를 위한 computed 속성
const isButtonCompleted = computed(() => hasenaStore.isCompleted)
const buttonText = computed(() => isButtonCompleted.value ? '미완료로 변경' : '완료하기')

// handleComplete 함수 강화
const handleComplete = async () => {
  // 로그인하지 않은 경우 로그인 페이지로 이동
  if (!auth.isAuthenticated.value) {
    router.push(`/login?next=${router.currentRoute.value.fullPath}`)
    return
  }

  if (hasenaStore.isLoading) return

  try {
    await hasenaStore.updateStatus(today)
    await nextTick()
  } catch (error) {
    toast.value?.show('완료 처리에 실패했습니다', 'error')
  }
}

// YouTube 현재 재생 비디오 가져오기
const setupYouTubeListener = () => {
  if (!window.YT) {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
    
    window.onYouTubeIframeAPIReady = () => {
      const iframe = document.querySelector('.video-container iframe')
      if (iframe) {
        // iframe의 ID 설정
        iframe.id = 'hasena-youtube-player'
        
        // iframe src를 API 버전으로 변경
        const currentSrc = iframe.src
        iframe.src = currentSrc + '&enablejsapi=1'
        
        // YouTube Player 인스턴스 생성
                new window.YT.Player('hasena-youtube-player', {
          events: {
            'onReady': (event) => {
              // 플레이어가 준비되면 현재 비디오 ID 가져오기
              const videoId = event.target.getVideoData().video_id

              if (videoId && videoId !== latestVideoId.value) {
                latestVideoId.value = videoId
                loadAISummary()
              }
            }
          }
        })
      }
    }
  }
}

onMounted(async () => {
  const ua = navigator.userAgent
  isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  isIOS.value = /iPhone|iPad|iPod/i.test(ua)
  isAndroid.value = /Android/i.test(ua)

  // 읽기 설정 초기화
  await readingSettings.initialize()

  fetchHasenaContent()
  setupYouTubeListener()
  await loadLatestHasenaVideo()
  
  if (auth.isAuthenticated.value) {
    await hasenaStore.fetchStats()
  }
})
</script>

<style>
/* Global Styles for injected HTML content (hasena-specific) */
.hasena-verse {
  display: flex;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  line-height: 1.8;
}

.hasena-verse-number {
  color: var(--color-accent-primary);
  font-weight: 600;
  margin-right: 0.5rem;
  min-width: 1.2rem;
  font-size: 0.85em;
  padding-top: 0.2em;
  font-family: var(--font-sans);
}

.hasena-verse-text {
  color: var(--color-text-primary);
  flex: 1;
  word-break: keep-all;
  overflow-wrap: break-word;
}
</style>

<style scoped>
/* Sanctuary Theme Variables - Uses global theme tokens */
.sanctuary-theme {
  --font-serif: 'Noto Serif KR', 'RIDIBatang', serif;
  --font-sans: 'Pretendard', sans-serif;
  --primary-color: #6366f1;
  --primary-dark: #4f46e5;
  --color-success: #10b981;
  --color-success-dark: #059669;

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

.container {
  max-width: 768px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  z-index: 1;
  padding-bottom: 3rem;
}

/* Header */
.header {
  position: sticky;
  top: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  background: var(--color-bg-primary);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 50;
  border-bottom: 1px solid var(--color-border-light);
}

.header h1 {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.back-button {
  background: none;
  border: none;
  padding: 0.5rem;
  margin-left: -0.5rem;
  cursor: pointer;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.back-button:hover {
  background: var(--color-bg-hover);
}

.back-button .icon {
  width: 24px;
  height: 24px;
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
  width: 100%;
  padding: 0.75rem;
  background: #ff0000;
  color: white;
  border: none;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.youtube-deep-link:hover {
  background: #cc0000;
}

.youtube-deep-link:active {
  background: #aa0000;
}

.youtube-icon {
  font-size: 1.1rem;
}

/* AI Summary Section - Accordion */
.summary-card {
  padding: 0;
  overflow: visible;
}

/* 아코디언 헤더 */
.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.accordion-header:hover {
  background: var(--color-bg-hover);
}

.accordion-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-primary-hover) 100%);
  color: var(--color-text-inverse);
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.beta-tag {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.accordion-chevron {
  color: var(--color-text-tertiary);
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.accordion-chevron.expanded {
  transform: rotate(180deg);
}

/* 아코디언 콘텐츠 */
.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: 0 1.25rem;
}

.accordion-content.expanded {
  max-height: 2000px;
  padding: 0 1.25rem 1.25rem;
}

.beta-notice {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  text-align: center;
}

.admin-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.summary-btn {
  background: var(--color-accent-primary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.summary-btn:hover {
  background: var(--color-accent-primary-dark, #4f46e5);
  transform: translateY(-1px);
}

.summary-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  padding: 1rem 0;
}

.summary-error {
  background: #fef2f2;
  border-radius: 8px;
  padding: 1rem;
  color: #dc2626;
  font-size: 0.9rem;
}

.summary-error .retry-btn {
  margin-top: 0.75rem;
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.summary-placeholder {
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem 0;
}

/* AI 요약 스켈레톤 */
.summary-skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;
}

.skeleton-line {
  height: 1rem;
  background: var(--color-bg-secondary, rgba(156, 163, 175, 0.2));
  border-radius: 6px;
  animation: skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.skeleton-line.title {
  width: 40%;
  height: 1.4rem;
  margin-bottom: 0.5rem;
}

.skeleton-line.text {
  width: 100%;
}

.skeleton-line.text.short {
  width: 70%;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 요약 콘텐츠 스타일링 (미니멀 디자인) */
.summary-content {
  font-size: 0.95rem;
  line-height: 1.75;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

/* 섹션 공통 스타일 */
.summary-content :deep(.summary-section) {
  /* 배경, 테두리 제거 - 완전한 미니멀리즘 */
  background: transparent;
  padding: 0;
  border: none;
}

.summary-content :deep(.section-title) {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-content :deep(.section-text) {
  font-size: 0.975rem;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.75;
  font-weight: 400;
}

/* 구분선 */
.summary-content :deep(.summary-divider) {
  height: 1px;
  background: var(--color-border-light);
  margin: 0.5rem 0;
  opacity: 0.4;
}

/* 체크리스트 스타일 */
.summary-content :deep(.checklist-container) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-content :deep(.checklist-item) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.25rem 0;
}

.summary-content :deep(.check-icon) {
  flex-shrink: 0;
  width: 20px;
  height: 24px; /* 텍스트 라인하이트와 맞춤 */
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
  margin-top: 2px;
}

.summary-content :deep(.checklist-text) {
  flex: 1;
  font-size: 0.975rem;
  line-height: 1.75;
  color: var(--color-text-primary);
}

/* 하이라이트 (깔끔한 볼드) */
.summary-content :deep(.highlight-text) {
  font-weight: 700;
  color: var(--color-text-primary);
}

/* 다크모드 대응 */
[data-theme="dark"] .summary-content :deep(.section-title) {
  color: var(--color-text-tertiary);
}

[data-theme="dark"] .summary-content :deep(.check-icon) {
  color: var(--color-accent-primary-light);
}

/* 아코디언 헤더 스타일 개선 (미니멀) */
.accordion-header {
  padding: 1.25rem;
}

.ai-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1rem;
  color: var(--color-text-primary);
}

.beta-tooltip-container {
  position: relative;
  display: inline-flex;
  margin-left: 0.5rem;
  cursor: help;
  z-index: 60;
}

.beta-tag {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  letter-spacing: 0.5px;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* 툴팁 스타일 */
.tooltip {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 61;
  transition: all 0.2s ease;
  pointer-events: none;
  text-align: center;
  line-height: 1.4;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: var(--color-text-primary) transparent transparent transparent;
}

.beta-tooltip-container:hover .tooltip,
.beta-tooltip-container:active .tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateX(-50%) translateY(-5px);
}

/* Streak & Calendar Section */
.streak-card {
  padding: 1.25rem;
}

.streak-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 1rem;
}

.streak-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.streak-icon {
  font-size: 1.5rem;
}

.streak-info {
  display: flex;
  flex-direction: column;
}

.streak-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.streak-item.current .streak-value {
  color: #f97316;
}

.streak-item.longest .streak-value {
  color: #eab308;
}

.streak-item.total .streak-value {
  color: var(--color-accent-primary);
}

.streak-label {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

/* Calendar Button */
.calendar-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--color-bg-secondary, var(--color-bg-hover));
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.calendar-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-default);
}

.calendar-btn:active {
  transform: scale(0.98);
}

.calendar-btn svg:first-child {
  color: var(--color-accent-primary);
  flex-shrink: 0;
}

.calendar-btn span {
  flex: 1;
  text-align: left;
}

.calendar-btn svg:last-child {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
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

.bible-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed var(--color-border-default);
}

.bible-header-top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  position: relative;
}

.date-badge {
  display: inline-block;
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.settings-btn {
  position: absolute;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-secondary);
}

.settings-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-accent-primary);
  border-color: var(--color-accent-primary-light);
}

.settings-btn:active {
  transform: scale(0.95);
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
  transition: all 0.2s ease;
}

.hasena-complete-floating-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: calc(100% - 48px);
  max-width: 360px;
  min-height: 46px;
  padding: 0.75rem 1.25rem;
  color: white;
  background: linear-gradient(135deg, var(--color-success) 0%, #34d399 100%);
  border: none;
  border-radius: 12px;
  box-shadow:
    0 10px 24px rgba(16, 185, 129, 0.28),
    0 3px 8px rgba(16, 185, 129, 0.2);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.hasena-complete-floating-btn.completed {
  background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
  box-shadow:
    0 10px 24px rgba(239, 68, 68, 0.24),
    0 3px 8px rgba(239, 68, 68, 0.18);
}

.hasena-complete-floating-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-success-dark) 0%, var(--color-success) 100%);
  transform: translateY(-2px);
}

.hasena-complete-floating-btn.completed:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
}

.hasena-complete-floating-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.hasena-complete-floating-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
}

.hasena-complete-icon {
  flex-shrink: 0;
}

.hasena-status-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding: 0.25rem 0.5rem;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  pointer-events: none;
}

.hasena-date {
  color: var(--color-text-tertiary);
  font-size: clamp(0.5625rem, 2vw, 0.6875rem);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.hasena-range {
  color: var(--color-text-primary);
  font-size: clamp(0.6875rem, 2.5vw, 0.8125rem);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-spinner {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

[data-theme="dark"] .hasena-status-info {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
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
