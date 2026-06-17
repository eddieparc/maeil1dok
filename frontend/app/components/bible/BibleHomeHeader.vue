<template>
  <header class="home-header">
    <h1>성경</h1>
    <div class="header-actions">
      <BibleSearchButton />
      <button class="icon-button" type="button" aria-label="성경 설정 열기" @click="$emit('open-settings')">
        <SettingsIcon :size="20" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { SettingsIcon } from '@lucide/vue';
import BibleSearchButton from '~/components/bible/BibleSearchButton.vue';

defineEmits<{
  'open-settings': [];
}>();
</script>

<style scoped>
.home-header {
  align-items: center;
  background: var(--color-bg-card, #fff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.home-header h1 {
  color: var(--text-primary, #1f2937);
  font-size: 1.25rem;
  font-weight: 700;
}

.header-actions {
  align-items: center;
  display: flex;
  gap: 0.25rem;
}

.icon-button {
  align-items: center;
  border-radius: 8px;
  color: var(--text-secondary, #6b7280);
  display: inline-flex;
  justify-content: center;
  padding: 0.5rem;
  transition: all 0.2s;
}

.icon-button:hover {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--text-primary, #1f2937);
}
</style>
