<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, SquarePlay } from '@lucide/vue'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'
import ListCard from '~/components/ui/ListCard.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { introDateRange, introVideoUrl, useIntroProgress, type Intro } from './useIntroProgress'

const props = defineProps<{ id: string }>()
const api = useApi()
const auth = useAuthService()
const { pending, toggle } = useIntroProgress()
const intro = ref<Intro | null>(null)
const loading = ref(true)
const error = ref('')
const canComplete = ref(false)
const mounted = ref(false)
const title = computed(() => intro.value ? `${intro.value.book} 개론` : '개론 영상')
const video = computed(() => intro.value ? introVideoUrl(intro.value.url_link) : null)
let request = 0

async function load() {
  const ticket = ++request
  intro.value = null
  canComplete.value = false
  error.value = ''
  loading.value = true
  if (!mounted.value) return
  if (!/^[1-9]\d*$/.test(props.id) || !Number.isSafeInteger(Number(props.id))) {
    error.value = '개론 영상을 찾을 수 없어요.'
    loading.value = false
    return
  }
  if (auth.authState.value === 'loading') return
  if (auth.authState.value === 'unknown-offline') {
    error.value = '로그인 상태를 확인하지 못했어요. 연결 후 다시 시도해 주세요.'
    loading.value = false
    return
  }
  try {
    const { data } = await api.GET(api.path('/api/v1/todos/video/intro/{id}/', { id: Number(props.id) }))
    if (ticket !== request) return
    let result: Intro = { ...data, is_completed: false, completed_at: null }
    if (auth.isAuthenticated.value) {
      // Detail may be linked from a different plan than the persisted selection.
      const progress = await api.GET('/api/v1/todos/user/video/intro/', { params: { plan_id: data.plan } })
      if (ticket !== request) return
      const ownIntro = progress.data.find(item => item.id === data.id)
      canComplete.value = !!ownIntro
      if (ownIntro) result = ownIntro
    } else {
      canComplete.value = true // Guest activation follows the existing login redirect contract.
    }
    intro.value = result
  } catch {
    if (ticket === request) error.value = '영상 정보를 불러오지 못했어요. 다시 시도해 주세요.'
  } finally {
    if (ticket === request) loading.value = false
  }
}
async function retry() {
  if (auth.authState.value === 'unknown-offline') await auth.initialize()
  await load()
}
watch([mounted, () => props.id, auth.authState, () => auth.user.value?.id], load)
onMounted(() => { mounted.value = true })
onBeforeUnmount(() => { request++ })
</script>

<template>
  <PageLayout :title="title" fallback-path="/intro">
    <template #header-action><AppButton to="/intro" size="sm" variant="ghost">목록</AppButton></template>
    <div class="intro-detail" data-testid="intro-detail" :data-intro-id="intro?.id">
      <div v-if="loading" class="intro-detail-skeleton" role="status" aria-label="개론 영상 불러오는 중" aria-busy="true">
        <div class="intro-video-skeleton"><Skeleton width="100%" height="100%" /></div>
        <Skeleton width="100%" height="48px" /><Skeleton width="100%" height="140px" />
      </div>
      <EmptyState v-else-if="error" data-testid="intro-error" :title="error" action-text="다시 시도" @action="retry" />
      <template v-else-if="intro">
        <div v-if="video?.embed" class="intro-video-frame">
          <iframe data-testid="intro-video" :src="video.embed" :title="`${intro.book} 개론 영상`" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen />
        </div>
        <EmptyState v-else title="이 영상은 외부에서 시청할 수 있어요" :description="video ? '아래 링크에서 영상을 확인해 주세요.' : '시청 가능한 영상 링크가 없습니다.'" />
        <a v-if="video" class="intro-external" data-testid="intro-external" :href="video.external" target="_blank" rel="noopener noreferrer"><SquarePlay :size="20" aria-hidden="true" />{{ video.embed ? 'YouTube 앱으로 시청하기' : '영상 링크 열기' }}</a>
        <ListCard class="intro-content">
          <span class="intro-period">{{ introDateRange(intro) }}</span>
          <h1>{{ intro.book }} 개론</h1>
          <p class="intro-plan">{{ intro.plan_name }}</p>
          <!-- The current API has no duration or description fields. Do not fabricate either. -->
        </ListCard>
        <div class="intro-completion-footer">
          <AppButton v-if="canComplete" data-testid="intro-complete" block size="lg" :variant="intro.is_completed ? 'secondary' : 'primary'" :aria-pressed="intro.is_completed" :loading="pending.has(intro.id)" @click="toggle(intro)"><Check :size="20" aria-hidden="true" />{{ intro.is_completed ? '시청 완료' : '시청 완료하기' }}</AppButton>
          <template v-else><p>이 영상의 시청 기록은 플랜 구독 후 남길 수 있어요.</p><AppButton to="/plans" block size="lg" data-testid="intro-subscribe">플랜 보기</AppButton></template>
        </div>
      </template>
    </div>
  </PageLayout>
</template>

<style scoped>
.intro-detail { padding: 20px var(--screen-gutter) 112px; color: var(--color-text-primary); letter-spacing: var(--tracking-body); }
.intro-video-frame, .intro-video-skeleton { aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--radius-card); background: var(--color-bg-tertiary); }
.intro-video-frame iframe { display: block; width: 100%; height: 100%; border: 0; }
.intro-external { display: flex; justify-content: center; align-items: center; gap: 8px; min-height: var(--hit-min); margin: 14px 0 20px; padding: 8px 16px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-text-primary); text-decoration: none; font-size: 13px; font-weight: 600; }
.intro-external svg { color: var(--color-error); flex-shrink: 0; }
.intro-external:hover { background: var(--color-bg-hover); }
.intro-external:active { transform: scale(.97); }
.intro-period { display: inline-flex; padding: 6px 10px; border-radius: var(--radius-pill); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.intro-content h1 { margin: 16px 0 8px; font-size: 20px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.intro-plan { margin: 0; color: var(--color-text-secondary); font-size: 14px; }
.intro-completion-footer { position: fixed; z-index: 9; left: 0; right: 0; bottom: var(--mobile-nav-height); max-width: var(--content-max); margin: 0 auto; padding: 28px var(--screen-gutter) 12px; background: linear-gradient(to bottom, transparent, var(--color-bg-primary) 28px); }
.intro-completion-footer p { margin: 0 0 8px; text-align: center; font-size: 12px; color: var(--color-text-secondary); }
.intro-detail-skeleton { display: grid; gap: 20px; }
@media (min-width: 1024px) { .intro-detail { padding: 28px 36px 132px; } .intro-completion-footer { left: var(--sidebar-width); bottom: 0; padding: 28px 36px 24px; } }
@media (prefers-reduced-motion: reduce) { .intro-external:active { transform: none; } }
</style>
