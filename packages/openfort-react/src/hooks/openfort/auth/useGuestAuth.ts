'use client'

import type { User } from '@openfort/openfort-js'
import { useCallback, useRef, useState } from 'react'
import { AuthenticationError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { authTransitionSupersededResult, startLocalAuthTransition } from '../../../shared/utils/authTransitionQueue.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { logger } from '../../../utils/logger.js'
import { useLatest } from '../../useLatest.js'
import { onError, onSuccess } from '../hookConsistency.js'
import type { EthereumUserWallet, SolanaUserWallet } from '../walletTypes.js'
import { type BaseFlowState, mapStatus } from './status.js'
import { type CreateWalletPostAuthOptions, useConnectToWalletPostAuth } from './useConnectToWalletPostAuth.js'

type GuestHookResult = {
  error?: OpenfortError
  user?: User
  wallet?: EthereumUserWallet | SolanaUserWallet
}

type GuestHookOptions = OpenfortHookOptions<GuestHookResult> & CreateWalletPostAuthOptions

/**
 * Hook for guest authentication operations
 *
 * This hook manages guest user authentication, allowing users to create temporary
 * accounts without providing email or other credentials. Guest authentication provides
 * a quick way for users to get started with the application before committing to
 * full registration. After authentication, it automatically handles wallet connection.
 *
 * @param hookOptions - Optional configuration with callback functions and authentication options
 * @returns Current guest authentication state and actions
 *
 * @example
 * ```tsx
 * import { useGuestAuth } from '@openfort/react'
 *
 * function GuestSignIn() {
 *   const { signUpGuest, isLoading, error } = useGuestAuth()
 *   const signIn = async () => {
 *     const result = await signUpGuest()
 *     if (result.error) return
 *     console.log(result.user?.id)
 *   }
 *   return <button onClick={signIn} disabled={isLoading}>{error ? error.shortMessage : 'Continue as guest'}</button>
 * }
 * ```
 */
const DEFAULT_GUEST_HOOK_OPTIONS: GuestHookOptions = {}

export const useGuestAuth = (hookOptions: GuestHookOptions = DEFAULT_GUEST_HOOK_OPTIONS) => {
  const hookOptionsRef = useLatest(hookOptions)
  const client = useOpenfortCore((s) => s.client)
  const { startAuthTransition } = useAuthTransitions()
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const updateEmbeddedAccounts = useOpenfortCore((s) => s.updateEmbeddedAccounts)
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const authInvocationRef = useRef(0)
  const { tryUseWallet } = useConnectToWalletPostAuth()

  const signUpGuest = useCallback(
    async (options: GuestHookOptions = {}): Promise<GuestHookResult> => {
      let settleStale: (() => boolean) | undefined
      try {
        setStatus({
          status: 'loading',
        })

        const transition = startLocalAuthTransition(
          startAuthTransition,
          authInvocationRef,
          async (): Promise<User | undefined> => {
            try {
              logger.log('Guest signup: calling auth.signUpGuest()')
              const result = await client.auth.signUpGuest()
              logger.log('Guest signup: authentication succeeded')
              return result.user
            } catch (authError: unknown) {
              const isAlreadyLoggedIn =
                (authError as Error)?.message?.includes('Already logged in') ||
                (authError as Error)?.name === 'SessionError'
              if (!isAlreadyLoggedIn) throw authError

              logger.log('Guest signup: already logged in, using existing session')
              const user = (await client.user.get()) ?? undefined
              if (!user) throw authError
              return user
            }
          },
          () => setStatus({ status: 'idle' })
        )
        settleStale = transition.settleStale
        const user = await transition.result
        if (settleStale()) return authTransitionSupersededResult()

        await updateUser(user)
        if (settleStale()) return authTransitionSupersededResult()

        logger.log('Guest signup: calling tryUseWallet()')
        const { wallet } = await tryUseWallet({
          logoutOnError: options.logoutOnError ?? hookOptionsRef.current.logoutOnError,
          recoverWalletAutomatically:
            options.recoverWalletAutomatically ?? hookOptionsRef.current.recoverWalletAutomatically,
        })
        if (settleStale()) return authTransitionSupersededResult()

        if (wallet && typeof updateEmbeddedAccounts === 'function') {
          await updateEmbeddedAccounts()
          if (settleStale()) return authTransitionSupersededResult()
        }

        setStatus({
          status: 'success',
        })

        logger.log('Guest signup: success', wallet ? '(wallet created)' : '(no wallet)')
        return onSuccess({
          hookOptions: hookOptionsRef.current,
          options,
          data: { user, wallet },
        })
      } catch (error) {
        if (settleStale?.()) return authTransitionSupersededResult()
        logger.error('Guest signup failed:', error)
        const openfortError = new AuthenticationError('Failed to signup guest.', { cause: toError(error) })

        setStatus({
          status: 'error',
          error: openfortError,
        })

        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error: openfortError,
        })
      }
    },
    [client, startAuthTransition, updateUser, updateEmbeddedAccounts, tryUseWallet]
  )

  return {
    signUpGuest,
    ...mapStatus(status),
  }
}
