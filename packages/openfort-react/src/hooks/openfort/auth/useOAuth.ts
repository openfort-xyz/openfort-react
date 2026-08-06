'use client'

import type { OAuthProvider, User } from '@openfort/openfort-js'
import { useCallback, useRef, useState } from 'react'
import { useOpenfortRouting } from '../../../components/Openfort/useOpenfort.js'
import { AuthenticationError, NotAuthenticatedError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { authTransitionSupersededResult, startLocalAuthTransition } from '../../../shared/utils/authTransitionQueue.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { assertNavigableRedirect } from '../../../utils/urlSecurity.js'
import { useLatest } from '../../useLatest.js'
import { NO_HOOK_OPTIONS, onError, onSuccess } from '../hookConsistency.js'
import type { EthereumUserWallet, SolanaUserWallet } from '../walletTypes.js'
import { buildCallbackUrl } from './requestEmailVerification.js'
import { type BaseFlowState, mapStatus } from './status.js'
import { type CreateWalletPostAuthOptions, useConnectToWalletPostAuth } from './useConnectToWalletPostAuth.js'

// TODO: Open auth in a new tab and use polling to check for completion
type InitializeOAuthOptions = {
  provider: OAuthProvider
  redirectTo?: string
} & OpenfortHookOptions<InitOAuthReturnType>

type InitOAuthReturnType = {
  error?: OpenfortError
}

export type StoreCredentialsResult = {
  // type: "storeCredentials";
  user?: User
  wallet?: EthereumUserWallet | SolanaUserWallet
  error?: OpenfortError
}
type StoreCredentialsOptions = {
  userId: string
  token: string
} & OpenfortHookOptions<StoreCredentialsResult> &
  CreateWalletPostAuthOptions

type AuthHookOptions = {
  redirectTo?: string
} & OpenfortHookOptions<StoreCredentialsResult | InitOAuthReturnType> &
  CreateWalletPostAuthOptions

/**
 * Hook for OAuth-based authentication operations
 *
 * This hook manages OAuth authentication flows including provider initialization,
 * credential storage, and wallet connection after successful OAuth authentication.
 * It supports multiple OAuth providers and handles the complete authentication lifecycle
 * from provider selection to wallet setup.
 *
 * @param hookOptions - Optional configuration with callback functions and authentication options
 * @returns Current OAuth authentication state and actions
 *
 * @example
 * ```tsx
 * import { OAuthProvider, useOAuth } from '@openfort/react'
 *
 * function OAuthSignIn() {
 *   const { initOAuth, isLoading, error } = useOAuth()
 *   const signIn = async () => {
 *     const result = await initOAuth({ provider: OAuthProvider.GOOGLE })
 *     if (result.error) console.error(result.error.shortMessage)
 *   }
 *   return <button onClick={signIn} disabled={isLoading}>{error ? error.shortMessage : 'Sign in with Google'}</button>
 * }
 * ```
 */

export const useOAuth = (hookOptions: AuthHookOptions = NO_HOOK_OPTIONS) => {
  const hookOptionsRef = useLatest(hookOptions)
  const client = useOpenfortCore((s) => s.client)
  const { captureAuthSession, startAuthenticatedMutation, startAuthTransition } = useAuthTransitions()
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const authInvocationRef = useRef(0)
  const { open: isOpen } = useOpenfortRouting()

  const { tryUseWallet } = useConnectToWalletPostAuth()

  const storeCredentials = useCallback(
    async ({ userId, token, ...options }: StoreCredentialsOptions): Promise<StoreCredentialsResult> => {
      let settleStale: (() => boolean) | undefined
      setStatus({
        status: 'loading',
      })

      try {
        const transition = startLocalAuthTransition(
          startAuthTransition,
          authInvocationRef,
          () =>
            client.auth.storeCredentials({
              userId,
              token,
            }),
          () => setStatus({ status: 'idle' })
        )
        settleStale = transition.settleStale
        await transition.result
        if (settleStale()) return authTransitionSupersededResult()

        const user = (await updateUser()) || undefined
        if (settleStale()) return authTransitionSupersededResult()

        const { wallet } = await tryUseWallet({
          logoutOnError: options.logoutOnError ?? hookOptionsRef.current.logoutOnError,
          recoverWalletAutomatically:
            options.recoverWalletAutomatically ?? hookOptionsRef.current.recoverWalletAutomatically,
        })
        if (settleStale()) return authTransitionSupersededResult()

        setStatus({
          status: 'success',
        })

        return onSuccess({
          data: { user, wallet, type: 'storeCredentials' },
          hookOptions: hookOptionsRef.current,
          options,
        })
      } catch (e) {
        if (settleStale?.()) return authTransitionSupersededResult()
        const error = new AuthenticationError('Failed to store credentials.', { cause: toError(e) })

        setStatus({
          status: 'error',
          error,
        })

        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error,
        })
      }
    },
    [client, startAuthTransition, tryUseWallet, updateUser]
  )

  const initOAuth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      const authProvider = options.provider

      try {
        setStatus({
          status: 'loading',
        })

        const redirectUrl = await client.auth.initOAuth({
          provider: authProvider,
          redirectTo: buildCallbackUrl({
            provider: authProvider,
            callbackUrl: options?.redirectTo ?? hookOptionsRef.current.redirectTo,
            isOpen,
          }),
        })

        window.location.href = assertNavigableRedirect(redirectUrl)

        return onSuccess<InitOAuthReturnType>({
          data: {},
          hookOptions: hookOptionsRef.current,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to login with OAuth.', { cause: toError(e) })

        setStatus({
          status: 'error',
          error,
        })

        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error,
        })
      }
    },
    [client, isOpen]
  )

  const linkOauth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      const authProvider = options.provider
      const session = captureAuthSession()
      let mutationIsCurrent: (() => boolean) | undefined
      const isCurrent = () => session.isCurrent() && (mutationIsCurrent?.() ?? true)

      try {
        setStatus({
          status: 'loading',
        })

        const authToken = await client.getAccessToken()
        if (!isCurrent()) return authTransitionSupersededResult()

        if (!authToken) {
          throw new NotAuthenticatedError('No auth token found.')
        }

        const transition = startAuthenticatedMutation(() =>
          client.auth.initLinkOAuth({
            provider: authProvider,
            redirectTo: buildCallbackUrl({
              provider: authProvider,
              callbackUrl: options?.redirectTo ?? hookOptionsRef.current.redirectTo,
              isOpen,
            }),
          })
        )
        mutationIsCurrent = transition.isCurrent
        const redirectUrl = await transition.result
        if (!isCurrent()) return authTransitionSupersededResult()

        window.location.href = assertNavigableRedirect(redirectUrl)

        return onSuccess<InitOAuthReturnType>({
          data: {},
          hookOptions: hookOptionsRef.current,
          options,
        })
      } catch (e) {
        if (!isCurrent()) return authTransitionSupersededResult()
        const error = new AuthenticationError('Failed to link OAuth.', { cause: toError(e) })

        setStatus({
          status: 'error',
          error,
        })

        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error,
        })
      }
    },
    [captureAuthSession, client, isOpen, startAuthenticatedMutation]
  )

  return {
    initOAuth,
    linkOauth,
    storeCredentials,
    ...mapStatus(status),
  }
}
