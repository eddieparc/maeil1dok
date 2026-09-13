<script setup lang="ts">
import { ref, watch } from 'vue'
import { ZoomIn, ZoomOut } from '@lucide/vue'
import AppButton from '~/components/ui/AppButton.vue'
import BottomSheet from '~/components/ui/BottomSheet.vue'

const props = defineProps<{ image: { src: string; alt: string } | null }>()
const emit = defineEmits<{ close: [] }>()
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
let startX = 0
let startY = 0
let lastX = 0
let lastY = 0
let distance = 0
watch(() => props.image, () => { zoom.value = 1; panX.value = 0; panY.value = 0; distance = 0 })
function constrainPan() {
  const max = Math.max(0, (zoom.value - 1) * 150)
  panX.value = Math.max(-max, Math.min(max, panX.value))
  panY.value = Math.max(-max, Math.min(max, panY.value))
}
function changeZoom(delta: number) {
  zoom.value = Math.max(0.5, Math.min(3, zoom.value + delta))
  constrainPan()
}
function startTouch(event: TouchEvent) {
  event.preventDefault()
  const [first, second] = Array.from(event.touches)
  if (first && second) distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
  else if (first) { startX = first.clientX; startY = first.clientY; lastX = panX.value; lastY = panY.value; distance = 0 }
}
function moveTouch(event: TouchEvent) {
  event.preventDefault()
  const [first, second] = Array.from(event.touches)
  if (first && second) {
    const next = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    if (distance > 0) {
      const target = Math.max(0.5, Math.min(3, zoom.value * next / distance))
      zoom.value += (target - zoom.value) * 0.1
    }
    distance = next
    constrainPan()
  } else if (first && zoom.value > 1) {
    panX.value = lastX + (first.clientX - startX) * 0.8
    panY.value = lastY + (first.clientY - startY) * 0.8
    constrainPan()
  }
}
</script>

<template>
  <BottomSheet :model-value="!!image" :title="image?.alt || ''" @update:model-value="!$event && emit('close')">
    <template #footer>
      <div class="install-image-tools">
        <AppButton data-testid="install-zoom-out" variant="ghost" size="sm" :disabled="zoom <= 0.5" aria-label="이미지 축소" @click="changeZoom(-0.5)"><ZoomOut :size="20" aria-hidden="true" /></AppButton>
        <output aria-live="polite">{{ Math.round(zoom * 100) }}%</output>
        <AppButton data-testid="install-zoom-in" variant="ghost" size="sm" :disabled="zoom >= 3" aria-label="이미지 확대" @click="changeZoom(0.5)"><ZoomIn :size="20" aria-hidden="true" /></AppButton>
      </div>
    </template>
    <div v-if="image" class="install-image-viewport" data-testid="install-image-viewport" @touchstart="startTouch" @touchmove="moveTouch" @touchend="constrainPan" @touchcancel="constrainPan">
      <NuxtImg :src="image.src" :alt="image.alt" data-testid="install-image-full" class="install-image-full" format="webp" :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }" />
    </div>
  </BottomSheet>
</template>

<style scoped>
.install-image-tools { display: flex; align-items: center; justify-content: center; gap: 16px; }
.install-image-tools output { min-width: 48px; text-align: center; font-size: 13px; font-variant-numeric: tabular-nums; color: var(--color-text-secondary); }
.install-image-viewport { display: flex; align-items: center; justify-content: center; min-height: 240px; height: 60dvh; overflow: hidden; border-radius: var(--radius-control); background: var(--color-bg-tertiary); touch-action: none; }
.install-image-full { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; transition: transform var(--duration-micro) ease; }
@media (prefers-reduced-motion: reduce) { .install-image-full { transition: none; } }
</style>
