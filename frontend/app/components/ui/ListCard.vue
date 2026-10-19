<script setup lang="ts">
withDefaults(defineProps<{ title?: string; padded?: boolean }>(), { title: '', padded: true })
</script>

<template>
  <section class="list-card" :class="{ 'list-card--padded': padded }" :aria-label="title || undefined">
    <h2 v-if="title" class="list-card__title">{{ title }}</h2>
    <div class="list-card__content"><slot /></div>
  </section>
</template>

<style scoped>
.list-card {
  border-radius: var(--radius-card);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
  letter-spacing: var(--tracking-body);
}
.list-card--padded { padding: var(--card-padding); }
.list-card__title { margin: 0; padding: var(--card-padding); font-size: 15px; font-weight: 700; line-height: 1.3; }
.list-card--padded .list-card__title { padding: 0 0 14px; }
.list-card__content :deep(.list-card-row) { box-sizing: border-box; min-height: 56px; padding: 12px 20px; border-bottom: 1px solid var(--color-border-light); }
.list-card__content :deep(.list-card-row:last-child) { border-bottom: none; }
.list-card--padded .list-card__content :deep(.list-card-row) { padding-inline: 0; }
.list-card__content :deep(.list-card-row:focus-visible) { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
</style>
