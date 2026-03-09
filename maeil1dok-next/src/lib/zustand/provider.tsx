'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore, type StoreApi } from 'zustand'

/**
 * Zustand store를 위한 범용 Context Provider 생성 유틸리티
 * useState(() => createStore()) 패턴으로 SSR 안전성 보장
 */
export function createStoreContext<T>() {
  const StoreContext = createContext<StoreApi<T> | null>(null)

  function StoreProvider({
    children,
    createStoreFn,
  }: {
    children: ReactNode
    createStoreFn: () => StoreApi<T>
  }) {
    const storeRef = useRef<StoreApi<T> | null>(null)
    if (storeRef.current === null) {
      storeRef.current = createStoreFn()
    }
    return (
      <StoreContext.Provider value={storeRef.current}>
        {children}
      </StoreContext.Provider>
    )
  }

  function useStoreContext<S>(selector: (state: T) => S): S {
    const store = useContext(StoreContext)
    if (!store) {
      throw new Error('useStoreContext must be used within StoreProvider')
    }
    return useStore(store, selector)
  }

  function useStoreApi(): StoreApi<T> {
    const store = useContext(StoreContext)
    if (!store) {
      throw new Error('useStoreApi must be used within StoreProvider')
    }
    return store
  }

  return { StoreProvider, useStoreContext, useStoreApi, StoreContext }
}
