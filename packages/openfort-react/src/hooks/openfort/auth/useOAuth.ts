'use client'

import type { OAuthProvider, User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { useOpenfortRouting } from '../../../components/Openfort/useOpenfort.js'
import { AuthenticationError, NotAuthenticatedError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { onError, onSuccess } from '../hookConsistency.js'
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
 * const oauth = useOAuth({
 *   onInitializeOAuthSuccess: (result) => console.log('OAuth initialized'),
 *   onInitializeOAuthError: (error) => console.error('OAuth init failed:', error),
 *   onStoreCredentialsSuccess: (result) => console.log('Authenticated:', result.user),
 *   redirectTo: 'https://yourapp.com/auth/callback',
 *   recoverWalletAutomatically: true,
 * });
 *
 * // Initialize OAuth with a provider
 * const handleGoogleAuth = async () => {
 *   await oauth.initOAuth({
 *     provider: OAuthProvider.GOOGLE,
 *     redirectTo: 'https://yourapp.com/auth/callback',
 *   });
 * };
 *
 * const handleDiscordAuth = async () => {
 *   await oauth.initOAuth({
 *     provider: OAuthProvider.DISCORD,
 *   });
 * };
 *
 * // Store OAuth credentials (typically called from callback handler)
 * const handleStoreCredentials = async () => {
 *   await oauth.storeCredentials({
 *     player: 'player-id-from-callback',
 *     accessToken: 'access-token-from-callback',
 *     refreshToken: 'refresh-token-from-callback',
 *   });
 * };
 *
 * // Link OAuth provider to existing authenticated account
 * const handleLinkOAuth = async () => {
 *   await oauth.linkOauth({
 *     provider: OAuthProvider.GOOGLE,
 *     redirectTo: 'https://yourapp.com/auth/callback',
 *   });
 * };
 *
 * // Check authentication state
 * if (oauth.isLoading) {
 *   console.log('Processing OAuth authentication...');
 * } else if (oauth.isError) {
 *   console.error('OAuth error:', oauth.error);
 * } else if (oauth.isSuccess) {
 *   console.log('OAuth authentication successful');
 * }
 *
 * // Example usage in component with multiple providers
 * return (
 *   <div>
 *     <button onClick={handleGoogleAuth} disabled={oauth.isLoading}>
 *       Sign in with Google
 *     </button>
 *     <button onClick={handleDiscordAuth} disabled={oauth.isLoading}>
 *       Sign in with Discord
 *     </button>
 *   </div>
 * );
 * ```
 */
const DEFAULT_AUTH_HOOK_OPTIONS: AuthHookOptions = {}

export const useOAuth = (hookOptions: AuthHookOptions = DEFAULT_AUTH_HOOK_OPTIONS) => {
  const client = useOpenfortCore((s) => s.client)
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const { open: isOpen } = useOpenfortRouting()

  const { tryUseWallet } = useConnectToWalletPostAuth()

  const storeCredentials = useCallback(
    async ({ userId, token, ...options }: StoreCredentialsOptions): Promise<StoreCredentialsResult> => {
      setStatus({
        status: 'loading',
      })

      try {
        await client.auth.storeCredentials({
          userId,
          token,
        })
        setStatus({
          status: 'success',
        })

        const user = (await updateUser()) || undefined

        const { wallet } = await tryUseWallet({
          logoutOnError: options.logoutOnError ?? hookOptions.logoutOnError,
          recoverWalletAutomatically: options.recoverWalletAutomatically ?? hookOptions.recoverWalletAutomatically,
        })

        return onSuccess({
          data: { user, wallet, type: 'storeCredentials' },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to store credentials.', { cause: toError(e) })

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
    [client, hookOptions, tryUseWallet, updateUser]
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
            callbackUrl: hookOptions?.redirectTo ?? options?.redirectTo,
            isOpen,
          }),
        })

        window.location.href = redirectUrl

        return onSuccess<InitOAuthReturnType>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to login with OAuth.', { cause: toError(e) })

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
    [client, hookOptions, isOpen]
  )

  const linkOauth = useCallback(
    async (options: InitializeOAuthOptions): Promise<InitOAuthReturnType> => {
      const authProvider = options.provider

      try {
        setStatus({
          status: 'loading',
        })

        const authToken = await client.getAccessToken()

        if (!authToken) {
          throw new NotAuthenticatedError('No auth token found.')
        }

        const redirectUrl = await client.auth.initLinkOAuth({
          provider: authProvider,
          redirectTo: buildCallbackUrl({
            provider: authProvider,
            callbackUrl: options?.redirectTo ?? hookOptions?.redirectTo,
            isOpen,
          }),
        })

        window.location.href = redirectUrl

        return onSuccess<InitOAuthReturnType>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to link OAuth.', { cause: toError(e) })

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
    [client, hookOptions, isOpen]
  )

  return {
    initOAuth,
    linkOauth,
    storeCredentials,
    ...mapStatus(status),
  }
}
