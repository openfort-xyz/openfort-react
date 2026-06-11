'use client'

import { useContext } from 'react'
import { useStore } from 'zustand'
import { StoreContext } from './context'
import type { OpenfortStore } from './store'

export function useOpenfortStore<T>(selector: (state: OpenfortStore) => T): T {
  const store = useContext(StoreContext)
  if (!store) throw Error('useOpenfortStore must be inside CoreOpenfortProvider.')
  return useStore(store, selector)
}
