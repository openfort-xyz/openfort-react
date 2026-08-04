'use client'

import { useCallback, useState } from 'react'
import { AuthenticationError } from '../../../errors/auth.js'
import { toError } from '../../../errors/base.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { onError, onSuccess } from '../hookConsistency.js'
import { type BaseFlowState, mapStatus } from './status.js'

/**
 * Hook for user sign out operations
 *
 * This hook manages user logout functionality, clearing authentication state
 * and disconnecting from all services. It provides a clean way to sign out users
 * while handling any cleanup operations and providing loading/error states.
 * The hook ensures complete logout by clearing all stored credentials and state.
 *
 * @param hookOptions - Optional configuration with callback functions
 * @returns Current sign out state and actions
 *
 * @example
 * ```tsx
 * import { useSignOut } from '@openfort/react'
 *
 * function SignOutButton() {
 *   const { signOut, isLoading, error } = useSignOut()
 *   const run = async () => {
 *     const result = await signOut()
 *     if (result.error) return
 *     console.log('Signed out')
 *   }
 *   return <button onClick={run} disabled={isLoading}>{error ? error.shortMessage : 'Sign out'}</button>
 * }
 * ```
 */
const DEFAULT_SIGN_OUT_HOOK_OPTIONS: OpenfortHookOptions = {}

export function useSignOut(hookOptions: OpenfortHookOptions = DEFAULT_SIGN_OUT_HOOK_OPTIONS) {
  const logout = useOpenfortCore((s) => s.logout)
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })

  const signOut = useCallback(
    async (options: OpenfortHookOptions = {}) => {
      setStatus({
        status: 'loading',
      })
      try {
        await logout()
        setStatus({
          status: 'success',
        })

        return onSuccess({
          hookOptions,
          options,
          data: {},
        })
      } catch (cause) {
        const error = new AuthenticationError('Failed to sign out.', { cause: toError(cause) })
        setStatus({
          status: 'error',
          error,
        })
        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [logout, hookOptions]
  )

  return {
    ...mapStatus(status),
    signOut,
  }
}
