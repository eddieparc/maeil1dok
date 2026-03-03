'use client'

import { useEffect } from 'react'

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const { style } = document.body
    const previousOverflow = style.overflow

    style.overflow = 'hidden'

    return () => {
      style.overflow = previousOverflow
    }
  }, [locked])
}
