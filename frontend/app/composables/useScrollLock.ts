import { ref, watch, onUnmounted, type Ref } from 'vue'

// 전역 ref count (여러 모달이 열렸을 때 스크롤 락 관리)
let lockCount = 0
let originalOverflow = ''
let originalPaddingRight = ''
let scrollbarWidth = 0

function getScrollbarWidth(): number {
  // 스크롤바 너비 계산 (레이아웃 시프트 방지)
  const outer = document.createElement('div')
  outer.style.visibility = 'hidden'
  outer.style.overflow = 'scroll'
  document.body.appendChild(outer)

  const inner = document.createElement('div')
  outer.appendChild(inner)

  const width = outer.offsetWidth - inner.offsetWidth
  outer.parentNode?.removeChild(outer)

  return width
}

function lockScroll(): void {
  if (lockCount === 0) {
    // 첫 번째 락: 원본 스타일 저장
    scrollbarWidth = getScrollbarWidth()
    originalOverflow = document.body.style.overflow
    originalPaddingRight = document.body.style.paddingRight

    // 스크롤 방지
    document.body.style.overflow = 'hidden'

    // 스크롤바가 있었다면 패딩으로 보정 (레이아웃 시프트 방지)
    if (scrollbarWidth > 0) {
      const currentPadding = parseInt(getComputedStyle(document.body).paddingRight, 10) || 0
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    }
  }
  lockCount++
}

function unlockScroll(): void {
  lockCount--
  if (lockCount <= 0) {
    lockCount = 0
    // 마지막 언락: 원본 스타일 복원
    document.body.style.overflow = originalOverflow
    document.body.style.paddingRight = originalPaddingRight
  }
}

export interface UseScrollLockOptions {
  /** 락 활성화 여부 */
  enabled?: Ref<boolean>
}

export function useScrollLock(options: UseScrollLockOptions = {}) {
  const { enabled = ref(true) } = options
  const isLocked = ref(false)

  function lock(): void {
    if (isLocked.value) return
    lockScroll()
    isLocked.value = true
  }

  function unlock(): void {
    if (!isLocked.value) return
    unlockScroll()
    isLocked.value = false
  }

  // enabled 상태 감시
  watch(enabled, (isEnabled) => {
    if (isEnabled) {
      lock()
    } else {
      unlock()
    }
  }, { immediate: true })

  // 컴포넌트 언마운트 시 정리
  onUnmounted(() => {
    unlock()
  })

  return {
    isLocked,
    lock,
    unlock
  }
}
