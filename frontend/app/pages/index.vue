<template>
  <div class="sanctuary-theme">
    <div class="bg-pattern"></div>

    <div class="container">
      <header class="home-header">
        <div class="logo-wrapper">
          <NuxtImg src="/images/logo-transparent.png" alt="Maeil1dok" class="logo-img" loading="lazy" />
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

// 페이지 메타 설정
definePageMeta({
  layout: false // 전체 화면 제어를 위해 레이아웃 미사용
});

const showMenu = ref(false);

const settingsStore = useReadingSettingsStore();
const isDark = ref(false);

const toggleTheme = () => {
  const newTheme = isDark.value ? 'light' : 'dark';
  settingsStore.updateSetting('theme', newTheme);
  isDark.value = !isDark.value;
};

onMounted(() => {
  settingsStore.initialize();
  isDark.value = settingsStore.effectiveTheme === 'dark';
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