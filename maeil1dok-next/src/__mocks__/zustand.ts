import { act } from '@testing-library/react'
import * as ZustandExports from 'zustand'
import { type StateCreator } from 'zustand'

const { create: actualCreate, createStore: actualCreateStore } = ZustandExports

const storeResetFns = new Set<() => void>()

const create = (<T,>(initializer: StateCreator<T, [], []>) => {
  const store = actualCreate<T>()(initializer)
  const initialState = store.getState()
  storeResetFns.add(() => store.setState(initialState, true))
  return store
}) as typeof actualCreate

const createStore = (<T,>(initializer: StateCreator<T, [], []>) => {
  const store = actualCreateStore<T>()(initializer)
  const initialState = store.getState()
  storeResetFns.add(() => store.setState(initialState, true))
  return store
}) as typeof actualCreateStore

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => {
      resetFn()
    })
  })
})

export * from 'zustand'
export { create, createStore }
