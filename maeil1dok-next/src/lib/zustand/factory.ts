import { createStore, type StateCreator, type StoreApi } from 'zustand'

/**
 * SSR-safe Zustand store factory
 * 매 호출마다 독립적인 store 인스턴스를 반환합니다.
 * Next.js App Router에서 서버 요청 간 상태 누출을 방지합니다.
 */
export function createStoreFactory<T>(
  initializer: StateCreator<T, [], []>
): () => StoreApi<T> {
  return () => createStore<T>()(initializer)
}

export type { StateCreator }
