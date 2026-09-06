<template>
  <SidebarNav />
  <BottomNavigation density="reader" v-bind="$attrs">
    <template #above>
      <div class="floating-bottom-area">
        <div v-if="$slots.popover" class="floating-above-popover">
          <slot name="popover" />
        </div>

        <slot name="above" />

        <div v-if="$slots.center" class="floating-bottom-navigation">
          <div class="floating-center-nav-group">
            <slot name="center" />
          </div>
        </div>
      </div>
    </template>
  </BottomNavigation>
</template>

<script setup lang="ts">
import BottomNavigation from '~/components/BottomNavigation.vue';
import SidebarNav from '~/components/common/SidebarNav.vue';

// Keep legacy slots and forward optional shared-navigation props/events unchanged.
defineOptions({ inheritAttrs: false });
</script>

<style scoped>
.floating-bottom-area {
  position: relative;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border-default);
}

.floating-above-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.75rem);
  width: 100%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.floating-above-popover :deep(*) {
  pointer-events: auto;
}

.floating-bottom-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  gap: 0.5rem;
  padding: 0.5rem;
  pointer-events: auto;
}

.floating-center-nav-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
</style>
