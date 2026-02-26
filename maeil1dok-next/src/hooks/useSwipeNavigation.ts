import { useCallback, useRef } from 'react'

interface SwipeNavigationConfig {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  threshold?: number
}

interface SwipeHandlers {
  onTouchStart: (event: React.TouchEvent) => void
  onTouchMove: (event: React.TouchEvent) => void
  onTouchEnd: () => void
}

const DEFAULT_THRESHOLD = 50

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = DEFAULT_THRESHOLD,
}: SwipeNavigationConfig): SwipeHandlers {
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const deltaXRef = useRef(0)
  const deltaYRef = useRef(0)

  const reset = useCallback(() => {
    startXRef.current = null
    startYRef.current = null
    deltaXRef.current = 0
    deltaYRef.current = 0
  }, [])

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) {
      reset()
      return
    }

    startXRef.current = touch.clientX
    startYRef.current = touch.clientY
    deltaXRef.current = 0
    deltaYRef.current = 0
  }, [reset])

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) {
      return
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    deltaXRef.current = touch.clientX - startXRef.current
    deltaYRef.current = touch.clientY - startYRef.current
  }, [])

  const onTouchEnd = useCallback(() => {
    const absX = Math.abs(deltaXRef.current)
    const absY = Math.abs(deltaYRef.current)

    if (absX < threshold || absX <= absY) {
      reset()
      return
    }

    if (deltaXRef.current < 0) {
      onSwipeLeft()
    } else {
      onSwipeRight()
    }

    reset()
  }, [onSwipeLeft, onSwipeRight, reset, threshold])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
