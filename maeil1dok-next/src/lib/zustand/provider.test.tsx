import { render, screen } from '@testing-library/react'
import { createStore } from 'zustand'
import { describe, expect, it } from 'vitest'

import { createStoreContext } from './provider'

type CounterState = {
  count: number
}

describe('createStoreContext', () => {
  it('reads state inside StoreProvider', () => {
    const { StoreProvider, useStoreContext } = createStoreContext<CounterState>()

    function Consumer() {
      const count = useStoreContext((state) => state.count)
      return <div>{count}</div>
    }

    render(
      <StoreProvider createStoreFn={() => createStore<CounterState>()(() => ({ count: 7 }))}>
        <Consumer />
      </StoreProvider>
    )

    expect(screen.getByText('7')).toBeTruthy()
  })

  it('throws when useStoreContext is used outside provider', () => {
    const { useStoreContext } = createStoreContext<CounterState>()

    function Consumer() {
      useStoreContext((state) => state.count)
      return null
    }

    expect(() => render(<Consumer />)).toThrowError(
      'useStoreContext must be used within StoreProvider'
    )
  })
})
