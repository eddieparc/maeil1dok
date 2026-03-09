import { render, type RenderOptions } from '@testing-library/react'
import { createContext, useContext, useRef, type ReactNode } from 'react'
import { createStore, useStore, type StoreApi, type StateCreator } from 'zustand'

export function createTestStore<T>(
  initializer: StateCreator<T, [], []>,
  initialState?: Partial<T>
): StoreApi<T> {
  const store = createStore<T>()(initializer)
  if (initialState) {
    store.setState(initialState)
  }
  return store
}

export function renderWithStore<T>(
  ui: React.ReactElement,
  {
    createStoreFn,
    ...renderOptions
  }: RenderOptions & {
    createStoreFn: () => StoreApi<T>
  }
) {
  const StoreContext = createContext<StoreApi<T> | null>(null)

  function StoreProvider({ children }: { children: ReactNode }) {
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

  const renderResult = render(ui, {
    wrapper: StoreProvider,
    ...renderOptions,
  })

  return {
    ...renderResult,
    useStoreContext,
  }
}
