import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useToast } from '~/composables/useToast'
import type { components } from '~/types/generated/api-schema'

export type Intro = components['schemas']['UserVideoIntro']
export type PublicIntro = components['schemas']['VideoBibleIntro']

export function introDateRange(intro: PublicIntro): string {
  const short = (date: string) => date.split('-').slice(1).map(Number).join('/')
  return `${short(intro.start_date)}–${short(intro.end_date)}`
}

export function isCurrentIntro(intro: PublicIntro, now = new Date()): boolean {
  // API dates are calendar dates, not UTC instants. Compare in the reader's local day.
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return intro.start_date <= today && today <= intro.end_date
}

export function introVideoUrl(raw: string): { external: string; embed: string | null } | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const host = url.hostname.toLowerCase()
    let id: string | null = null
    if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v')
      if (!id && /^\/(embed|shorts|v)\//.test(url.pathname)) id = url.pathname.split('/')[2] ?? null
    }
    return { external: url.href, embed: id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null }
  } catch {
    return null
  }
}

export function useIntroProgress() {
  const api = useApi()
  const auth = useAuthService()
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const pending = reactive(new Set<number>())

  async function toggle(intro: Intro) {
    if (auth.authState.value === 'unauthenticated') {
      await router.push({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    if (!auth.isAuthenticated.value || pending.has(intro.id)) return
    const userId = auth.user.value?.id
    pending.add(intro.id)
    try {
      const result = await api.POST('/api/v1/todos/video/intro/progress/', {
        video_intro_id: intro.id,
        is_completed: !intro.is_completed,
      })
      if (result.video_intro_id !== intro.id) throw new Error('Unexpected intro completion acknowledgement')
      if (!auth.isAuthenticated.value || auth.user.value?.id !== userId) return
      // Only an acknowledged write changes counts and completion. The POST facade returns the body directly.
      intro.is_completed = result.is_completed
      intro.completed_at = result.completed_at
      toast.success(result.is_completed ? '시청 완료로 기록했어요.' : '시청 완료 표시를 해제했어요.')
    } catch {
      toast.error('시청 상태를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      pending.delete(intro.id)
    }
  }
  return { pending, toggle }
}
