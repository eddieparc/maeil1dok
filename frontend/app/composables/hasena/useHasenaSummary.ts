import { computed, ref, type Ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useSanitize } from '~/composables/useSanitize'
import { formatHasenaSummary } from '~/utils/hasenaFormatters'

interface SummaryFailureBody {
  error?: string
  error_message?: string | null
}

/**
 * 하세나 AI 요약 상태 + 조회/생성 (pages/hasena.vue에서 추출, LAB-146 WP-10).
 *
 * `latestVideoId`는 페이지가 소유한다 — YouTube 플레이어 onReady가 실제 재생
 * 중인 video_id를 뒤늦게 알려주는 경로가 있어 요약 composable이 아니라
 * 페이지가 진실 소스를 들고, 여기서는 읽기만 한다.
 */
export const useHasenaSummary = (latestVideoId: Ref<string>) => {
  const api = useApi()
  const { sanitize } = useSanitize()

  const summaryLoading = ref(false)
  const summaryError = ref<string | null>(null)
  const summaryContent = ref('')

  // Markdown을 HTML로 변환 (고급 파싱 및 스타일링)
  const formattedSummary = computed(() => {
    if (!summaryContent.value) return ''
    return sanitize(formatHasenaSummary(summaryContent.value))
  })

  const resetSummary = () => {
    summaryError.value = null
    summaryContent.value = ''
  }

  // AI 요약 조회 (생성 없이)
  const loadAISummary = async () => {
    const videoId = latestVideoId.value

    // 본문 표시를 막지 않도록 페이지는 이 조회를 기다리지 않는다 (LAB-133).
    // 늦게 도착한 이전 영상 응답이 현재 요약을 덮지 않게 video_id로 가른다.
    summaryLoading.value = Boolean(videoId)
    resetSummary()
    if (!videoId) return

    try {
      const { data } = await api.GET('/api/v1/todos/hasena/summary/', {
        params: { video_id: videoId }
      })

      if (videoId === latestVideoId.value && data.success) {
        summaryContent.value = data.summary
      }
    } catch (err: any) {
      if (videoId !== latestVideoId.value) return
      const status = err?.response?.status || err?.status
      const apiError = err?.response?.data?.error || err?.data?.error

      summaryError.value = status === 404
        ? (apiError || '오늘 AI 요약은 아직 준비 중입니다.')
        : (apiError || 'AI 요약을 불러오지 못했습니다.')
    } finally {
      if (videoId === latestVideoId.value) summaryLoading.value = false
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
      let data: { success: boolean; summary?: string } & SummaryFailureBody

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
        summaryContent.value = data.summary ?? ''
      } else {
        summaryError.value = data.error || data.error_message || '요약을 생성할 수 없습니다.'
      }
    } catch (err: any) {
      summaryError.value = err?.data?.error || err?.response?.data?.error || '요약 생성 중 오류가 발생했습니다.'
    } finally {
      summaryLoading.value = false
    }
  }

  return {
    summaryLoading,
    summaryError,
    summaryContent,
    formattedSummary,
    resetSummary,
    loadAISummary,
    generateAISummary,
  }
}
