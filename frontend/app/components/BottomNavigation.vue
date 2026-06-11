<template>
  <div class="bottom-nav-container">
    <nav class="bottom-nav" aria-label="주요 메뉴">
      <NuxtLink to="/" class="nav-item" :class="{ active: isActive('/') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>홈</span>
      </NuxtLink>

      <NuxtLink to="/bible" class="nav-item" :class="{ active: isActive('/bible') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528"/>
        </svg>
        <span>성경</span>
      </NuxtLink>

      <NuxtLink to="/scoreboard" class="nav-item" :class="{ active: isActive('/scoreboard') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3" y2="6"></line>
          <line x1="3" y1="12" x2="3" y2="12"></line>
          <line x1="3" y1="18" x2="3" y2="18"></line>
        </svg>
        <span>랭킹</span>
      </NuxtLink>

      <NuxtLink to="/groups" class="nav-item" :class="{ active: isActive('/groups') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span>그룹</span>
      </NuxtLink>

      <NuxtLink 
        v-if="user" 
        :to="`/profile/${user.id}`" 
        class="nav-item" 
        :class="{ active: isActive('/profile') }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>프로필</span>
      </NuxtLink>

      <button 
        v-else 
        @click="navigateTo('/login')"
        class="nav-item"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        <span>로그인</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { useAuthService } from '~/composables/useAuthService'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthService()
const user = computed(() => auth.user.value)

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style scoped>
.bottom-nav-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-slate-200);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: block;
}

:global(.native-app) .bottom-nav-container {
  padding-bottom: var(--native-bottom-inset, 0px);
}

/* Desktop: Hide bottom navigation on very large screens */
@media (min-width: 1367px) {
  .bottom-nav-container {
    display: none;
  }
}

/* 하단 네비게이션이 있을 때 페이지 컨텐츠에 여백 추가 */
@media (max-width: 1366px) {
  body {
    padding-bottom: calc(60px + env(safe-area-inset-bottom));
  }
}

.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 60px;
  padding: 0 0.5rem;
  max-width: 100%;
  margin: 0 auto;
}

/* Tablet: Larger bottom nav with max-width */
@media (min-width: 768px) {
  .bottom-nav {
    height: 70px;
    padding: 0 1rem;
    max-width: 900px;
  }
}

/* Tablet Large: Even larger with increased max-width */
@media (min-width: 1024px) {
  .bottom-nav {
    height: 80px;
    padding: 0 1.5rem;
    max-width: 1200px;
  }
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex: 1;
  height: 100%;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:active {
  transform: scale(0.95);
}

.nav-item.active {
  color: var(--primary-color);
}

.nav-item svg {
  width: 24px;
  height: 24px;
  transition: all 0.2s ease;
}

.nav-item.active svg {
  transform: scale(1.1);
}

.nav-item span {
  font-size: 0.7rem;
  font-weight: 500;
}

/* Tablet: Larger icons and text */
@media (min-width: 768px) {
  .nav-item svg {
    width: 28px;
    height: 28px;
  }

  .nav-item span {
    font-size: 0.8125rem;
  }

  .nav-item {
    gap: 0.375rem;
  }

  body {
    padding-bottom: calc(70px + env(safe-area-inset-bottom)) !important;
  }
}

/* Tablet Large: Even larger icons and text */
@media (min-width: 1024px) {
  .nav-item svg {
    width: 32px;
    height: 32px;
  }

  .nav-item span {
    font-size: 0.9375rem;
  }

  .nav-item {
    gap: 0.5rem;
  }

  body {
    padding-bottom: calc(80px + env(safe-area-inset-bottom)) !important;
  }
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-nav-container {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
