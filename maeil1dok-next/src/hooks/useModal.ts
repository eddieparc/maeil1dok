'use client'

import { useCallback, useState } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'

export function useModal(initialValue = false) {
  const [isOpen, setIsOpen] = useState(initialValue)

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((current) => !current)
  }, [])

  useScrollLock(isOpen)

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
