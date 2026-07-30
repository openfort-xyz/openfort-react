'use client'

import type { User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { AuthenticationError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { logger } from '../../../utils/logger.js'
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
 * const guestAuth = useGuestAuth({
 *   onSignUpGuestSuccess: (result) => console.log('Guest user created:', result.user),
 *   onSignUpGuestError: (error) => console.error('Guest signup failed:', error),
 *   recoverWalletAutomatically: true,
 *   logoutOnError: false,
 * });
 *
 * // Sign up as guest user
 * const handleGuestSignup = async () => {
 *   try {
 *     const result = await guestAuth.signUpGuest();
 *     if (result.user) {
 *       console.log('Guest user created:', result.user.id);
 *       console.log('User wallet:', result.wallet);
 *     }
 *   } catch (error) {
 *     console.error('Guest signup failed:', error);
 *   }
 * };
 *
 * // Check authentication state
 * if (guestAuth.isLoading) {
 *   console.log('Creating guest account...');
 * } else if (guestAuth.isError) {
 *   console.error('Guest auth error:', guestAuth.error);
 * } else if (guestAuth.isSuccess) {
 *   console.log('Guest authentication successful');
 * }
 *
 * // Example usage in component
 * return (
 *   <div>
 *     <button
 *       onClick={handleGuestSignup}
 *       disabled={guestAuth.isLoading}
 *     >
 *       {guestAuth.isLoading ? 'Creating Guest Account...' : 'Continue as Guest'}
 *     </button>
 *
 *     {guestAuth.isError && (
 *       <p>Error: {guestAuth.error?.message}</p>
 *     )}
 *   </div>
 * );
 * ```
 */
export const useGuestAuth = (hookOptions: GuestHookOptions = {}) => {
  const client = useOpenfortCore((s) => s.client)
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const updateEmbeddedAccounts = useOpenfortCore((s) => s.updateEmbeddedAccounts)
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const { tryUseWallet } = useConnectToWalletPostAuth()

  const signUpGuest = useCallback(
    async (options: GuestHookOptions = {}): Promise<GuestHookResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        let user: User | undefined

        try {
          logger.log('Guest signup: calling auth.signUpGuest()')
          const result = await client.auth.signUpGuest()
          user = result.user
          logger.log('Guest signup: auth OK, user id:', user?.id)
        } catch (authError: unknown) {
          const isAlreadyLoggedIn =
            (authError as Error)?.message?.includes('Already logged in') ||
            (authError as Error)?.name === 'SessionError'
          if (isAlreadyLoggedIn) {
            logger.log('Guest signup: already logged in, using existing session')
            user = (await client.user.get()) ?? undefined
            if (!user) throw authError
          } else {
            throw authError
          }
        }

        await updateUser(user)

        logger.log('Guest signup: calling tryUseWallet()')
        const { wallet } = await tryUseWallet({
          logoutOnError: options.logoutOnError ?? hookOptions.logoutOnError,
          recoverWalletAutomatically: options.recoverWalletAutomatically ?? hookOptions.recoverWalletAutomatically,
        })

        if (wallet && typeof updateEmbeddedAccounts === 'function') {
          await updateEmbeddedAccounts()
        }

        setStatus({
          status: 'success',
        })

        logger.log('Guest signup: success', wallet ? '(wallet created)' : '(no wallet)')
        return onSuccess({
          hookOptions,
          options,
          data: { user, wallet },
        })
      } catch (error) {
        logger.error('Guest signup failed:', error)
        const openfortError = new AuthenticationError('Failed to signup guest.', { cause: toError(error) })

        setStatus({
          status: 'error',
          error: openfortError,
        })

        return onError({
          hookOptions,
          options,
          error: openfortError,
        })
      }
    },
    [client, updateUser, updateEmbeddedAccounts, tryUseWallet, hookOptions]
  )

  return {
    signUpGuest,
    ...mapStatus(status),
  }
}
