<script setup lang="ts">
import { computed } from 'vue'
import { BellIcon, BookOpenIcon, CircleCheckIcon, UsersIcon } from '@lucide/vue'
import type { NotificationItem } from '~/stores/notifications'

const props = defineProps<{ type: NotificationItem['type'] }>()

const icon = computed(() => {
  switch (props.type) {
    case 'reading_reminder':
      return BookOpenIcon
    case 'hasena_reminder':
      return CircleCheckIcon
    case 'friend_activity':
      return UsersIcon
    default:
      return BellIcon
  }
})
</script>

<template>
  <component :is="icon" :size="18" aria-hidden="true" />
</template>
