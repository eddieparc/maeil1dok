<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'

const tabs = [
  { path: '/company', id: 'company', label: '회사 소개' },
  { path: '/terms', id: 'terms', label: '이용약관' },
  { path: '/privacy', id: 'privacy', label: '개인정보' },
  { path: '/support', id: 'support', label: '고객 지원' },
]
const route = useRoute()
const title = computed(() => tabs.find(tab => tab.path === route.path)?.label ?? '서비스 정보')
const scrollRegion = ref<HTMLElement | null>(null)

function navigateSection(id: string) {
  const owner = scrollRegion.value
  if (!owner) return
  // Local scroll only: router hash navigation would also scroll Nuxt's window.
  const target = Array.from(owner.querySelectorAll<HTMLElement>('[id]')).find(node => node.id === id)
  if (!target) return
  owner.scrollTop += target.getBoundingClientRect().top - owner.getBoundingClientRect().top - owner.clientTop
  target.focus({ preventScroll: true })
}
function scrollToHash() {
  if (route.hash) navigateSection(route.hash.slice(1))
  else if (scrollRegion.value) scrollRegion.value.scrollTop = 0
}
onMounted(scrollToHash)
watch(() => route.fullPath, async () => {
  await nextTick()
  scrollToHash()
}, { flush: 'post' })
</script>

<template>
  <PageLayout :title="title" fallback-path="/" class="info-layout" scroll-area-class="info-layout-body">
    <div class="info-shell">
      <nav class="info-tabs" aria-label="서비스 정보" data-testid="info-tabs">
        <AppButton
          v-for="tab in tabs" :key="tab.path" :to="tab.path" variant="ghost" size="sm"
          class="info-tab" :aria-current="route.path === tab.path ? 'page' : undefined"
          :data-active="route.path === tab.path" :data-testid="`info-tab-${tab.id}`"
        >{{ tab.label }}</AppButton>
      </nav>
      <main ref="scrollRegion" class="info-scroll" data-testid="info-scroll" :aria-label="title" tabindex="-1">
        <div class="info-content"><slot :navigate-section="navigateSection" /></div>
      </main>
    </div>
  </PageLayout>
</template>

<style scoped>
.info-layout :deep(.page-layout-content) { height: 100dvh; }
.info-layout :deep(.info-layout-body.scroll-area) { display: flex; overflow: hidden; padding: 0; }
.info-shell { display: flex; flex-direction: column; width: 100%; min-width: 0; min-height: 0; color: var(--color-text-primary); font-family: var(--font-sans); letter-spacing: var(--tracking-body); }
.info-tabs { display: flex; flex: none; gap: 6px; overflow-x: auto; padding: 12px var(--screen-gutter); background: var(--color-bg-primary); }
.info-tab { flex: none; border: 1px solid var(--color-border-default); background: var(--color-bg-card); color: var(--color-text-secondary); white-space: nowrap; padding-inline: 12px; }
.info-tab[data-active="true"] { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: var(--color-text-inverse); }
.info-tab[data-active="true"]:hover { background: var(--color-accent-primary-hover); }
[data-theme="dark"] .info-tab[data-active="true"] { background: var(--color-accent-bg); border: 1.5px solid var(--color-accent-primary); color: var(--color-accent-primary); }
.info-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; padding: 8px var(--screen-gutter) calc(var(--mobile-nav-height) + 20px); }
.info-content { display: flex; flex-direction: column; gap: 20px; }
@media (min-width: 1024px) {
  .info-tabs { padding-inline: 40px; padding-top: 24px; }
  .info-scroll { padding: 12px 40px 36px; }
}
</style>
