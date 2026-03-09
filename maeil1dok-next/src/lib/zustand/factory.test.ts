import { describe, expect, it } from 'vitest'

import { createStoreFactory } from './factory'

describe('createStoreFactory', () => {
  it('returns isolated store instances per call', () => {
    type CounterState = {
      count: number
      inc: () => void
    }

    const createCounterStore = createStoreFactory<CounterState>((set) => ({
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
    }))

    const storeA = createCounterStore()
    const storeB = createCounterStore()

    storeA.getState().inc()

    expect(storeA.getState().count).toBe(1)
    expect(storeB.getState().count).toBe(0)
    expect(storeA).not.toBe(storeB)
  })
})
