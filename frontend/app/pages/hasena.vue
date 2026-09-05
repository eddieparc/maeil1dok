<template>
  <PageLayout title="하세나하시조" fallback-path="/">
    <template #header-action>
      <button class="calendar-header-btn" aria-label="전체 기록 보기" @click="isCalendarOpen = true">
        <CalendarDaysIcon :size="22" aria-hidden="true" />
      </button>
    </template>
    <div class="sanctuary-theme">
    
    <div class="sanctuary-container">
      <main class="main-content">
        <SkeletonHasenaCard v-if="isLoading" />
        
        <template v-else>
          <!-- 비디오 섹션 -->
          <div class="card video-card fade-in" style="animation-delay: var(--stagger)">
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
        <div class="card summary-card fade-in" style="animation-delay: calc(2 * var(--stagger))">
          <!-- 아코디언 헤더 -->
          <button 
            class="accordion-header"
            @click="isSummaryExpanded = !isSummaryExpanded"
            :aria-expanded="isSummaryExpanded"
            aria-controls="hasena-summary"
            aria-describedby="hasena-beta-tooltip"
          >
            <div class="accordion-title">
              <span class="ai-icon">
                <SparklesIcon :size="20" />
                AI 요약
              </span>
              <div class="beta-tooltip-container" @click.stop>
                <span class="beta-tag">BETA</span>
                <div id="hasena-beta-tooltip" class="tooltip" role="tooltip">실험 중인 기능입니다.<br>내용이 정확하지 않을 수 있습니다.</div>
              </div>
            </div>
            <ChevronDownIcon class="accordion-chevron" :class="{ 'expanded': isSummaryExpanded }" :size="20" />
          </button>
          
          <!-- 아코디언 콘텐츠 -->
          <div id="hasena-summary" class="accordion-content" :class="{ 'expanded': isSummaryExpanded }" :inert="!isSummaryExpanded">
            
            <!-- 관리자 버튼 -->
            <div v-if="auth.isStaff?.value && latestVideoId && !summaryLoading" class="admin-actions">
              <AppButton variant="secondary" size="sm" @click.stop="generateAISummary">
                {{ summaryContent ? '재생성' : '요약 생성' }}
              </AppButton>
            </div>
            
            <div v-if="summaryLoading || (!summaryContent && !summaryError)" class="summary-skeleton-container">
              <Skeleton width="40%" :height="22" />
              <Skeleton />
              <Skeleton />
              <Skeleton width="70%" />
            </div>
            
            <div v-else-if="summaryError && !summaryContent" class="summary-error">
              <p>{{ summaryError }}</p>
              <AppButton v-if="auth.isStaff?.value" variant="danger" size="sm" @click.stop="generateAISummary">다시 시도</AppButton>
            </div>
            
            <div v-else-if="summaryContent" class="summary-content" v-html="formattedSummary"></div>
          </div>
        </div>

        <!-- 본문 섹션 -->
        <div class="card content-card fade-in" style="animation-delay: calc(3 * var(--stagger))">
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
                <button class="settings-btn" @click="goToReadingSettings" title="읽기 설정" aria-label="읽기 설정">
                  <SlidersHorizontalIcon :size="18" />
                </button>
              </div>
              <h2>{{ bibleTitle }}</h2>
            </div>

            <div class="verse-container" :style="verseContainerStyle" v-html="sanitizedContent"></div>
          </div>
        </div>

        <div class="completion-dock">
        <div class="inline-complete-action">
          <button
            class="hasena-complete-floating-btn complete-button"
            :class="{ completed: isButtonCompleted }"
            :disabled="hasenaStore.isLoading"
            :aria-label="buttonText"
            :aria-pressed="isButtonCompleted"
            :aria-busy="hasenaStore.isLoading"
            @click="handleComplete"
          >
            <span v-if="hasenaStore.isLoading" class="loading-spinner nav-spinner" aria-hidden="true"></span>
            <CheckCircleIcon v-else class="hasena-complete-icon" :size="20" aria-hidden="true" />
            <span>{{ buttonText }}</span>
          </button>
        </div>

        <!-- 스트릭 통계와 기록 링크 (로그인 시에만) -->
        <div v-if="auth.isAuthenticated.value" class="card streak-card">
          <p class="streak-stats" aria-live="polite" aria-atomic="true">
            <span>연속 <strong>{{ hasenaStore.stats.current_streak }}</strong>일</span>
            <span aria-hidden="true">·</span>
            <span>최장 <strong>{{ hasenaStore.stats.longest_streak }}</strong>일</span>
            <span aria-hidden="true">·</span>
            <span>총 <strong>{{ hasenaStore.stats.total_completed }}</strong>회</span>
          </p>
          <button class="calendar-btn" aria-label="전체 기록 보기" @click="isCalendarOpen = true">
            기록 <ChevronRightIcon :size="14" aria-hidden="true" />
          </button>
        </div>
        </div>
        </template>
      </main>

      <!-- Toast 컴포넌트 -->
      <Toast ref="toast" />

      <!-- 달력 모달 -->
      <HasenaCalendarModal 
        :is-open="isCalendarOpen" 
        :selected-date="selectedDate"
        @close="isCalendarOpen = false"
        @updated="onCalendarUpdated"
        @select-date="selectHasenaDate"
      />
    </div>
  </div>
  </PageLayout>
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
import SkeletonHasenaCard from '~/components/ui/skeleton/SkeletonHasenaCard.vue'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import PageLayout from '~/components/common/PageLayout.vue'
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon as CheckCircleIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from '@lucide/vue'
import { formatHasenaSummary } from '~/utils/hasenaFormatters'
import { buildHasenaEmbedUrl, withJsApiEnabled } from '~/utils/hasenaVideoUrl'

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
  await fetchHasenaContent()
}

// 비디오 관련 상수
// 처음부터 iframe API가 켜진 URL로 렌더한다.
// 마운트 후 iframe.src를 갈아끼우면 진행 중인 플레이어 로드가 취소되고
// 임베드가 광고 서브프레임 네비게이션을 다시 일으켜, iOS WebView에서
// 첫 진입 시 전체화면 에러로 이어졌다(LAB-59).
const videoUrl = computed(() => withJsApiEnabled(buildHasenaEmbedUrl(latestVideoId.value)))
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
    const { data } = await api.GET('/api/v1/todos/hasena/summary/', {
      params: { video_id: latestVideoId.value }
    })
    
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
      data = await api.POST('/api/v1/todos/hasena/summaries/regenerate/', {
        video_id: latestVideoId.value
      })
    } else {
      // 신규 생성: GET /api/v1/todos/hasena/summary/?generate=true
      const response = await api.GET('/api/v1/todos/hasena/summary/', {
        params: {
          video_id: latestVideoId.value,
          generate: true
        }
      })
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
const formatApiDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const selectedDate = ref(formatApiDate(today))
const selectedDateObj = computed(() => new Date(`${selectedDate.value}T00:00:00`))
const formattedDate = computed(() => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).format(selectedDateObj.value))

// 하세나 본문 가져오기
const fetchHasenaContent = async () => {
  try {
    isLoading.value = true
    error.value = null
    summaryError.value = null
    summaryContent.value = ''

    const { data } = await api.GET('/api/v1/todos/hasena/day/', {
      params: { date: selectedDate.value }
    })

    if (!data?.success || !data.entry) {
      throw new Error(data?.error || '본문을 불러오는데 실패했습니다')
    }

    const entry = data.entry
    bibleTitle.value = entry.passage || entry.title || '하세나하시조'
    parsedContent.value = renderHasenaVerses(entry.verses || [])
    latestVideoId.value = entry.video_id || ''
    hasenaStore.setCompletionStatus(Boolean(data.is_completed))
    await loadAISummary()
  } catch (err) {
    error.value = err?.message || '본문을 불러오는데 실패했습니다'
    latestVideoId.value = ''
  } finally {
    isLoading.value = false
  }
}

const renderHasenaVerses = (verses) => {
  return verses.map((verse) => `
    <div class="hasena-verse">
      <span class="hasena-verse-number">${escapeHtml(verse.number || '')}</span>
      <span class="hasena-verse-text">${escapeHtml(verse.text || '')}</span>
    </div>
  `).join('')
}

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const selectHasenaDate = async (date) => {
  selectedDate.value = date
  await fetchHasenaContent()
  if (auth.isAuthenticated.value) {
    await hasenaStore.fetchStats()
  }
}

// 반응형 상태 관리를 위한 computed 속성
const isButtonCompleted = computed(() => hasenaStore.isCompleted)
const buttonText = computed(() => isButtonCompleted.value ? '오늘 하세나 완료' : '하세나 완료하기')

// handleComplete 함수 강화
const handleComplete = async () => {
  // 로그인하지 않은 경우 로그인 페이지로 이동
  if (!auth.isAuthenticated.value) {
    router.push(`/login?next=${router.currentRoute.value.fullPath}`)
    return
  }

  if (hasenaStore.isLoading) return

  try {
    await hasenaStore.updateStatus(selectedDateObj.value)
    await Promise.all([fetchHasenaContent(), hasenaStore.fetchStats()])
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

        // src는 이미 enablejsapi=1로 렌더되어 있으므로 다시 쓰지 않는다.
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

  await fetchHasenaContent()
  setupYouTubeListener()
  
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
  gap: 10px;
  margin-bottom: 12px;
  line-height: inherit;
}

.hasena-verse-number {
  color: var(--color-accent-primary);
  font-weight: 600;
  flex: 0 0 18px;
  text-align: right;
  font-size: 12px;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
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
  font-family: var(--font-sans);
  letter-spacing: var(--tracking-body);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  min-height: 100vh;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

.sanctuary-container {
  max-width: 768px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

/* Main Content */
.main-content {
  padding: 20px var(--screen-gutter) 148px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  border: 1px solid var(--color-border-default);
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
  background: linear-gradient(160deg, var(--color-tooltip-bg), var(--color-apple-bg));
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
  min-height: var(--hit-min);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: none;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-micro) ease;
}

.youtube-deep-link:hover {
  background: var(--color-bg-hover);
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
  min-height: var(--hit-min);
  padding: 16px var(--card-padding);
  background: transparent;
  border: none;
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: background var(--duration-micro) ease;
}

.accordion-header:hover {
  background: var(--color-bg-hover);
}

.accordion-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.accordion-chevron {
  color: var(--color-text-tertiary);
  transition: transform var(--duration-standard) ease;
  flex-shrink: 0;
}

.accordion-chevron.expanded {
  transform: rotate(180deg);
}

/* 아코디언 콘텐츠 */
.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height var(--duration-standard) ease, padding var(--duration-standard) ease;
  padding: 0 1.25rem;
}

.accordion-content.expanded {
  max-height: 2000px;
  padding: 0 1.25rem 1.25rem;
}

.admin-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.summary-error {
  background: var(--color-error-bg);
  border-radius: var(--radius-control);
  padding: 16px;
  color: var(--color-error-text);
  font-size: 14px;
}

/* AI 요약 스켈레톤 */
.summary-skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;
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

.ai-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 15px;
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
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  padding: 4px 8px;
  border-radius: var(--radius-pill);
}

/* 툴팁 스타일 */
.tooltip {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  background: var(--color-tooltip-bg);
  color: var(--color-tooltip-text);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  z-index: 61;
  transition: opacity var(--duration-micro) ease, transform var(--duration-micro) ease;
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
  border-color: var(--color-tooltip-bg) transparent transparent transparent;
}

.beta-tooltip-container:hover .tooltip,
.beta-tooltip-container:active .tooltip,
.accordion-header:focus-visible .tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateX(-50%) translateY(-5px);
}

/* Streak & Calendar Section */
.streak-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  border: 0;
  box-shadow: none;
  overflow: visible;
}

.streak-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.streak-stats strong {
  font-weight: 700;
  color: var(--color-text-primary);
}

.calendar-btn,
.calendar-header-btn,
.settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  cursor: pointer;
  color: var(--color-accent-primary);
  transition: background var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.calendar-btn {
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.calendar-btn:hover,
.calendar-header-btn:hover,
.settings-btn:hover {
  background: var(--color-bg-hover);
}

/* Content Section */
.content-card {
  position: relative;
  flex: 1;
  padding: var(--card-padding) var(--card-padding) 8px;
  min-height: 200px;
}

.content-card::after {
  content: '';
  display: block;
  position: sticky;
  bottom: 0;
  height: 60px;
  margin-top: -60px;
  background: linear-gradient(to bottom, transparent, var(--color-bg-card));
  pointer-events: none;
}

.bible-content-wrapper {
  padding-bottom: 60px;
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
  background: var(--color-error-bg);
  color: var(--color-error);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.25rem;
}

.bible-header {
  text-align: left;
  margin-bottom: 20px;
}

.bible-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.date-badge {
  display: inline-block;
  background: var(--color-accent-bg);
  color: var(--color-accent-primary);
  padding: 4px 8px;
  border-radius: var(--radius-control);
  font-size: 12px;
  font-weight: 600;
}

.settings-btn {
  color: var(--color-text-secondary);
}

.bible-header h2 {
  font-family: var(--font-sans);
  font-size: 22px;
  line-height: 1.3;
  letter-spacing: var(--tracking-display);
  color: var(--color-text-primary);
  margin: 0;
  font-weight: 700;
}

.verse-container {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.75;
  color: var(--color-text-primary);
}

.inline-complete-action {
  display: flex;
  justify-content: center;
}

.completion-dock {
  position: fixed;
  z-index: 20;
  inset-inline: 0;
  bottom: calc(var(--tabbar-height) + max(env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px)));
  width: auto;
  max-width: 768px;
  margin-inline: auto;
  padding: 24px var(--screen-gutter) 8px;
  box-sizing: border-box;
  background: linear-gradient(to bottom, transparent, var(--color-bg-primary) 24px);
}

.complete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 52px;
  padding: 0 20px;
  color: var(--color-text-inverse);
  background: var(--color-accent-primary);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-cta);
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  transition: background var(--duration-standard) ease, color var(--duration-standard) ease, transform var(--duration-micro) ease;
  -webkit-tap-highlight-color: transparent;
}

.complete-button.completed {
  background: var(--color-accent-bg);
  color: var(--color-accent-primary);
}

.complete-button:hover:not(:disabled):not(.completed) {
  background: var(--color-accent-primary-hover);
}

.complete-button.completed:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.complete-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.complete-button.completed .hasena-complete-icon {
  animation: hasena-check-pop var(--duration-pop) var(--ease-spring);
}

[data-theme="dark"] .complete-button.completed {
  border: 1.5px solid var(--color-accent-primary);
}

.hasena-complete-icon {
  flex-shrink: 0;
}

.nav-spinner {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes hasena-check-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}

button:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  border-color: var(--color-accent-primary);
}

button:active:not(:disabled) {
  transform: scale(0.97);
}

@media (min-width: 1024px) {
  .completion-dock {
    inset-inline-start: var(--sidebar-width);
    bottom: max(0px, env(safe-area-inset-bottom, 0px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .complete-button.completed .hasena-complete-icon,
  .loading-spinner {
    animation: none;
  }

  button,
  .accordion-chevron,
  .accordion-content,
  .tooltip {
    transition: none;
  }

  button:active:not(:disabled) {
    transform: none;
  }
}
</style>
