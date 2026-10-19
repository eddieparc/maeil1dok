<script setup lang="ts">
import EmptyState from '../common/EmptyState.vue'

defineProps<{
  readonly title?: string
  readonly description?: string
  readonly text?: string
  readonly hint?: string
  readonly fullscreen?: boolean
  readonly guide?: string[]
  readonly actionText?: string
}>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <EmptyState v-bind="$props" presentation="cards" @action="emit('action')">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </EmptyState>
</template>
