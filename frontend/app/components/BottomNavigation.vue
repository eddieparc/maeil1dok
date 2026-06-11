<template>
  <div class="bottom-nav-container">
    <nav class="bottom-nav" aria-label="주요 메뉴">
      <NuxtLink to="/" class="nav-item" :class="{ active: isActive('/') }">
        <HomeIcon :size="24" />
        <span>홈</span>
      </NuxtLink>

      <NuxtLink to="/bible" class="nav-item" :class="{ active: isActive('/bible') }">
        <BookOpenIcon :size="24" />
        <span>성경</span>
      </NuxtLink>

      <NuxtLink to="/scoreboard" class="nav-item" :class="{ active: isActive('/scoreboard') }">
        <ListIcon :size="24" />
        <span>랭킹</span>
      </NuxtLink>

      <NuxtLink to="/groups" class="nav-item" :class="{ active: isActive('/groups') }">
        <UsersIcon :size="24" />
        <span>그룹</span>
      </NuxtLink>

      <NuxtLink 
        v-if="user" 
        :to="`/profile/${user.id}`" 
        class="nav-item" 
        :class="{ active: isActive('/profile') }"
      >
        <UserIcon :size="24" />
        <span>프로필</span>
      </NuxtLink>

      <button 
        v-else 
        @click="navigateTo('/login')"
        class="nav-item"
      >
        <LogInIcon :size="24" />
        <span>로그인</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { useAuthService } from '~/composables/useAuthService'
import { computed } from 'vue'
import { BookOpenIcon, HomeIcon, ListIcon, LogInIcon, UserIcon, UsersIcon } from '@lucide/vue'

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
