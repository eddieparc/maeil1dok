<template>
  <div class="app-shell">
    <SidebarNav />
    <div class="container page-layout-content">
      <!-- 고정 영역 -->
      <div class="fixed-area">
        <PageHeader
          v-if="hasHeaderAction"
          :title="title"
          :fallback-path="fallbackPath"
          :show-back="showBackButton"
          :on-back="onBack"
        >
          <template #right>
            <slot name="header-action"></slot>
          </template>
        </PageHeader>
        <PageHeader
          v-else
          :title="title"
          :fallback-path="fallbackPath"
          :show-back="showBackButton"
          :on-back="onBack"
        />
      </div>

      <!-- 스크롤 영역 -->
      <div class="scroll-area" :class="[scrollAreaClass, { 'with-floating-nav': showFloatingNav }]">
        <slot></slot>
      </div>
    </div>
    <BottomNavigation v-if="showFloatingNav" />
  </div>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import BottomNavigation from '~/components/BottomNavigation.vue'
import SidebarNav from '~/components/common/SidebarNav.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  showBackButton: {
    type: Boolean,
    default: true
  },
  fallbackPath: {
    type: String,
    default: '/'
  },
  onBack: {
    type: Function,
    default: null
  },
  scrollAreaClass: {
    type: String,
    default: ''
  },
  showFloatingNav: {
    type: Boolean,
    default: true
  }
})

const slots = useSlots()
const hasHeaderAction = computed(() => Boolean(slots['header-action']))
</script>

<style scoped>
.app-shell {
  min-height: 100dvh;
  background: var(--color-bg-primary);
}

.container {
  max-width: var(--content-max);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  position: relative;
  width: 100%;
}

.fixed-area {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-card);
}

.scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px));
}

.scroll-area.with-floating-nav {
  padding-bottom: calc(var(--tabbar-height) + 12px + max(env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px)));
}

@media (min-width: 1024px) {
  .app-shell {
    padding-left: var(--sidebar-width);
  }

  .scroll-area,
  .scroll-area.with-floating-nav {
    padding-bottom: 0;
  }
}
</style>
