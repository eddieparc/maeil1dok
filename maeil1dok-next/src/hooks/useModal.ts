'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type ConfirmVariant = 'primary' | 'danger'
export type ModalIcon = 'warning' | 'error' | 'info' | 'success'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: ConfirmVariant
  icon?: ModalIcon
  closeOnEsc?: boolean
  closeOnOverlay?: boolean
}

export interface AlertOptions {
  title: string
  description?: string
  confirmText?: string
  icon?: ModalIcon
  closeOnEsc?: boolean
  closeOnOverlay?: boolean
}

type ModalType = 'confirm' | 'alert'

interface ModalBase {
  id: string
  type: ModalType
  title: string
  description?: string
  confirmText: string
  icon?: ModalIcon
  closeOnEsc: boolean
  closeOnOverlay: boolean
}

export interface ConfirmModalItem extends ModalBase {
  type: 'confirm'
  cancelText: string
  confirmVariant: ConfirmVariant
}

export interface AlertModalItem extends ModalBase {
  type: 'alert'
}

export type ModalItem = ConfirmModalItem | AlertModalItem

const DEFAULT_CONFIRM_TEXT = '확인'
const DEFAULT_CANCEL_TEXT = '취소'

let idCounter = 0
let stack: ModalItem[] = []
const listeners = new Set<() => void>()
const resolvers = new Map<string, (value: unknown) => void>()

function nextId(): string {
  idCounter += 1
  return `modal-${idCounter}`
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): ModalItem[] {
  return stack
}

function pushModal<T>(item: ModalItem): Promise<T> {
  stack = [...stack, item]
  emit()

  return new Promise<T>((resolve) => {
    resolvers.set(item.id, resolve as (value: unknown) => void)
  })
}

function popModal(id: string): void {
  stack = stack.filter((item) => item.id !== id)
  emit()
}

function resolveModal(id: string, value: unknown): void {
  const resolver = resolvers.get(id)
  if (resolver) {
    resolver(value)
    resolvers.delete(id)
  }

  popModal(id)
}

function getTopModalId(): string | null {
  return stack.length > 0 ? stack[stack.length - 1].id : null
}

function closeModal(id?: string, result?: unknown): void {
  const targetId = id ?? getTopModalId()
  if (!targetId) return

  const target = stack.find((item) => item.id === targetId)
  if (!target) return

  if (target.type === 'confirm') {
    resolveModal(targetId, Boolean(result))
    return
  }

  resolveModal(targetId, undefined)
}

function cancelModal(id?: string): void {
  const targetId = id ?? getTopModalId()
  if (!targetId) return

  const target = stack.find((item) => item.id === targetId)
  if (!target) return

  if (target.type === 'confirm') {
    resolveModal(targetId, false)
    return
  }

  resolveModal(targetId, undefined)
}

async function openConfirm(options: ConfirmOptions): Promise<boolean> {
  const item: ConfirmModalItem = {
    id: nextId(),
    type: 'confirm',
    title: options.title,
    description: options.description,
    confirmText: options.confirmText ?? DEFAULT_CONFIRM_TEXT,
    cancelText: options.cancelText ?? DEFAULT_CANCEL_TEXT,
    confirmVariant: options.confirmVariant ?? 'primary',
    icon: options.icon,
    closeOnEsc: options.closeOnEsc ?? true,
    closeOnOverlay: options.closeOnOverlay ?? true,
  }

  return pushModal<boolean>(item)
}

async function openAlert(options: AlertOptions): Promise<void> {
  const item: AlertModalItem = {
    id: nextId(),
    type: 'alert',
    title: options.title,
    description: options.description,
    confirmText: options.confirmText ?? DEFAULT_CONFIRM_TEXT,
    icon: options.icon,
    closeOnEsc: options.closeOnEsc ?? true,
    closeOnOverlay: options.closeOnOverlay ?? true,
  }

  await pushModal<void>(item)
}

export function useModal() {
  const modalStack = useSyncExternalStore(subscribe, snapshot, snapshot)

  const confirm = useCallback((options: ConfirmOptions) => openConfirm(options), [])
  const alert = useCallback((options: AlertOptions) => openAlert(options), [])
  const close = useCallback((id?: string, result?: unknown) => closeModal(id, result), [])
  const cancel = useCallback((id?: string) => cancelModal(id), [])

  return {
    confirm,
    alert,
    close,
    cancel,
    stack: modalStack,
    isOpen: modalStack.length > 0,
    topModal: modalStack.length > 0 ? modalStack[modalStack.length - 1] : null,
  }
}
