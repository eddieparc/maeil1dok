import type { Component, ComputedRef } from 'vue'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type ModalPosition = 'center' | 'bottom'

export interface ModalOptions {
  /** 모달 ID (자동 생성, 수동 지정 가능) */
  id?: string
  /** 모달 크기 */
  size?: ModalSize
  /** 모달 위치 (center: 중앙, bottom: 하단 시트) */
  position?: ModalPosition
  /** ESC 키로 닫기 허용 */
  closeOnEsc?: boolean
  /** 오버레이 클릭으로 닫기 허용 */
  closeOnOverlay?: boolean
  /** 닫기 버튼 표시 */
  showCloseButton?: boolean
  /** 오버레이 표시 */
  showOverlay?: boolean
  /** 닫힐 때 실행할 콜백 */
  onClose?: () => void
  /** 열릴 때 실행할 콜백 */
  onOpen?: () => void
  /** 커스텀 z-index (기본값 사용 권장) */
  zIndex?: number
  /** 모달이 닫힐 수 있는지 확인 (false 반환 시 닫기 취소) */
  beforeClose?: () => boolean | Promise<boolean>
  /** 컴포넌트에 전달할 props */
  props?: Record<string, unknown>
}

export interface ModalInstance {
  id: string
  component: Component | null
  options: Required<ModalOptions>
  resolve?: (value: unknown) => void
  reject?: (reason?: unknown) => void
}

export type ConfirmVariant = 'primary' | 'danger'
export type ConfirmIcon = 'warning' | 'info' | 'error' | 'success'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: ConfirmVariant
  icon?: ConfirmIcon
}

export interface AlertOptions {
  title: string
  description?: string
  confirmText?: string
  icon?: ConfirmIcon
  copyText?: string
}

export interface UseModalReturn {
  /** 컴포넌트로 모달 열기 */
  open: <T = unknown>(
    component: Component,
    options?: ModalOptions
  ) => Promise<T>

  /** 특정 모달 닫기 (id 없으면 최상위 모달) */
  close: (id?: string, result?: unknown) => void

  /** 모달 취소 (reject) */
  cancel: (id?: string, reason?: unknown) => void

  /** 모달 props 업데이트 */
  update: (id: string, props: Record<string, unknown>) => void

  /** 확인 다이얼로그 */
  confirm: (options: ConfirmOptions) => Promise<boolean>

  /** 알림 다이얼로그 */
  alert: (options: AlertOptions) => Promise<void>

  /** 현재 열린 모달 스택 */
  stack: ComputedRef<ModalInstance[]>

  /** 모달이 열려있는지 */
  isOpen: ComputedRef<boolean>

  /** 특정 모달이 열려있는지 */
  isModalOpen: (id: string) => boolean
}
