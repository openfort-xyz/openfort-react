import { useContext } from 'react'
import { useStore } from 'zustand'
import { OpenfortStoreContext } from './OpenfortStoreContext'
import type { OpenfortStore } from './openfortStore'

export function useOpenfortStore<T>(selector: (state: OpenfortStore) => T): T {
  const store = useContext(OpenfortStoreContext)
  if (!store) throw new Error('useOpenfortStore must be used within CoreOpenfortProvider.')
  return useStore(store, selector)
}
