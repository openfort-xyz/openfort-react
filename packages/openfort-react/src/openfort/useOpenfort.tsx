'use client'

import type { OpenfortCoreContextValue } from './CoreOpenfortProvider.js'
import { useOpenfortStore } from './useOpenfortStore.js'

const identity = (state: OpenfortCoreContextValue) => state

/**
 * Access Openfort core state: user, embedded accounts, active chain, auth, and wallet operations.
 * Must be used inside CoreOpenfortProvider (or OpenfortProvider which wraps it).
 *
 * Called without a selector it subscribes to the whole store, so the component
 * re-renders on every state change. Pass a selector to subscribe to one slice:
 *
 * ```tsx
 * const user = useOpenfort((s) => s.user)
 * ```
 *
 * A selector returning a fresh object or tuple needs `useShallow` from
 * `zustand/react/shallow`, otherwise the new reference re-renders on every change.
 *
 * @returns The selected slice, or the whole store when no selector is given
 * @throws Error if used outside CoreOpenfortProvider
 */
export function useOpenfortCore(): OpenfortCoreContextValue
export function useOpenfortCore<T>(selector: (state: OpenfortCoreContextValue) => T): T
export function useOpenfortCore<T>(selector?: (state: OpenfortCoreContextValue) => T): T | OpenfortCoreContextValue {
  return useOpenfortStore<T | OpenfortCoreContextValue>(selector ?? identity)
}
