'use client'

import { createContext, type ReactNode, useContext } from 'react'

const PageActivityContext = createContext(true)

/** Supplies whether a modal page is allowed to publish asynchronous results. */
export function PageActivityProvider({ active, children }: { active: boolean; children: ReactNode }) {
  return <PageActivityContext.Provider value={active}>{children}</PageActivityContext.Provider>
}

/** Returns `false` as soon as the containing modal page starts exiting. */
export function usePageActivity(): boolean {
  return useContext(PageActivityContext)
}
