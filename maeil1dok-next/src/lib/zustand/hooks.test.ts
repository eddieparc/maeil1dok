import { renderHook } from '@testing-library/react'
import { createStore } from 'zustand'
import { describe, expect, it } from 'vitest'

import { createUseStore, createUseStoreState } from './hooks'

type CounterState = {
  count: number
  label: string
}

describe('zustand hooks helpers', () => {
  it('createUseStore returns selected state', () => {
    const store = createStore<CounterState>()(() => ({ count: 3, label: 'ok' }))
    const useCounterStore = createUseStore(store)

    const { result } = renderHook(() => useCounterStore((state) => state.count))

    expect(result.current).toBe(3)
  })

  it('createUseStoreState returns full state', () => {
    const store = createStore<CounterState>()(() => ({ count: 5, label: 'all' }))
    const useCounterState = createUseStoreState(store)

    const { result } = renderHook(() => useCounterState())

    expect(result.current).toEqual({ count: 5, label: 'all' })
  })
})
