'use client'

import { Suspense, type ComponentType, type LazyExoticComponent, useSyncExternalStore } from 'react'
import { getModalRegistryEntry } from './ModalRegistry'
import { type BibleModalComponentProps, BibleModalId, type BibleModalData, type BibleModalHostProps } from './types'

function PendingModal({ modal, closeModal }: { modal: BibleModalData; closeModal: () => void }) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-[var(--color-bg-primary)] p-5 shadow-2xl"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{modal.id}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            이 모달은 전역 인프라에 등록되었지만 아직 실제 UI 연결이 완료되지 않았습니다.
          </p>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex rounded-lg bg-[var(--color-button-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-button-hover)]"
          onClick={closeModal}
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function renderRegisteredModal(
  modal: BibleModalData,
  closeModal: () => void,
  fallback: BibleModalHostProps['fallback'],
) {
  const entry = getModalRegistryEntry(modal.id)

  if (entry.status === 'placeholder') {
    return null
  }

  const ModalComponent = entry.component as LazyExoticComponent<ComponentType<BibleModalComponentProps>>

  return (
    <Suspense fallback={fallback ?? null}>
      <ModalComponent modal={modal} isOpen closeModal={closeModal} />
    </Suspense>
  )
}

export function ModalHost({ store, fallback = null, renderPlaceholder }: BibleModalHostProps) {
  const activeModal = useSyncExternalStore(
    store.subscribe,
    () => store.getState().activeModal,
    () => store.getState().activeModal,
  )

  if (!activeModal) {
    return null
  }

  const closeModal = () => {
    store.getState().closeModal()
  }

  const renderedModal = renderRegisteredModal(activeModal, closeModal, fallback)

  if (renderedModal) {
    return renderedModal
  }

  switch (activeModal.id) {
    case BibleModalId.VERSION_SELECTOR:
    case BibleModalId.NOTE_MODAL:
      return <>{renderPlaceholder?.(activeModal, closeModal) ?? <PendingModal modal={activeModal} closeModal={closeModal} />}</>
    default:
      return <>{renderPlaceholder?.(activeModal, closeModal) ?? <PendingModal modal={activeModal} closeModal={closeModal} />}</>
  }
}
