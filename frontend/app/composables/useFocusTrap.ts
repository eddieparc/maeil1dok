import { ref, shallowRef, computed, watch, nextTick, onBeforeUnmount, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ')

interface ActiveTrap {
  container: HTMLElement
  previous: HTMLElement | null
  focusFirst: () => void
  zIndex: number
}

// Sheets and service modals share paint, pointer and keyboard/focus ownership.
const activeTraps = shallowRef<ActiveTrap[]>([])

export interface UseFocusTrapOptions {
  enabled?: Ref<boolean>
  autoFocus?: boolean
  returnFocusOnDeactivate?: boolean
  /** Capture Escape before an underlying sheet's document listener. */
  onEscape?: (event: KeyboardEvent) => void
}

export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
) {
  const { enabled = ref(true), autoFocus = true, returnFocusOnDeactivate = true } = options
  let trap: ActiveTrap | null = null
  // Retain the assigned layer during leave transitions and lower-owner removal.
  const zIndex = ref(1000)
  const isTopmost = computed(() => activeTraps.value.at(-1) === trap)

  function getFocusableElements(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(el => el.offsetParent !== null)
  }

  function focusFirst(): void {
    if (isTopmost.value) (getFocusableElements()[0] || containerRef.value)?.focus()
  }

  function focusLast(): void {
    if (isTopmost.value) (getFocusableElements().at(-1) || containerRef.value)?.focus()
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!enabled.value || !isTopmost.value) return
    if (event.key === 'Escape' && options.onEscape) {
      event.preventDefault()
      event.stopImmediatePropagation()
      options.onEscape(event)
      return
    }
    if (event.key !== 'Tab') return
    event.stopImmediatePropagation()
    const elements = getFocusableElements()
    const first = elements[0]
    const last = elements.at(-1)
    const active = document.activeElement
    if (!first) {
      event.preventDefault()
      containerRef.value?.focus()
    } else if (event.shiftKey && (active === first || !containerRef.value?.contains(active))) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && (active === last || !containerRef.value?.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleFocusIn(event: FocusEvent): void {
    if (isTopmost.value && !containerRef.value?.contains(event.target as Node)) focusFirst()
  }

  function activate(): void {
    if (typeof document === 'undefined' || !containerRef.value || trap) return
    zIndex.value = (activeTraps.value.at(-1)?.zIndex ?? 990) + 10
    trap = {
      container: containerRef.value,
      previous: document.activeElement as HTMLElement | null,
      focusFirst,
      zIndex: zIndex.value
    }
    activeTraps.value = [...activeTraps.value, trap]
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', handleFocusIn, true)
    // Wait for Vue's rendered refs, not a guessed transition duration/frame.
    if (autoFocus) void nextTick(() => { if (enabled.value) focusFirst() })
  }

  function deactivate(): void {
    if (typeof document === 'undefined' || !trap) return
    const removed = trap
    const wasTopmost = isTopmost.value
    // If a lower overlay is removed first, retain the original return target.
    for (const active of activeTraps.value) {
      if (active !== removed && active.previous && removed.container.contains(active.previous)) {
        active.previous = removed.previous
      }
    }
    trap = null
    activeTraps.value = activeTraps.value.filter(active => active !== removed)
    document.removeEventListener('keydown', handleKeyDown, true)
    document.removeEventListener('focusin', handleFocusIn, true)
    if (!wasTopmost || !returnFocusOnDeactivate) return
    const top = activeTraps.value.at(-1)
    const restoreFocus = () => {
      if (activeTraps.value.at(-1) !== top) return
      if (removed.previous?.isConnected && (!top || top.container.contains(removed.previous))) {
        removed.previous.focus()
      } else {
        top?.focusFirst()
      }
    }
    // A resumed service modal is inert until Vue patches its topmost state.
    if (top) void nextTick(restoreFocus)
    else restoreFocus()
  }

  watch([enabled, containerRef], ([isEnabled, container]) => {
    if (trap && (!isEnabled || trap.container !== container)) deactivate()
    if (isEnabled && container) activate()
  }, { immediate: true, flush: 'post' })
  onBeforeUnmount(deactivate)

  return { activate, deactivate, focusFirst, focusLast, isTopmost, zIndex }
}
