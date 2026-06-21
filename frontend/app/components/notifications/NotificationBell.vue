<template>
  <span class="notification-bell" :aria-label="label">
    <BellIcon :size="20" aria-hidden="true" />
    <span v-if="count > 0" class="notification-badge" aria-hidden="true">
      {{ displayCount }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BellIcon } from '@lucide/vue'

interface Props {
  count: number
}

const props = defineProps<Props>()

const displayCount = computed(() => props.count > 9 ? '9+' : String(props.count))
const label = computed(() => props.count > 0 ? `읽지 않은 알림 ${props.count}개` : '알림')
</script>

<style scoped>
.notification-bell {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
}

.notification-badge {
  position: absolute;
  top: 5px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--color-error);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  border: 2px solid var(--color-bg-card);
}
</style>
