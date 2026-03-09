import { useStore, type StoreApi } from 'zustand'

/**
 * StoreApi로부터 타입 안전한 useStore 훅을 생성합니다.
 */
export function createUseStore<T>(store: StoreApi<T>) {
  return function useStoreHook<S>(selector: (state: T) => S): S {
    return useStore(store, selector)
  }
}

/**
 * 전체 상태를 반환하는 훅 생성 (셀렉터 없이)
 */
export function createUseStoreState<T>(store: StoreApi<T>) {
  return function useStoreState(): T {
    return useStore(store)
  }
}
