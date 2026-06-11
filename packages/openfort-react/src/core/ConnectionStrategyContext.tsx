'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { ConnectionStrategy } from './ConnectionStrategy'

const ConnectionStrategyContext = createContext<ConnectionStrategy | null>(null)

/**
 * Provides the current connection strategy (bridge or embedded) to the tree.
 * Used internally by OpenfortProvider. Rarely needed in app code.
 */
export function ConnectionStrategyProvider({
  strategy,
  children,
}: {
  strategy: ConnectionStrategy | null
  children?: ReactNode
}) {
  return <ConnectionStrategyContext.Provider value={strategy}>{children}</ConnectionStrategyContext.Provider>
}

/**
 * Returns the current connection strategy (bridge or embedded), or null if not in provider.
 *
 * @returns ConnectionStrategy or null
 */
export function useConnectionStrategy(): ConnectionStrategy | null {
  return useContext(ConnectionStrategyContext)
}
