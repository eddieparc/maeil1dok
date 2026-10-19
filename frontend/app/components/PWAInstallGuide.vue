<script setup lang="ts">
import { useCdnAsset } from '~/composables/useCdnAsset';
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { Check, Download, Globe, Image, Plus, Share2 } from '@lucide/vue'
import AppButton from '~/components/ui/AppButton.vue'
import ListCard from '~/components/ui/ListCard.vue'
import SegmentedControl from '~/components/ui/SegmentedControl.vue'
import InstallImageViewer from '~/components/install/InstallImageViewer.vue'
const { cdnAsset } = useCdnAsset();

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
type InstallPhase = 'unavailable' | 'prompting' | 'accepted' | 'dismissed' | 'error'
const selectedPlatform = ref<string | number>('ios')
const platforms = [
  { value: 'ios', label: 'iPhone · iPad', id: 'install-tab-ios', controls: 'install-panel-ios' },
  { value: 'android', label: 'Android', id: 'install-tab-android', controls: 'install-panel-android' },
]
const deferredPrompt = shallowRef<InstallPromptEvent | null>(null)
const installed = ref(false)
const prompting = ref(false)
const phase = ref<InstallPhase>('unavailable')
const canPrompt = computed(() => selectedPlatform.value === 'android' && !!deferredPrompt.value && !installed.value && !prompting.value)
const installState = computed(() => installed.value ? 'installed' : canPrompt.value ? 'available' : phase.value)
const statusMessage = computed(() => ({
  unavailable: '',
  prompting: '브라우저의 설치 창에서 선택을 완료해주세요.',
  accepted: '설치 요청을 수락했어요. 브라우저에서 설치가 완료되면 홈 화면의 아이콘으로 열어주세요.',
  dismissed: '설치를 취소했어요. 아래 안내로 홈 화면에 추가할 수 있어요.',
  error: '설치 창을 열거나 결과를 확인하지 못했어요. 아래 안내에 따라 브라우저 메뉴에서 설치해주세요.',
})[phase.value])
let displayMode: MediaQueryList | undefined
let active = false

function markInstalled() {
  installed.value = true
  deferredPrompt.value = null
  prompting.value = false
}
function checkStandalone() {
  if (displayMode?.matches || (navigator as Navigator & { standalone?: boolean }).standalone) markInstalled()
}
function capturePrompt(event: Event) {
  if (installed.value || prompting.value) return
  event.preventDefault()
  deferredPrompt.value = event as InstallPromptEvent
  phase.value = 'unavailable'
}
async function promptInstall() {
  const event = deferredPrompt.value
  if (!canPrompt.value || !event) return
  // A BeforeInstallPromptEvent is single-use. Consume it before any await or second click.
  deferredPrompt.value = null
  prompting.value = true
  phase.value = 'prompting'
  try {
    // Observe both browser promises immediately; either can fail before the other settles.
    const [, choice] = await Promise.all([event.prompt(), event.userChoice])
    if (active && !installed.value) phase.value = choice.outcome
  } catch {
    if (active && !installed.value) phase.value = 'error'
  } finally {
    if (active) prompting.value = false
  }
}
onMounted(() => {
  active = true
  selectedPlatform.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ? 'ios' : 'android'
  displayMode = window.matchMedia('(display-mode: standalone)')
  checkStandalone()
  window.addEventListener('beforeinstallprompt', capturePrompt)
  window.addEventListener('appinstalled', markInstalled)
  displayMode.addEventListener('change', checkStandalone)
})
onUnmounted(() => {
  active = false
  deferredPrompt.value = null
  window.removeEventListener('beforeinstallprompt', capturePrompt)
  window.removeEventListener('appinstalled', markInstalled)
  displayMode?.removeEventListener('change', checkStandalone)
})

const guides = {
  ios: [
    { title: 'Safari 브라우저로 매일일독에 접속하기', description: "Safari 브라우저로 매일일독에 접속하고, 하단의 '공유' 버튼을 탭하세요.", icon: Share2, images: [{ number: 1, src: cdnAsset('/iOS1.png'), alt: 'Safari 공유 버튼' }] },
    { title: '홈 화면에 추가 옵션 선택하기', description: "위로 쓸어올리고 '홈 화면에 추가' 옵션을 선택하세요.", icon: Plus, images: [{ number: 2, src: cdnAsset('/iOS2.png'), alt: '홈 화면에 추가 옵션' }] },
    { title: '추가 확인하고 앱 실행하기', description: "우측 상단의 '추가'를 탭하세요. 추가한 뒤에는 홈 화면에서 앱으로 매일일독을 사용할 수 있습니다!", icon: Check, images: [{ number: 3, src: cdnAsset('/iOS3.png'), alt: '추가 확인' }, { number: 4, src: cdnAsset('/iOS4.png'), alt: '홈 화면 아이콘' }] },
  ],
  android: [
    { title: '매일일독 접속하기', description: 'Chrome 브라우저로 매일일독에 접속하세요.', tips: ["설치 버튼이 나타나면 '설치'를 탭하고 3단계로 진행하세요.", '설치 버튼이 없으면 주소창 오른쪽의 메뉴(⋮)를 탭하세요.'], icon: Globe, images: [{ number: 1, src: cdnAsset('/Android1.png'), alt: 'Chrome 브라우저' }] },
    { title: '홈 화면에 추가 선택하기', description: "메뉴 목록에서 '홈 화면에 추가'를 선택하세요.", icon: Plus, images: [{ number: 2, src: cdnAsset('/Android2.png'), alt: '홈 화면에 추가 옵션' }] },
    { title: '설치 확인하고 앱 실행하기', description: "'설치'를 선택하세요. 매일일독이 앱으로 설치되면 홈 화면에서 실행할 수 있습니다.", icon: Download, images: [{ number: 3, src: cdnAsset('/Android3.png'), alt: '설치 버튼' }, { number: 4, src: cdnAsset('/Android4.png'), alt: '설치 완료 예시' }] },
  ],
}
const steps = computed(() => selectedPlatform.value === 'ios' ? guides.ios : guides.android)
const currentImage = ref<{ src: string; alt: string } | null>(null)
</script>

<template>
  <div class="install-guide" data-testid="install-guide" :data-install-state="installState">
    <ListCard v-if="installed" data-testid="install-already" class="install-already" role="status">
      <span class="installed-icon"><Check :size="28" aria-hidden="true" /></span>
      <h2>이미 설치되어 있어요</h2>
      <p>홈 화면의 매일일독 아이콘으로 열어주세요.</p>
    </ListCard>
    <template v-else>
      <SegmentedControl v-model="selectedPlatform" :options="platforms" aria-label="설치할 기기" />
      <div :id="`install-panel-${selectedPlatform}`" :key="selectedPlatform" role="tabpanel" :aria-labelledby="`install-tab-${selectedPlatform}`" class="install-panel" tabindex="0">
        <ListCard class="install-intro">
          <p class="install-os">{{ selectedPlatform === 'ios' ? 'iOS · Safari' : 'Android · Chrome' }}</p>
          <h2>홈 화면에 매일일독 추가하기</h2>
          <p>앱스토어 없이 브라우저에서 바로 설치할 수 있어요. 홈 화면에 추가하면 매일일독을 앱처럼 편리하게 열 수 있어요.</p>
        </ListCard>
        <ol class="install-steps">
          <li v-for="(step, index) in steps" :key="index" :data-install-step="index + 1">
            <ListCard>
              <div class="install-step-heading">
                <span class="install-step-number" aria-hidden="true">{{ index + 1 }}</span>
                <div class="install-step-copy">
                  <h3>{{ step.title }}</h3>
                  <p>{{ step.description }}</p>
                  <ul v-if="'tips' in step" class="install-tips"><li v-for="tip in step.tips" :key="tip">{{ tip }}</li></ul>
                </div>
                <span class="install-step-icon"><component :is="step.icon" :size="18" aria-hidden="true" /></span>
              </div>
              <details class="install-screenshots">
                <summary><Image :size="16" aria-hidden="true" /> 화면으로 보기</summary>
                <button v-for="image in step.images" :key="image.src" type="button" class="install-image-button" :data-testid="`install-image-${image.number}`" :aria-label="`${image.alt} 확대 보기`" @click="currentImage = image">
                  <NuxtImg :src="image.src" :alt="image.alt" class="install-image" loading="lazy" format="webp" />
                </button>
              </details>
            </ListCard>
          </li>
        </ol>
      </div>
      <AppButton v-if="canPrompt || (prompting && selectedPlatform === 'android')" data-testid="install-prompt" :loading="prompting" :disabled="prompting" block @click="promptInstall">
        <Download v-if="!prompting" :size="18" aria-hidden="true" />지금 설치하기
      </AppButton>
      <p v-if="statusMessage" data-testid="install-status" :role="phase === 'error' ? 'alert' : 'status'" class="install-status" :class="{ 'is-error': phase === 'error' }">{{ statusMessage }}</p>
      <p class="install-footnote">이미 설치했다면 홈 화면의 매일일독 아이콘으로 열어주세요. 설치 메뉴가 보이지 않으면 Safari 또는 Chrome에서 접속해주세요.</p>
    </template>
    <InstallImageViewer :image="currentImage" @close="currentImage = null" />
  </div>
</template>

<style scoped>
.install-guide, .install-panel { display: grid; gap: 14px; min-width: 0; color: var(--color-text-primary); letter-spacing: var(--tracking-body); }
.install-panel:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 4px; border-radius: var(--radius-card); }
.install-intro h2, .install-already h2 { margin: 4px 0 8px; font-size: 18px; font-weight: 700; line-height: 1.3; }
.install-intro p, .install-already p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--color-text-secondary); }
.install-intro .install-os { color: var(--color-accent-primary); font-size: 12px; font-weight: 600; }
.install-steps { display: grid; gap: 14px; list-style: none; margin: 0; padding: 0; }
.install-step-heading { display: flex; align-items: flex-start; gap: 12px; }
.install-step-number { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: var(--radius-pill); background: var(--color-accent-primary); color: var(--color-text-inverse); font-size: 13px; font-weight: 700; }
.install-step-copy { flex: 1; min-width: 0; }
.install-step-copy h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; line-height: 1.4; }
.install-step-copy p, .install-tips { margin: 0; font-size: 13px; line-height: 1.55; color: var(--color-text-secondary); overflow-wrap: anywhere; }
.install-tips { margin-top: 8px; padding-left: 16px; }
.install-tips li + li { margin-top: 4px; }
.install-step-icon { display: grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: var(--radius-control); background: var(--color-accent-bg); color: var(--color-accent-primary); }
.install-screenshots { margin-top: 8px; }
.install-screenshots summary { display: flex; align-items: center; gap: 8px; min-width: var(--hit-min); min-height: var(--hit-min); width: fit-content; padding: 0 12px; border-radius: var(--radius-pill); color: var(--color-accent-primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.install-screenshots summary:hover { background: var(--color-bg-hover); }
.install-screenshots summary:active { background: var(--color-bg-tertiary); }
.install-screenshots summary:focus-visible, .install-image-button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.install-image-button { display: block; box-sizing: border-box; min-width: var(--hit-min); min-height: var(--hit-min); width: 100%; max-width: 320px; margin: 12px auto 0; padding: 0; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); overflow: hidden; background: var(--color-bg-tertiary); cursor: zoom-in; }
.install-image-button:hover { border-color: var(--color-accent-primary); }
.install-image-button:active { opacity: 0.8; }
.install-image { display: block; width: 100%; height: auto; }
.install-status { margin: 0; padding: 12px 16px; border-radius: var(--radius-control); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 13px; line-height: 1.55; }
.install-status.is-error { background: var(--color-error-bg); color: var(--color-error); }
.install-footnote { margin: 0; font-size: 12px; line-height: 1.55; text-align: center; color: var(--color-text-tertiary); }
.install-already { text-align: center; }
.installed-icon { display: grid; place-items: center; width: 64px; height: 64px; margin: 0 auto 16px; border-radius: var(--radius-pill); background: var(--color-accent-bg); color: var(--color-accent-primary); }
</style>
