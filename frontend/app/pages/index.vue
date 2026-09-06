<template>
  <div class="sanctuary-theme" :class="{ 'is-shell-ready': isShellReady }">
    <div class="landing-skeleton" aria-hidden="true">
      <div class="landing-skeleton__inner">
        <header class="landing-skeleton__header">
          <img src="/images/logo-transparent.png" alt="" class="landing-skeleton__logo" width="376" height="99" loading="eager" fetchpriority="high">
          <div class="landing-skeleton__actions">
            <span class="landing-skeleton__icon skeleton-shimmer"></span>
            <span class="landing-skeleton__icon skeleton-shimmer"></span>
          </div>
        </header>
        <section class="landing-skeleton__hero">
          <span class="landing-skeleton__line landing-skeleton__line--caption skeleton-shimmer"></span>
          <span class="landing-skeleton__line landing-skeleton__line--title skeleton-shimmer"></span>
          <span class="landing-skeleton__line landing-skeleton__line--title skeleton-shimmer"></span>
        </section>
        <section class="landing-skeleton__card">
          <div class="landing-skeleton__reading">
            <span v-if="isKnownAuthenticated" class="landing-skeleton__ring skeleton-shimmer"></span>
            <div class="landing-skeleton__copy">
              <span class="landing-skeleton__line landing-skeleton__line--caption skeleton-shimmer"></span>
              <span class="landing-skeleton__line landing-skeleton__line--passage skeleton-shimmer"></span>
              <span class="landing-skeleton__line landing-skeleton__line--caption skeleton-shimmer"></span>
            </div>
          </div>
          <span class="landing-skeleton__button skeleton-shimmer"></span>
        </section>
        <template v-if="isKnownAuthenticated">
          <section class="landing-skeleton__stats">
            <div v-for="item in 3" :key="item" class="landing-skeleton__stat">
              <span class="landing-skeleton__line landing-skeleton__line--caption skeleton-shimmer"></span>
              <span class="landing-skeleton__line landing-skeleton__line--passage skeleton-shimmer"></span>
            </div>
          </section>
          <section class="landing-skeleton__week">
            <span v-for="item in 7" :key="item" class="landing-skeleton__dot skeleton-shimmer"></span>
          </section>
        </template>
        <span class="landing-skeleton__line landing-skeleton__line--caption skeleton-shimmer"></span>
        <section class="landing-skeleton__grid">
          <div v-for="item in isKnownAuthenticated ? 4 : 7" :key="item" class="landing-skeleton__tile">
            <span class="landing-skeleton__line landing-skeleton__line--caption skeleton-shimmer"></span>
          </div>
        </section>
      </div>
    </div>

    <SidebarNav />
    <div class="landing-content">
      <div class="container">
        <header class="home-header">
          <NuxtImg
            src="/images/logo-transparent.png"
            alt="Maeil1dok"
            class="logo-img"
            loading="eager"
            fetchpriority="high"
            width="376"
            height="99"
          />
          <HomeHeaderActions :is-dark="isDark" @toggle-theme="toggleTheme" @open-menu="showMenu = true" />
        </header>
        <main class="home-main">
          <HomeDashboard v-if="isKnownAuthenticated">
            <template #progress="{ progress, loading }">
              <RingProgress v-if="isDesktop" :size="120" :thickness="10" :value="progress" :label="loading ? '진도 확인 중' : `${progress}%`" />
              <RingProgress v-else :size="88" :thickness="8" :value="progress" :label="loading ? '진도 확인 중' : `${progress}%`" />
            </template>
          </HomeDashboard>
          <template v-else>
            <HomeHero class="fade-in" />
            <ReadingCardStack class="fade-in" />
          </template>
          <QuickAccessGrid class="fade-in home-shortcuts" />
        </main>
        <FloatingNav />
        <Menu :is-open="showMenu" @close="showMenu = false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import SidebarNav from '~/components/common/SidebarNav.vue';
import RingProgress from '~/components/ui/RingProgress.vue';
import HomeHero from '~/components/home-v2/HomeHero.vue';
import HomeDashboard from '~/components/home-v2/HomeDashboard.vue';
import HomeHeaderActions from '~/components/home-v2/HomeHeaderActions.vue';
import ReadingCardStack from '~/components/home-v2/ReadingCardStack.vue';
import QuickAccessGrid from '~/components/home-v2/QuickAccessGrid.vue';
import FloatingNav from '~/components/home-v2/FloatingNav.vue';
import Menu from '~/components/Menu.vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import { useReadingSettingsStore } from '~/stores/readingSettings';

const { isKnownAuthenticated } = useLandingAuthState();
useHead({
  link: [{ rel: 'preload', as: 'image', href: '/images/logo-transparent.png', fetchpriority: 'high' }],
  style: [{
    key: 'landing-critical-shell',
    innerHTML: `
.landing-skeleton {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  pointer-events: none;
}
.landing-skeleton__inner { box-sizing: border-box; max-width: 768px; min-height: 100vh; margin: 0 auto; padding: 0 20px 96px; }
.landing-skeleton__header { display: flex; align-items: center; justify-content: space-between; height: 52px; }
.landing-skeleton__logo { display: block; width: auto; height: 22px; object-fit: contain; }
.landing-skeleton__actions { display: flex; gap: 12px; }
.landing-skeleton__icon { width: 32px; height: 32px; border-radius: 50%; }
.landing-skeleton__hero { display: flex; flex-direction: column; gap: 8px; padding: 20px 0 4px; margin-bottom: 20px; }
.landing-skeleton__line { display: block; border-radius: var(--radius-pill); background: var(--color-bg-hover); }
.landing-skeleton__line--caption { width: min(160px, 100%); height: 14px; }
.landing-skeleton__line--title { width: min(260px, 80%); height: 34px; }
.landing-skeleton__line--passage { width: min(220px, 100%); height: 26px; }
.landing-skeleton__card, .landing-skeleton__stat, .landing-skeleton__week, .landing-skeleton__tile { border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.landing-skeleton__card { padding: 20px; margin-bottom: 20px; }
.landing-skeleton__reading { display: flex; align-items: center; gap: 20px; min-height: 104px; }
.landing-skeleton__ring { width: 88px; height: 88px; flex-shrink: 0; border-radius: 50%; }
.landing-skeleton__copy { display: flex; flex: 1; flex-direction: column; gap: 10px; }
.landing-skeleton__button { display: block; width: 100%; height: 44px; margin-top: 20px; border-radius: var(--radius-pill); }
.landing-skeleton__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 20px; }
.landing-skeleton__stat { display: flex; flex-direction: column; gap: 12px; padding: 14px 14px 12px; }
.landing-skeleton__week { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 33px 16px 14px; }
.landing-skeleton__dot { width: 28px; height: 28px; border-radius: 50%; }
.landing-skeleton__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.landing-skeleton__tile { display: flex; align-items: center; min-height: 56px; padding: 14px; }
.landing-skeleton__icon, .landing-skeleton__ring, .landing-skeleton__button, .landing-skeleton__dot { background: var(--color-bg-hover); }
.sanctuary-theme.is-shell-ready .landing-skeleton { animation: none; opacity: 0; visibility: hidden; transition: opacity var(--duration-micro) ease, visibility 0s linear var(--duration-micro); }
@media (min-width: 1024px) {
  .landing-skeleton { left: var(--sidebar-width); }
  .landing-skeleton__inner { box-sizing: content-box; display: grid; grid-template-columns: minmax(0, var(--content-max)) var(--aside-width); gap: 20px 28px; align-content: start; max-width: calc(var(--content-max) + var(--aside-width) + 28px); padding: 36px 40px; }
  .landing-skeleton__header { grid-column: 1 / -1; justify-content: flex-end; }
  .landing-skeleton__logo { display: none; }
  .landing-skeleton__hero, .landing-skeleton__card, .landing-skeleton__stats, .landing-skeleton__grid, .landing-skeleton__inner > .landing-skeleton__line { grid-column: 1; margin-block: 0; }
  .landing-skeleton__card { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
  .landing-skeleton__reading { flex: 1 1 300px; min-width: 0; }
  .landing-skeleton__ring { width: 120px; height: 120px; }
  .landing-skeleton__button { width: 96px; margin: 0 0 0 auto; }
  .landing-skeleton__week { grid-column: 2; grid-row: 2; align-self: start; margin: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .landing-skeleton { animation-duration: 1ms; }
  .landing-skeleton .skeleton-shimmer { animation: none; }
  .sanctuary-theme.is-shell-ready .landing-skeleton { transition: none; }
}
    `,
  }],
});

definePageMeta({ layout: false });
const showMenu = ref(false);
const isShellReady = ref(false);
const isDesktop = ref(false);
let desktopQuery: MediaQueryList | undefined;
const updateDesktop = () => { isDesktop.value = desktopQuery?.matches ?? false; };
const settingsStore = useReadingSettingsStore();
const isDark = ref(false);
const toggleTheme = () => {
  const newTheme = isDark.value ? 'light' : 'dark';
  settingsStore.updateSetting('theme', newTheme);
  isDark.value = !isDark.value;
};
const revealShell = (): void => {
  requestAnimationFrame(() => { isShellReady.value = true; });
};
onMounted(() => {
  desktopQuery = window.matchMedia('(min-width: 1024px)');
  updateDesktop();
  desktopQuery.addEventListener('change', updateDesktop);
  revealShell();
  settingsStore.initialize();
  isDark.value = settingsStore.effectiveTheme === 'dark';
});
onUnmounted(() => desktopQuery?.removeEventListener('change', updateDesktop));
</script>

<style scoped>
.sanctuary-theme { min-height: 100vh; background: var(--color-bg-primary); color: var(--color-text-primary); font-family: var(--font-sans); letter-spacing: var(--tracking-body); -webkit-font-smoothing: antialiased; }
.container { position: relative; max-width: 768px; min-height: 100vh; margin: 0 auto; padding: 0 20px calc(96px + env(safe-area-inset-bottom)); }
.home-header { display: flex; align-items: center; justify-content: space-between; height: 52px; }
.logo-img { display: block; height: 22px; width: auto; object-fit: contain; }
.home-main { display: flex; flex-direction: column; gap: 20px; }
.home-shortcuts { animation-delay: calc(var(--stagger) * 4); }
:global([data-theme="dark"]) .logo-img { filter: brightness(0) invert(1); }
@media (min-width: 1024px) {
  .landing-content { padding-left: var(--sidebar-width); }
  .container { box-sizing: content-box; width: auto; max-width: calc(var(--content-max) + var(--aside-width) + 28px); min-height: calc(100vh - 72px); padding: 36px 40px; }
  .home-header { justify-content: flex-end; margin-bottom: 20px; }
  .logo-img { display: none; }
  .home-main, .home-main :deep(.home-dashboard) { display: grid; grid-template-columns: minmax(0, var(--content-max)) var(--aside-width); gap: 28px; align-items: start; }
  .home-main :deep(.home-dashboard) { grid-column: 1 / -1; }
  .home-main > .hero-section, .home-main > .reading-card, .home-shortcuts { grid-column: 1; min-width: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .home-shortcuts { animation: none; }
}
</style>
