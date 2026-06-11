'use client'

import { useEffect, useRef, useState } from 'react'
import { UIAuthProvider } from '../../../components/Openfort/types'
import { OpenfortError, OpenfortReactErrorType } from '../../../core/errors'
import type { OpenfortHookOptions } from '../../../types'
import { logger } from '../../../utils/logger'
import { parseCallbackUrl, suppressReferrer } from '../../../utils/urlSecurity'
import type { CreateWalletPostAuthOptions } from './useConnectToWalletPostAuth'
import { type EmailVerificationResult, useEmailAuth } from './useEmailAuth'
import { type StoreCredentialsResult, useOAuth } from './useOAuth'

type CallbackResult =
  | (StoreCredentialsResult & {
      type: 'storeCredentials'
    })
  | (EmailVerificationResult & {
      type: 'verifyEmail'
    })

type UseAuthCallbackOptions = {
  enabled?: boolean
} & OpenfortHookOptions<CallbackResult> &
  CreateWalletPostAuthOptions

/**
 * Hook for handling authentication callbacks from OAuth providers and email verification
 *
 * This hook automatically processes authentication callbacks when the page loads with
 * authentication parameters in the URL. It handles both OAuth provider callbacks
 * (with access tokens) and email verification callbacks (with state tokens).
 * The hook extracts parameters from the URL and automatically calls the appropriate
 * authentication methods, then cleans up the URL parameters.
 *
 * @param options - Optional configuration with callback functions and authentication options
 * @returns Current callback processing state and extracted information
 *
 * @example
 * ```tsx
 * const authCallback = useAuthCallback({
 *   enabled: true,
 *   onSuccess: (result) => {
 *     if (result.type === 'storeCredentials') {
 *       console.log('OAuth callback processed:', result.user);
 *     } else if (result.type === 'verifyEmail') {
 *       console.log('Email verified:', result.email);
 *     }
 *   },
 *   onError: (error) => console.error('Callback processing failed:', error),
 *   recoverWalletAutomatically: true,
 * });
 *
 * // Check callback processing state
 * if (authCallback.isLoading) {
 *   console.log('Processing authentication callback...');
 * } else if (authCallback.isError) {
 *   console.error('Callback error:', authCallback.error);
 * } else if (authCallback.isSuccess) {
 *   console.log('Callback processed successfully');
 * }
 *
 * // Access extracted information
 * if (authCallback.provider) {
 *   console.log('Authentication provider:', authCallback.provider);
 * }
 *
 * if (authCallback.email) {
 *   console.log('Email from callback:', authCallback.email);
 * }
 *
 * // Manually trigger verification (if needed)
 * const handleManualVerification = async () => {
 *   await authCallback.verifyEmail({
 *     email: 'user@example.com',
 *     state: 'verification-token',
 *   });
 * };
 * // Manually trigger storing credentials (if needed)
 * const handleManualStoreCredentials = async () => {
 *   await authCallback.storeCredentials({
 *     userId: 'player-id',
 *     token: 'access-token',
 *   });
 * };
 * ```
 */
export const useAuthCallback = ({
  enabled = true, // Automatically handle OAuth and email callback
  ...hookOptions
}: UseAuthCallbackOptions = {}) => {
  const [provider, setProvider] = useState<UIAuthProvider | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  const {
    verifyEmail,
    isSuccess: isEmailSuccess,
    isLoading: isEmailLoading,
    isError: isEmailError,
    error: emailError,
  } = useEmailAuth()

  const {
    storeCredentials,
    isSuccess: isOAuthSuccess,
    isLoading: isOAuthLoading,
    isError: isOAuthError,
    error: oAuthError,
  } = useOAuth()

  const callbackProcessedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (callbackProcessedRef.current) return
    callbackProcessedRef.current = true

    // Parse callback URL (fixes OF-1013 duplicate `?` issue)
    const url = parseCallbackUrl(window.location.href)
    const rawProvider = url.searchParams.get('openfortAuthProvider')
    // Allowlist: UIAuthProvider values + callback-only providers set by buildCallbackUrl
    const validProviders = new Set<string>([
      ...Object.values(UIAuthProvider),
      'email', // set by buildCallbackUrl for email verification
      'password', // set by buildCallbackUrl for password reset
    ])

    if (!rawProvider || !validProviders.has(rawProvider)) {
      return
    }

    // Validated against the allowlist above
    const openfortAuthProvider = rawProvider

    // Suppress Referer SYNCHRONOUSLY — before any async work — so that
    // subresource requests cannot leak access_token to third parties.
    const restoreReferrer = suppressReferrer()

    ;(async () => {
      setProvider(openfortAuthProvider as UIAuthProvider)
      if (openfortAuthProvider === 'email' || openfortAuthProvider === 'password') {
        // Email verification flow
        // The backend verifies the email server-side via /auth/verify-email?token=...
        // and then redirects here. If a `state` token is present we verify client-side
        // as well; otherwise the email is already verified and we just signal success.
        const state = url.searchParams.get('state')
        const email = url.searchParams.get('email')
        const removeParams = () => {
          ;['state', 'openfortAuthProvider', 'email'].forEach((key) => {
            url.searchParams.delete(key)
          })
          window.history.replaceState({}, document.title, url.toString())
          restoreReferrer()
        }

        if (state && email) {
          // State present — verify client-side as well
          const options: OpenfortHookOptions<Omit<CallbackResult, 'type'>> = {
            onSuccess: (data) => {
              hookOptions.onSuccess?.({
                ...data,
                type: 'verifyEmail',
              })
            },
            onError: hookOptions.onError,
            throwOnError: hookOptions.throwOnError,
          }

          await verifyEmail({ email, state, ...options })
          setEmail(email)
          removeParams()
        } else if (email) {
          // No state — backend already verified the email, just signal success
          setEmail(email)
          setAlreadyVerified(true)
          hookOptions.onSuccess?.({
            email,
            type: 'verifyEmail',
          })
          removeParams()
        } else {
          restoreReferrer()
          const err = new OpenfortError('No email found in URL', OpenfortReactErrorType.AUTHENTICATION_ERROR)
          logger.error('No email found in URL')
          hookOptions.onError?.(err)
          if (hookOptions.throwOnError) throw err
          return
        }
      } else {
        const userId = url.searchParams.get('user_id')
        const token = url.searchParams.get('access_token')

        if (!userId || !token) {
          restoreReferrer()
          logger.error(`Missing user id or access token`, {
            hasUserId: !!userId,
            hasToken: !!token,
          })
          const err = new OpenfortError(
            'Missing player id or access token or refresh token',
            OpenfortReactErrorType.AUTHENTICATION_ERROR
          )
          hookOptions.onError?.(err)
          if (hookOptions.throwOnError) throw err

          return
        }

        const removeParams = () => {
          ;['openfortAuthProvider', 'access_token', 'user_id'].forEach((key) => {
            url.searchParams.delete(key)
          })
          window.history.replaceState({}, document.title, url.toString())
          restoreReferrer()
        }

        logger.log('callback', { userId })

        const options: OpenfortHookOptions<Omit<CallbackResult, 'type'>> = {
          onSuccess: (data) => {
            hookOptions.onSuccess?.({
              ...data,
              type: 'storeCredentials',
            })
          },
          onError: hookOptions.onError,
          throwOnError: hookOptions.throwOnError,
        }

        await storeCredentials({
          userId,
          token,
          logoutOnError: hookOptions.logoutOnError,
          recoverWalletAutomatically: hookOptions.recoverWalletAutomatically,
          ...options,
        })
        removeParams()
      }
    })()
  }, []) // intentionally empty — runs once on mount to process the URL callback

  return {
    email,
    provider,
    verifyEmail,
    storeCredentials,
    isLoading: isEmailLoading || isOAuthLoading,
    isError: isEmailError || isOAuthError,
    isSuccess: isEmailSuccess || isOAuthSuccess || alreadyVerified,
    error: emailError || oAuthError,
  }
}
