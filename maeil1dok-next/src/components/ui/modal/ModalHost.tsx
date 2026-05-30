'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertModal } from '@/components/ui/modal/AlertModal'
import { ConfirmModal } from '@/components/ui/modal/ConfirmModal'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useModal, type ModalItem } from '@/hooks/useModal'
import { useScrollLock } from '@/hooks/useScrollLock'
import { cn } from '@/lib/utils'

const BASE_Z_INDEX = 1000
const Z_INDEX_STEP = 10
const TRANSITION_MS = 200

type RenderStatus = 'entering' | 'open' | 'closing'

interface RenderedModal {
  modal: ModalItem
  status: RenderStatus
}

interface ModalLayerProps {
  modal: ModalItem
  status: RenderStatus
  zIndex: number
  isTopmost: boolean
  onClose: (id: string) => void
}

function ModalLayer({ modal, status, zIndex, isTopmost, onClose }: ModalLayerProps) {
  const focusRef = useFocusTrap(isTopmost && status !== 'closing', () => {
    if (modal.closeOnEsc) {
      onClose(modal.id)
    }
  })

  const isVisible = status !== 'entering'
  const isInteractive = isTopmost && status !== 'closing'

  return (
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4 transition-opacity duration-200 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
        isInteractive ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      style={{ zIndex }}
      data-testid="modal-layer"
    >
      <button
        type="button"
        aria-label="Close modal overlay"
        className={cn(
          'absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-[2px] transition-opacity duration-200 ease-out',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => {
          if (isInteractive && modal.closeOnOverlay) {
            onClose(modal.id)
          }
        }}
        data-testid="modal-overlay"
      />

      <div
        ref={focusRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-[420px] rounded-3xl bg-[var(--color-paper)] border border-[var(--color-rule)] shadow-[var(--shadow-xl)] outline-none transition-all duration-200 ease-out',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        data-testid="modal-content"
      >
        {modal.type === 'confirm' ? (
          <ConfirmModal
            modalId={modal.id}
            title={modal.title}
            description={modal.description}
            confirmText={modal.confirmText}
            cancelText={modal.cancelText}
            confirmVariant={modal.confirmVariant}
            icon={modal.icon}
          />
        ) : (
          <AlertModal
            modalId={modal.id}
            title={modal.title}
            description={modal.description}
            confirmText={modal.confirmText}
            icon={modal.icon}
          />
        )}
      </div>
    </div>
  )
}

export function ModalHost() {
  const { stack, close, topModal } = useModal()
  const [mounted, setMounted] = useState(false)
  const [renderedModals, setRenderedModals] = useState<RenderedModal[]>([])

  useScrollLock(renderedModals.length > 0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let frame: number | null = null

    setRenderedModals((previous) => {
      const previousById = new Map(previous.map((item) => [item.modal.id, item]))
      const currentIds = new Set(stack.map((item) => item.id))

      const active: RenderedModal[] = stack.map((modal) => {
        const existing = previousById.get(modal.id)
        return {
          modal,
          status: existing ? 'open' : 'entering',
        }
      })

      const closing = previous
        .filter((item) => !currentIds.has(item.modal.id))
        .map((item) => ({ ...item, status: 'closing' as const }))

      return [...active, ...closing]
    })

    frame = window.requestAnimationFrame(() => {
      setRenderedModals((previous) => previous.map((item) => (item.status === 'entering' ? { ...item, status: 'open' } : item)))
    })

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [stack])

  useEffect(() => {
    const timers: number[] = []

    for (const item of renderedModals) {
      if (item.status !== 'closing') continue

      const timer = window.setTimeout(() => {
        setRenderedModals((previous) => previous.filter((modal) => modal.modal.id !== item.modal.id))
      }, TRANSITION_MS)

      timers.push(timer)
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [renderedModals])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!topModal || !topModal.closeOnEsc) return

      event.preventDefault()
      close(topModal.id)
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, topModal])

  const layers = useMemo(() => {
    const topModalId = topModal?.id

    return renderedModals.map((item, index) => (
      <ModalLayer
        key={item.modal.id}
        modal={item.modal}
        status={item.status}
        zIndex={BASE_Z_INDEX + index * Z_INDEX_STEP}
        isTopmost={item.modal.id === topModalId}
        onClose={(id) => close(id)}
      />
    ))
  }, [close, renderedModals, topModal?.id])

  if (!mounted || renderedModals.length === 0) {
    return null
  }

  return createPortal(layers, document.body)
}
