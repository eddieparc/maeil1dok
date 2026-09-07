<template>
  <div class="bottom-nav-container" :data-density="density" :class="{ 'tabs-hidden': hidden }">
    <div v-if="$slots.above" class="bottom-nav-above">
      <slot name="above" />
    </div>
    <div class="bottom-nav-tabs" :class="{ 'is-hidden': hidden }" :inert="hidden" :aria-hidden="hidden || undefined">
      <nav class="bottom-nav" aria-label="주요 메뉴">
        <NuxtLink to="/" class="nav-item" :tabindex="hidden ? -1 : undefined" :class="{ active: isActive('/') }" :aria-current="isActive('/') ? 'page' : undefined">
          <HouseIcon :size="22" :stroke-width="isActive('/') ? 2.2 : 2" aria-hidden="true" />
          <span>홈</span>
        </NuxtLink>
        <NuxtLink to="/bible" class="nav-item" :tabindex="hidden ? -1 : undefined" :class="{ active: isActive('/bible') }" :aria-current="isActive('/bible') ? 'page' : undefined">
          <BookOpenIcon :size="22" :stroke-width="isActive('/bible') ? 2.2 : 2" aria-hidden="true" />
          <span>성경</span>
        </NuxtLink>
        <NuxtLink v-slot="{ href, navigate }" to="/plan" custom>
          <a :href="href" class="nav-item" :tabindex="hidden ? -1 : undefined" :class="{ active: isActive('/plan') }" :aria-current="isActive('/plan') ? 'page' : undefined" @click="onPlanClick($event, navigate)">
            <CalendarIcon :size="22" :stroke-width="isActive('/plan') ? 2.2 : 2" aria-hidden="true" />
            <span>통독표</span>
          </a>
        </NuxtLink>
        <NuxtLink to="/groups" class="nav-item" :tabindex="hidden ? -1 : undefined" :class="{ active: isActive('/groups') }" :aria-current="isActive('/groups') ? 'page' : undefined">
          <UsersIcon :size="22" :stroke-width="isActive('/groups') ? 2.2 : 2" aria-hidden="true" />
          <span>함께</span>
        </NuxtLink>
        <NuxtLink :to="profileLink" class="nav-item" :tabindex="hidden ? -1 : undefined" :class="{ active: isActive(profileLink) }" :aria-current="isActive(profileLink) ? 'page' : undefined">
          <UserIcon :size="22" :stroke-width="isActive(profileLink) ? 2.2 : 2" aria-hidden="true" />
          <span>내 정보</span>
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpenIcon, CalendarIcon, HouseIcon, UserIcon, UsersIcon } from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'

const props = defineProps({
  density: {
    type: String,
    default: 'standard',
    validator: (value) => ['standard', 'reader'].includes(value)
  },
  hidden: { type: Boolean, default: false },
  interceptPlan: { type: Boolean, default: false }
})
const emit = defineEmits(['plan'])

const onPlanClick = (event, navigate) => {
  if (props.interceptPlan && !event.defaultPrevented && event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault()
    emit('plan')
    return
  }
  return navigate(event)
}

const route = useRoute()
const { user } = useAuthService()
const profileLink = computed(() => user.value ? `/profile/${user.value.id}` : '/login')

const isActive = (path) => route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
</script>

<style scoped>
.bottom-nav-container {
  --mobile-nav-content-height: calc(var(--tabbar-height) - 24px);
  position: fixed;
  inset: auto 0 0;
  z-index: 100;
  pointer-events: none;
}

.bottom-nav-container[data-density="reader"] {
  --mobile-nav-content-height: calc(var(--tabbar-reader-height, 80px) - 24px);
}

.bottom-nav-container[data-density="reader"] .bottom-nav-tabs {
  background: color-mix(in srgb, var(--color-bg-card) 96%, transparent);
  backdrop-filter: blur(12px);
}

.bottom-nav-container[data-density="reader"].tabs-hidden:has(.bottom-nav-above) {
  padding-bottom: var(--mobile-nav-safe-inset);
}

.bottom-nav-above {
  position: relative;
  max-width: 768px;
  margin: 0 auto;
  pointer-events: auto;
}

.bottom-nav-tabs {
  box-sizing: border-box;
  height: calc(var(--mobile-nav-content-height) + var(--mobile-nav-safe-inset));
  overflow: hidden;
  background: var(--color-bg-card);
  box-shadow: inset 0 1px var(--color-border-default);
  padding-bottom: var(--mobile-nav-safe-inset);
  pointer-events: auto;
  transition: height var(--duration-standard, 250ms) ease, padding-bottom var(--duration-standard, 250ms) ease, opacity var(--duration-standard, 250ms) ease;
}

.bottom-nav-tabs.is-hidden {
  height: 0;
  padding-bottom: 0;
  opacity: 0;
  pointer-events: none;
}

.bottom-nav {
  display: flex;
  align-items: flex-start;
  box-sizing: border-box;
  height: var(--mobile-nav-content-height);
  max-width: 768px;
  margin: 0 auto;
  padding: 6px 8px 0;
}

.nav-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  height: 100%;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-control);
  text-decoration: none;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: var(--tracking-body);
  transition: color var(--duration-micro) ease, background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.nav-item:hover {
  background: var(--color-bg-hover);
}

.nav-item.active {
  color: var(--color-accent-primary);
  font-weight: 600;
}

.nav-item:active {
  transform: scale(.97);
}

.nav-item:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

@media (min-width: 1024px) {
  .bottom-nav-container {
    left: var(--sidebar-width);
  }

  .bottom-nav-container[data-density="reader"].tabs-hidden:has(.bottom-nav-above) {
    padding-bottom: 0;
  }

  .bottom-nav-tabs {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-nav-tabs,
  .nav-item {
    transition: none;
  }

  .nav-item:active {
    transform: none;
  }
}
</style>
