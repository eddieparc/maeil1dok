'use client'

import { type HTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useScrollLock } from '@/hooks/useScrollLock'

type ModalSize = 'sm' | 'md' | 'lg'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: ModalSize
  closeOnOverlayClick?: boolean
  className?: string
}

function ModalHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-gray-200 px-6 py-4', className)} {...props} />
}

function ModalBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}

function ModalFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4', className)} {...props} />
}

const SIZE_CLASS_MAP: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function ModalRoot({ isOpen, onClose, children, size = 'md', closeOnOverlayClick = true, className }: ModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isRendered, setIsRendered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useScrollLock(isRendered)

  useEffect(() => {
    setIsMounted(true)
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }

      setIsRendered(true)
      const frame = window.requestAnimationFrame(() => setIsVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    setIsVisible(false)
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsRendered(false)
      closeTimeoutRef.current = null
    }, 200)

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isRendered) return

    const previousActiveElement = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (!dialog) return

    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const initialFocus = focusableElements[0] ?? dialog
    initialFocus.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const tabbable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (tabbable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstElement = tabbable[0]
      const lastElement = tabbable[tabbable.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousActiveElement?.focus()
    }
  }, [isRendered, onClose])

  const modalSize = useMemo(() => SIZE_CLASS_MAP[size], [size])

  if (!isMounted || !isRendered) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'transition-opacity duration-200 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <button
        type="button"
        aria-label="Close modal overlay"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        onClick={() => {
          if (closeOnOverlayClick) {
            onClose()
          }
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-2xl bg-white shadow-xl outline-none',
          'transition-all duration-200 ease-out',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          modalSize,
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

type ModalComponent = typeof ModalRoot & {
  Header: typeof ModalHeader
  Body: typeof ModalBody
  Footer: typeof ModalFooter
}

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
}) as ModalComponent
