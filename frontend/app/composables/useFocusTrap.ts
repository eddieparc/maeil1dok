import { ref, watch, onUnmounted, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ')

export interface UseFocusTrapOptions {
  /** 트랩 활성화 여부 */
  enabled?: Ref<boolean>
  /** 첫 번째 요소로 자동 포커스 */
  autoFocus?: boolean
  /** 비활성화 시 원래 포커스로 복귀 */
  returnFocusOnDeactivate?: boolean
}

export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
) {
  const {
    enabled = ref(true),
    autoFocus = true,
    returnFocusOnDeactivate = true
  } = options

  const previousActiveElement = ref<HTMLElement | null>(null)

  function getFocusableElements(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(
      containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(el => {
      return el.offsetParent !== null // 화면에 보이는 요소만
    })
  }

  function focusFirst(): void {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[0].focus()
    } else {
      // focusable 요소가 없으면 컨테이너에 포커스
      containerRef.value?.focus()
    }
  }

  function focusLast(): void {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[elements.length - 1].focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!enabled.value || event.key !== 'Tab') return

    const elements = getFocusableElements()
    if (elements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = elements[0]
    const lastElement = elements[elements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey) {
      // Shift + Tab: 역방향
      if (activeElement === firstElement || !containerRef.value?.contains(activeElement)) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: 정방향
      if (activeElement === lastElement || !containerRef.value?.contains(activeElement)) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  function activate(): void {
    // SSR 가드: 서버에는 document가 없다
    if (typeof document === 'undefined') return
    if (!containerRef.value) return

    // 현재 포커스된 요소 저장
    previousActiveElement.value = document.activeElement as HTMLElement

    // 이벤트 리스너 등록
    document.addEventListener('keydown', handleKeyDown)

    // 자동 포커스
    if (autoFocus) {
      // 약간의 지연을 주어 트랜지션 후 포커스
      requestAnimationFrame(() => {
        focusFirst()
      })
    }
  }

  function deactivate(): void {
    // SSR 가드: 서버에는 document가 없다
    if (typeof document === 'undefined') return

    // 이벤트 리스너 제거
    document.removeEventListener('keydown', handleKeyDown)

    // 원래 포커스로 복귀
    if (returnFocusOnDeactivate && previousActiveElement.value) {
      previousActiveElement.value.focus()
      previousActiveElement.value = null
    }
  }

  // enabled 상태 감시
  watch(enabled, (isEnabled) => {
    if (isEnabled) {
      activate()
    } else {
      deactivate()
    }
  }, { immediate: true })

  // 컨테이너 변경 감시
  watch(containerRef, (newContainer, oldContainer) => {
    if (oldContainer && enabled.value) {
      deactivate()
    }
    if (newContainer && enabled.value) {
      activate()
    }
  })

  // 컴포넌트 언마운트 시 정리
  onUnmounted(() => {
    deactivate()
  })

  return {
    activate,
    deactivate,
    focusFirst,
    focusLast
  }
}
