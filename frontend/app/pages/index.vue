<template>
  <div class="sanctuary-theme" :class="{ 'is-shell-ready': isShellReady }">
    <div class="landing-skeleton" aria-hidden="true">
      <div class="landing-skeleton__inner">
        <header class="landing-skeleton__header">
          <img
            src="/images/logo-transparent.png"
            alt=""
            class="landing-skeleton__logo"
            width="376"
            height="99"
            loading="eager"
            fetchpriority="high"
          >
          <div class="landing-skeleton__actions">
            <span class="landing-skeleton__icon"></span>
            <span class="landing-skeleton__icon"></span>
          </div>
        </header>

        <section class="landing-skeleton__hero">
          <span class="landing-skeleton__line landing-skeleton__line--eyebrow"></span>
          <span class="landing-skeleton__line landing-skeleton__line--title"></span>
          <span class="landing-skeleton__line landing-skeleton__line--title landing-skeleton__line--title-2"></span>
        </section>

        <section class="landing-skeleton__card-stack">
          <div class="landing-skeleton__welcome-card">
            <span class="landing-skeleton__line landing-skeleton__line--label"></span>
            <span class="landing-skeleton__line landing-skeleton__line--card-title"></span>
            <span class="landing-skeleton__line landing-skeleton__line--card-title landing-skeleton__line--card-title-2"></span>
            <span class="landing-skeleton__line landing-skeleton__line--card-desc"></span>
            <span class="landing-skeleton__line landing-skeleton__line--card-link"></span>
          </div>
          <div class="landing-skeleton__card-shadow landing-skeleton__card-shadow--1"></div>
          <div class="landing-skeleton__card-shadow landing-skeleton__card-shadow--2"></div>
        </section>

        <span class="landing-skeleton__section-heading"></span>

        <section class="landing-skeleton__grid">
          <div
            v-for="item in 7"
            :key="item"
            class="landing-skeleton__tile"
            :class="{ 'landing-skeleton__tile--plan': item === 2 }"
          >
            <span class="landing-skeleton__tile-main">
              <span class="landing-skeleton__tile-icon"></span>
              <span class="landing-skeleton__tile-line"></span>
            </span>
            <span v-if="item === 2" class="landing-skeleton__tile-pill"></span>
          </div>
        </section>

      </div>
    </div>

    <div class="landing-content">
      <div class="bg-pattern"></div>

      <div class="container">
        <header class="home-header">
          <div class="logo-wrapper">
            <NuxtImg
              src="/images/logo-transparent.png"
              alt="Maeil1dok"
              class="logo-img"
              loading="eager"
              fetchpriority="high"
              width="376"
              height="99"
            />
          </div>
          <div class="header-actions">
            <button class="theme-toggle-btn" @click="toggleTheme" :aria-label="isDark ? '라이트 모드로 전환' : '다크 모드로 전환'">
              <Transition name="theme-icon" mode="out-in">
                <MoonIcon v-if="!isDark" :size="20" key="moon" />
                <SunIcon v-else :size="20" key="sun" />
              </Transition>
            </button>
            <button class="menu-btn" @click="showMenu = true" aria-label="메뉴 열기">
              <MenuIcon size="24" />
            </button>
          </div>
        </header>

        <main class="home-main">
          <HomeHero />
          <ReadingCardStack />
          <QuickAccessGrid />
        </main>

        <FloatingNav />

        <Menu :is-open="showMenu" @close="showMenu = false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeHero from '~/components/home-v2/HomeHero.vue';
import ReadingCardStack from '~/components/home-v2/ReadingCardStack.vue';
import QuickAccessGrid from '~/components/home-v2/QuickAccessGrid.vue';
import FloatingNav from '~/components/home-v2/FloatingNav.vue';
import Menu from '~/components/Menu.vue';
import MenuIcon from '~/components/icons/MenuIcon.vue';
import SunIcon from '~/components/icons/SunIcon.vue';
import MoonIcon from '~/components/icons/MoonIcon.vue';
import { useReadingSettingsStore } from '~/stores/readingSettings';
import { useAuthService } from '~/composables/useAuthService';

useHead({
  link: [
    {
      rel: 'preload',
      as: 'image',
      href: '/images/logo-transparent.png',
      fetchpriority: 'high',
    },
  ],
  style: [
    {
      key: 'landing-critical-shell',
      innerHTML: `
.landing-content { opacity: 0; }
.landing-skeleton {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: #F9F8F6;
  color: #2C3333;
  opacity: 1;
  visibility: visible;
}
.landing-skeleton__inner {
  box-sizing: border-box;
  max-width: 768px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 8px 16px 112px;
}
.landing-skeleton__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
}
.landing-skeleton__logo {
  display: block;
  width: 91px;
  height: 24px;
  object-fit: contain;
}
.landing-skeleton__actions,
.landing-skeleton__grid,
.landing-skeleton__tile,
.landing-skeleton__tile-main {
  display: flex;
}
.landing-skeleton__actions {
  gap: 4px;
}
.landing-skeleton__icon,
.landing-skeleton__line,
.landing-skeleton__section-heading {
  background: #E7E5E1;
}
.landing-skeleton__welcome-card,
.landing-skeleton__tile {
  background: #FFFFFF;
  border: 1px solid rgba(17, 24, 39, 0.06);
}
.landing-skeleton__card-shadow {
  background: #F1F0ED;
}
.landing-skeleton__icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
}
.landing-skeleton__hero {
  padding: clamp(40px, 9vh, 76px) 0 clamp(28px, 5vh, 44px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}
.landing-skeleton__line {
  display: block;
  border-radius: 999px;
}
.landing-skeleton__line--eyebrow {
  width: min(160px, 42vw);
  height: 14px;
  margin-bottom: 6px;
}
.landing-skeleton__line--title {
  width: min(360px, 70vw);
  height: clamp(36px, 8vw, 52px);
  border-radius: 12px;
}
.landing-skeleton__line--title-2 {
  width: min(440px, 84vw);
}
.landing-skeleton__card-stack {
  position: relative;
  margin-bottom: 48px;
}
.landing-skeleton__welcome-card {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
  box-sizing: border-box;
  min-height: 260px;
  padding: 36px 32px;
  border-radius: 24px;
  background-color: #FFFFFF;
  box-shadow: 0 1px 3px rgba(17, 24, 39, 0.04);
}
.landing-skeleton__card-shadow {
  position: absolute;
  height: 100%;
  border-radius: 24px;
  background-color: #F1F0ED;
  box-shadow: none;
}
.landing-skeleton__card-shadow--1 {
  inset: 10px 20px auto;
  opacity: 0.5;
  z-index: 5;
}
.landing-skeleton__card-shadow--2 {
  inset: 20px 40px auto;
  opacity: 0.3;
  z-index: 1;
}
.landing-skeleton__line--label {
  width: 86px;
  height: 14px;
  margin-bottom: 4px;
  background: #E0DEDA;
}
.landing-skeleton__line--card-title {
  width: min(280px, 64vw);
  height: clamp(32px, 7vw, 44px);
  border-radius: 10px;
}
.landing-skeleton__line--card-title-2 {
  width: min(220px, 52vw);
}
.landing-skeleton__line--card-desc {
  width: min(300px, 68vw);
  height: 14px;
  margin-top: 6px;
}
.landing-skeleton__line--card-link {
  width: 140px;
  height: 14px;
  margin-top: 8px;
}
.landing-skeleton__section-heading {
  display: block;
  width: 72px;
  height: 24px;
  margin: 0 0 24px;
  border-radius: 6px;
}
.landing-skeleton__grid {
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
}
.landing-skeleton__tile {
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  width: calc(50% - 8px);
  min-height: 96px;
  box-sizing: border-box;
  padding: 22px;
  border-radius: 20px;
  background-color: #FFFFFF;
  box-shadow: 0 1px 3px rgba(17, 24, 39, 0.04);
}
.landing-skeleton__tile-main {
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.landing-skeleton__tile--plan {
  justify-content: space-between;
}
.landing-skeleton__tile-pill {
  flex: 0 0 auto;
  width: 58px;
  height: 24px;
  border-radius: 999px;
  background: #E3E1DD;
}
.landing-skeleton__tile-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #DEDDD9;
}
.landing-skeleton__tile-line {
  width: min(88px, 28vw);
  height: 16px;
  border-radius: 999px;
  background: #DEDDD9;
}
.sanctuary-theme.is-shell-ready .landing-content {
  opacity: 1;
  transition: opacity 160ms ease;
}
.sanctuary-theme.is-shell-ready .landing-skeleton {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition: opacity 160ms ease, visibility 0s linear 160ms;
}
@media (max-width: 520px) {
  .landing-skeleton__inner { padding-inline: 16px; }
  .landing-skeleton__welcome-card {
    padding: 36px 32px;
  }
  .landing-skeleton__tile {
    width: calc(50% - 8px);
  }
}
@media (max-width: 480px) {
  .landing-skeleton__line--title {
    height: 42px;
  }
  .landing-skeleton__tile {
    min-height: 88px;
    padding: 18px;
  }
  .landing-skeleton__tile--plan {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sanctuary-theme.is-shell-ready .landing-content,
  .sanctuary-theme.is-shell-ready .landing-skeleton {
    transition: none;
  }
}
      `,
    },
  ],
});

// 페이지 메타 설정
definePageMeta({
  layout: false // 전체 화면 제어를 위해 레이아웃 미사용
});

const showMenu = ref(false);
const isShellReady = ref(false);

const auth = useAuthService();
const settingsStore = useReadingSettingsStore();
const isDark = ref(false);

const toggleTheme = () => {
  const newTheme = isDark.value ? 'light' : 'dark';
  settingsStore.updateSetting('theme', newTheme);
  isDark.value = !isDark.value;
};

const waitForLocalStylesheets = async (): Promise<void> => {
  const localStylesheets = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  ).filter((link) => link.href.includes('/_nuxt/'));

  await Promise.all(
    localStylesheets.map((link) => {
      if (link.sheet) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
};

const revealShell = (): void => {
  requestAnimationFrame(() => {
    isShellReady.value = true;
  });
};

onMounted(() => {
  void auth.initialize();
  settingsStore.initialize();
  isDark.value = settingsStore.effectiveTheme === 'dark';
  void waitForLocalStylesheets().then(revealShell);
});
</script>

<style scoped>
/* Sanctuary Theme Variables */
.sanctuary-theme {
  /* Colors - Light (Default) */
  --bg-color: var(--color-bg-primary, #F9F8F6);
  --card-bg: var(--color-bg-card, #FFFFFF);
  --text-main: var(--color-text-primary, #2C3333);
  --text-sub: var(--color-text-secondary, #6B7280);
  --accent: var(--color-accent-primary, #4A5D53);
  --accent-light: var(--color-accent-primary-light, #E8ECE9);
  --paper-shadow: var(--shadow-sm, 0 4px 20px rgba(44, 51, 51, 0.04));

  --font-serif: 'Noto Serif KR', serif;
  --font-sans: 'Pretendard', sans-serif;

  font-family: var(--font-sans);
  background-color: var(--bg-color);
  color: var(--text-main);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
}

.container {
  max-width: 768px;
  margin: 0 auto;
  padding: 0 1rem calc(max(3rem, 6vh) + env(safe-area-inset-bottom));
  min-height: 100vh;
  position: relative;
}

/* Header */
.home-header {
  padding: 0.5rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-wrapper {
  height: 24px;
}

.logo-img {
  height: 100%;
  width: auto;
  object-fit: contain;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.theme-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-main);
  padding: 0.5rem;
  transition: opacity 0.2s, transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle-btn:hover {
  opacity: 0.7;
}

.theme-toggle-btn:active {
  transform: scale(0.95);
}

.menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-main);
  padding: 0.5rem;
  margin-right: -0.5rem;
  transition: opacity 0.2s;
}

.menu-btn:hover {
  opacity: 0.7;
}

.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: all 0.2s ease;
}

.theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.8);
}

.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.8);
}

.home-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Decoration */
.bg-pattern {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, var(--bg-color) 0%, var(--color-bg-tertiary) 100%);
  z-index: 0;
  pointer-events: none;
}

[data-theme="dark"] .bg-pattern {
  background: linear-gradient(180deg, var(--bg-color) 0%, var(--color-bg-secondary) 100%);
}

[data-theme="dark"] .logo-img {
  filter: brightness(0) invert(1);
  opacity: 0.9;
}
</style>
