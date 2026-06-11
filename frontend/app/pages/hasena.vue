<template>
  <div class="sanctuary-theme">
    <div class="bg-pattern"></div>
    
    <div class="container">
      <!-- Header -->
      <PageHeader title="하세나하시조" fallback-path="/" />

      <main class="main-content">
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
              <span class="youtube-icon">▶</span>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 4V10M15 10V16M15 10H9M15 10H21M6 16V20M6 20V24M6 20H2M6 20H10" stroke="url(#paint0_linear)" stroke-width="2" stroke-linecap="round"/>
                  <defs>
                    <linearGradient id="paint0_linear" x1="2" y1="4" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#6366f1"/>
                      <stop offset="1" stop-color="#a855f7"/>
                    </linearGradient>
                  </defs>
                </svg>
                AI 요약
              </span>
              <div class="beta-tooltip-container" @click.stop>
                <span class="beta-tag">BETA</span>
                <div class="tooltip">실험 중인 기능입니다.<br>내용이 정확하지 않을 수 있습니다.</div>
              </div>
            </div>
            <svg 
              class="accordion-chevron" 
              :class="{ 'expanded': isSummaryExpanded }"
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          <!-- 아코디언 콘텐츠 -->
          <div class="accordion-content" :class="{ 'expanded': isSummaryExpanded }">
            
            <!-- 관리자 버튼 -->
            <div v-if="auth.isStaff?.value && latestVideoId && !summaryLoading" class="admin-actions">
              <button class="summary-btn" @click.stop="generateAISummary">
                {{ summaryContent ? '재생성' : '요약 생성' }}
              </button>
            </div>
            
            <div v-if="summaryLoading" class="summary-loading">
              <div class="loading-spinner small"></div>
              <span>AI가 영상을 분석하고 있습니다...</span>
            </div>
            
            <div v-else-if="summaryError && !summaryContent" class="summary-error">
              <p>{{ summaryError }}</p>
              <button v-if="auth.isStaff?.value" class="retry-btn" @click.stop="generateAISummary">다시 시도</button>
            </div>
            
            <div v-else-if="summaryContent" class="summary-content" v-html="formattedSummary"></div>
            
            <div v-else class="summary-placeholder">
              <p>오늘의 요약이 곧 준비됩니다</p>
            </div>
          </div>
        </div>

        <!-- 본문 섹션 -->
        <div class="card content-card fade-in" style="animation-delay: 0.2s">
          <!-- 로딩 상태 -->
          <div v-if="isLoading" class="state-container loading">
            <div class="loading-spinner"></div>
            <p>오늘의 말씀을 불러오고 있습니다...</p>
          </div>

          <!-- 에러 상태 -->
          <div v-else-if="error" class="state-container error">
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 6h16M4 12h16M4 18h7" />
                    <circle cx="17" cy="18" r="3" />
                  </svg>
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
              <span class="streak-icon">🔥</span>
              <div class="streak-info">
                <span class="streak-value">{{ hasenaStore.stats.current_streak }}</span>
                <span class="streak-label">현재 연속</span>
              </div>
            </div>
            <div class="streak-item longest">
              <span class="streak-icon">🏆</span>
              <div class="streak-info">
                <span class="streak-value">{{ hasenaStore.stats.longest_streak }}</span>
                <span class="streak-label">최장 연속</span>
              </div>
            </div>
            <div class="streak-item total">
              <span class="streak-icon">📅</span>
              <div class="streak-info">
                <span class="streak-value">{{ hasenaStore.stats.total_completed }}</span>
                <span class="streak-label">총 완료</span>
              </div>
            </div>
          </div>

          <!-- 달력 버튼 -->
          <button class="calendar-btn" @click="isCalendarOpen = true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>전체 기록 보기</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </main>

      <!-- 하단 플로팅 버튼 -->
      <div class="floating-footer fade-in" style="animation-delay: 0.3s">
        <div class="footer-inner">
          <button 
            class="action-button" 
            :class="{ 'completed': isButtonCompleted }" 
            :disabled="hasenaStore.isLoading"
            @click="handleComplete"
          >
            <span v-if="hasenaStore.isLoading" class="loading-spinner small"></span>
            <template v-else>
              <CheckCircleIcon class="btn-icon" />
              <span>{{ buttonText }}</span>
            </template>
          </button>
        </div>
      </div>

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
import ChevronLeftIcon from '~/components/icons/ChevronLeftIcon.vue'
import CheckCircleIcon from '~/components/icons/CheckCircleIcon.vue'
import HasenaCalendarModal from '~/components/hasena/HasenaCalendarModal.vue'

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
  
  let text = summaryContent.value
  
  // 1. 텍스트 전처리 (줄바꿈 정규화)
  text = text.replace(/\r\n/g, '\n')
  
  // 2. 섹션별 내용 추출 (비탐욕적 매칭 사용)
  // 본문: **오늘의 본문** 부터 **교역자 해설** 전까지
  const bibleMatch = text.match(/\*\*오늘의 본문\*\*([\s\S]*?)(?=\*\*교역자 해설\*\*)/)
  let bibleContent = bibleMatch ? bibleMatch[1].trim() : ''
  
  // 해설: **교역자 해설** 부터 **오늘의 하시조** (또는 하시조) 전까지
  const commentaryMatch = text.match(/\*\*교역자 해설\*\*([\s\S]*?)(?=\*\*.*하시조.*\*\*)/)
  let commentaryContent = commentaryMatch ? commentaryMatch[1].trim() : ''
  
  // 하시조: **오늘의 하시조** (또는 하시조) 부터 끝까지
  const actionMatch = text.match(/\*\*.*하시조.*\*\*([\s\S]*)$/)
  let actionContent = actionMatch ? actionMatch[1].trim() : ''
  
  // 만약 파싱에 실패했다면 (구형 포맷 등), 전체를 그냥 텍스트로 보여주기보다
  // 최소한의 포맷팅이라도 적용
  if (!bibleContent && !commentaryContent && !actionContent) {
     // 기존 1. **오늘의 본문** 포맷일 수 있음
     const oldFormatBible = text.match(/1\.\s*\*\*오늘의 본문\*\*[:\s]*([\s\S]*?)(?=2\.\s*\*\*교역자 해설\*\*)/)
     if (oldFormatBible) {
       bibleContent = oldFormatBible[1].trim()
       
       const oldFormatComm = text.match(/2\.\s*\*\*교역자 해설\*\*[:\s]*([\s\S]*?)(?=3\.\s*\*\*.*하시조.*\*\*)/)
       commentaryContent = oldFormatComm ? oldFormatComm[1].trim() : ''
       
       const oldFormatAction = text.match(/3\.\s*\*\*.*하시조.*\*\*[:\s]*([\s\S]*)$/)
       actionContent = oldFormatAction ? oldFormatAction[1].trim() : ''
     }
  }
  
  // 3. 내용이 없으면 원본 텍스트 반환 (fallback)
  if (!bibleContent && !commentaryContent && !actionContent) {
    return sanitize(text.replace(/\n/g, '<br>'))
  }
  
  // 4. 각 섹션 내부 스타일링 함수
  const processText = (str) => {
    if (!str) return ''
    return str
      .replace(/\*\*(.+?)\*\*/g, '<span class="highlight-text">$1</span>') // 볼드 강조
      .replace(/\n/g, '<br>') // 줄바꿈
  }
  
  const processChecklist = (str) => {
    if (!str) return ''
    // 체크리스트 항목 파싱 (- [ ] 또는 - 또는 *)
    return str.replace(
      /^\s*[-*]\s*(\[\s*\])?\s*(.+)$/gm,
      `<div class="checklist-item">
         <span class="check-icon">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
             <path d="M20 6 9 17 4 12"></path>
           </svg>
         </span>
         <span class="checklist-text">$2</span>
       </div>`
    ).replace(/\n/g, '') // 체크리스트 사이 줄바꿈 제거 (flex gap으로 처리)
  }

  // 5. HTML 조립 (미니멀 디자인)
  let html = ''
  
  if (bibleContent) {
    html += `<div class="summary-section bible-section">
       <h4 class="section-title">오늘의 본문</h4>
       <div class="section-body">
         <p class="section-text">${processText(bibleContent)}</p>
       </div>
     </div>`
  }
  
  if (commentaryContent) {
    html += `<div class="summary-section commentary-section">
       <h4 class="section-title">교역자 해설</h4>
       <div class="section-body">
         <p class="section-text">${processText(commentaryContent)}</p>
       </div>
     </div>`
  }
  
  if (actionContent) {
    html += `<div class="summary-divider"></div>
     <div class="summary-section action-section">
       <h4 class="section-title">오늘의 하시조</h4>
       <div class="checklist-container">
         ${processChecklist(actionContent)}
       </div>
     </div>`
  }

  return sanitize(html)
})

// AI 요약 조회 (생성 없이)
const loadAISummary = async () => {
  if (!latestVideoId.value) return
  
  summaryLoading.value = true
  summaryError.value = null
  
  try {
    const { data } = await api.get(`/api/v1/todos/hasena/summary/?video_id=${latestVideoId.value}`)
    
    if (data.success) {
      summaryContent.value = data.summary
    }
  } catch (err) {
    // 요약이 없는 경우는 정상 - 로그 불필요
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

// API 날짜 포맷
const formatApiDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 하세나 본문 파싱
const parseHasenaContent = (html) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 성경 제목 추출
  const titleElement = doc.querySelector('.bible_tit')
  if (titleElement) {
    bibleTitle.value = titleElement.textContent
  }

  // 본문 내용 추출 및 변환
  const verses = []
  const contentElements = doc.querySelectorAll('.bible_contents p')

  contentElements.forEach(verse => {
    const number = verse.querySelector('.bullet_number')?.textContent.trim()
    const text = verse.querySelector('.bullet_txt')?.textContent.trim()

    if (number && text) {
      verses.push(`
        <div class="hasena-verse">
          <span class="hasena-verse-number">${number}</span>
          <span class="hasena-verse-text">${text}</span>
        </div>
      `)
    }
  })

  return verses.join('')
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
    parsedContent.value = parseHasenaContent(html)

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
              latestVideoId.value = event.target.getVideoData().video_id
              // 비디오 ID 확보 후 요약 조회
              loadAISummary()
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
  overflow: hidden;
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
  z-index: 10;
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
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
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
