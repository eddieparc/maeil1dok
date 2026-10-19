import { computed, markRaw, type Component } from 'vue'
import type { ModalInstance, ModalOptions } from '~/types/modal'

// ID 카운터 (컴포넌트 간 공유 불필요)
let idCounter = 0

// Resolve/Reject 함수 저장소 (useState에 저장 불가능한 함수들)
const resolvers = new Map<string, (value: unknown) => void>()
const rejectors = new Map<string, (reason?: unknown) => void>()

const Z_INDEX_BASE = 1000
const Z_INDEX_INCREMENT = 10

function generateId(): string {
  return `modal-${++idCounter}-${Date.now()}`
}

function getDefaultOptions(): Required<ModalOptions> {
  return {
    id: '',
    size: 'md',
    position: 'center',
    closeOnEsc: true,
    closeOnOverlay: true,
    showCloseButton: true,
    showOverlay: true,
    onClose: () => {},
    onOpen: () => {},
    zIndex: Z_INDEX_BASE,
    beforeClose: () => true,
    props: {}
  }
}

// useState에 저장할 수 있는 직렬화 가능한 모달 데이터
interface SerializableModalData {
  id: string
  componentName: string
  options: Required<ModalOptions>
}

export function useModalState() {
  // Nuxt useState를 사용하여 컴포넌트 간 상태 공유
  const modalStack = useState<ModalInstance[]>('modal-stack', () => [])

  // computed 대신 직접 ref 사용 (반응성 보장)
  const isOpen = computed(() => modalStack.value.length > 0)
  const topModal = computed(() => modalStack.value[modalStack.value.length - 1] || null)

  function open<T = unknown>(
    component: Component,
    options: ModalOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = options.id || generateId()
      const zIndex = Z_INDEX_BASE + modalStack.value.length * Z_INDEX_INCREMENT

      // 함수는 별도 저장소에 보관
      resolvers.set(id, resolve as (value: unknown) => void)
      rejectors.set(id, reject)

      const instance: ModalInstance = {
        id,
        component: markRaw(component),
        options: {
          ...getDefaultOptions(),
          ...options,
          id,
          zIndex,
          props: {
            ...options.props,
            modalId: id // 자동으로 modalId 주입
          }
        },
        resolve: resolve as (value: unknown) => void,
        reject
      }

      modalStack.value = [...modalStack.value, instance]

      // onOpen 콜백 호출
      instance.options.onOpen()
    })
  }

  async function close(id?: string, result?: unknown): Promise<void> {
    const targetId = id || topModal.value?.id
    if (!targetId) return

    const index = modalStack.value.findIndex(m => m.id === targetId)
    if (index === -1) return

    const instance = modalStack.value[index]

    // beforeClose 체크
    const canClose = await instance.options.beforeClose()
    if (!canClose || !modalStack.value.some(modal => modal === instance)) return

    // resolve로 결과 전달 (저장소에서 가져오기)
    const resolver = resolvers.get(targetId)
    if (resolver) {
      resolver(result)
      resolvers.delete(targetId)
    }
    rejectors.delete(targetId)

    // 스택에서 제거
    modalStack.value = modalStack.value.filter(m => m.id !== targetId)

    // onClose 콜백 호출
    instance.options.onClose()
  }

  function cancel(id?: string, reason?: unknown): void {
    const targetId = id || topModal.value?.id
    if (!targetId) return

    const index = modalStack.value.findIndex(m => m.id === targetId)
    if (index === -1) return

    const instance = modalStack.value[index]

    // reject로 취소 전달 (저장소에서 가져오기)
    const rejector = rejectors.get(targetId)
    if (rejector) {
      rejector(reason)
      rejectors.delete(targetId)
    }
    resolvers.delete(targetId)

    // 스택에서 제거
    modalStack.value = modalStack.value.filter(m => m.id !== targetId)

    // onClose 콜백 호출
    instance.options.onClose()
  }

  function update(id: string, props: Record<string, unknown>): void {
    const index = modalStack.value.findIndex(m => m.id === id)
    if (index === -1) return

    const instance = modalStack.value[index]
    instance.options.props = {
      ...instance.options.props,
      ...props
    }

    // 반응성 트리거
    modalStack.value = [...modalStack.value]
  }

  function isModalOpen(id: string): boolean {
    return modalStack.value.some(m => m.id === id)
  }

  function closeAll(): void {
    // 모든 모달을 reject로 닫기
    modalStack.value.forEach(instance => {
      const rejector = rejectors.get(instance.id)
      if (rejector) {
        rejector('Modal closed')
        rejectors.delete(instance.id)
      }
      resolvers.delete(instance.id)
    })
    modalStack.value = []
  }

  return {
    stack: modalStack, // raw ref 직접 반환
    isOpen,
    topModal,
    open,
    close,
    cancel,
    update,
    isModalOpen,
    closeAll
  }
}
