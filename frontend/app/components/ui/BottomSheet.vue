<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId } from 'vue'
import { X } from '@lucide/vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useScrollLock } from '~/composables/useScrollLock'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ modelValue: boolean; title?: string }>(), { title: '' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const titleId = useId()
const sheetRef = ref<HTMLElement | null>(null)
const mounted = ref(false)
const open = computed(() => mounted.value && props.modelValue)
useScrollLock({ enabled: open })
useFocusTrap(sheetRef, { enabled: open })
const close = () => emit('update:modelValue', false)
function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}
let dragStart: number | null = null
function startDrag(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  dragStart = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function endDrag(event: PointerEvent) {
  if (dragStart !== null && event.clientY - dragStart >= 48) close()
  dragStart = null
}
onMounted(() => {
  mounted.value = true
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="bottom-sheet" appear>
      <div v-if="open" class="bottom-sheet__overlay" @click.self="close">
        <section ref="sheetRef" v-bind="$attrs" class="bottom-sheet" role="dialog" aria-modal="true" :aria-labelledby="title ? titleId : undefined" :aria-label="title ? undefined : ($attrs['aria-label'] as string || '대화상자')" tabindex="-1">
          <div class="bottom-sheet__handle-area" aria-hidden="true" @pointerdown="startDrag" @pointerup="endDrag" @pointercancel="dragStart = null">
            <span class="bottom-sheet__handle" />
          </div>
          <header class="bottom-sheet__header">
            <h2 v-if="title" :id="titleId" class="bottom-sheet__title">{{ title }}</h2>
            <slot name="header-extra" :close="close" />
            <button class="bottom-sheet__close" type="button" aria-label="닫기" @click="close"><X :size="22" aria-hidden="true" /></button>
          </header>
          <div class="bottom-sheet__content" data-modal-scrollable><slot :close="close" /></div>
          <footer v-if="$slots.footer" class="bottom-sheet__footer"><slot name="footer" :close="close" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bottom-sheet__overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center; background: var(--color-overlay); backdrop-filter: blur(2px); }
.bottom-sheet {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 768px;
  max-height: 90dvh;
  padding: 0 24px 32px;
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-sheet);
  color: var(--color-text-primary);
  letter-spacing: var(--tracking-body);
}
.bottom-sheet__handle-area { display: flex; align-items: center; justify-content: center; min-height: var(--hit-min); flex-shrink: 0; touch-action: none; cursor: grab; }
.bottom-sheet__handle { width: 40px; height: 4px; border-radius: var(--radius-pill); background: var(--color-border-default); }
.bottom-sheet__header { display: flex; align-items: center; gap: 12px; flex-shrink: 0; padding-bottom: 12px; }
.bottom-sheet__title { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.3; }
.bottom-sheet__close { display: inline-flex; align-items: center; justify-content: center; min-width: var(--hit-min); min-height: var(--hit-min); margin-left: auto; padding: 0; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; color: var(--color-accent-primary); cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.bottom-sheet__close:hover { background: var(--color-bg-hover); }
.bottom-sheet__close:active { transform: scale(0.97); }
.bottom-sheet:focus-visible, .bottom-sheet__close:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.bottom-sheet__close:focus-visible { border-color: var(--color-accent-primary); }
.bottom-sheet__content { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.bottom-sheet__footer { flex-shrink: 0; padding-top: 20px; }
.bottom-sheet-enter-active, .bottom-sheet-leave-active { transition: opacity var(--duration-sheet) var(--ease-decelerate); }
.bottom-sheet-enter-active .bottom-sheet, .bottom-sheet-leave-active .bottom-sheet { transition: transform var(--duration-sheet) var(--ease-decelerate); }
.bottom-sheet-enter-from, .bottom-sheet-leave-to { opacity: 0; }
.bottom-sheet-enter-from .bottom-sheet, .bottom-sheet-leave-to .bottom-sheet { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .bottom-sheet-enter-active .bottom-sheet, .bottom-sheet-leave-active .bottom-sheet { transition: none; }
  .bottom-sheet-enter-from .bottom-sheet, .bottom-sheet-leave-to .bottom-sheet { transform: none; }
  .bottom-sheet__close { transition: none; }
  .bottom-sheet__close:active { transform: none; }
}
</style>
