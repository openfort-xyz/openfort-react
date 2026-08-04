'use client'

import { useEffect, useRef, useState } from 'react'
import { UIAuthProvider } from '../../../components/Openfort/types.js'
import { AuthenticationError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { logger } from '../../../utils/logger.js'
import { parseCallbackUrl, suppressReferrer } from '../../../utils/urlSecurity.js'
import { notifyHookCallback } from '../hookConsistency.js'
import type { CreateWalletPostAuthOptions } from './useConnectToWalletPostAuth.js'
import { type EmailVerificationResult, useEmailAuth } from './useEmailAuth.js'
import { type StoreCredentialsResult, useOAuth } from './useOAuth.js'

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
 * The hook captures and removes callback parameters from the URL before it calls the
 * appropriate authentication method.
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
  const [callbackError, setCallbackError] = useState<OpenfortError | null>(null)
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

  // The callback effect below re-runs only when `enabled` flips, so it reads the handlers and
  // consumer options through this ref to always invoke the current ones. Depending on their
  // identities directly would re-run the effect on every render for no gain: `callbackProcessedRef`
  // makes every run after the first a no-op, and Openfort-marked URL parameters are consumed
  // exactly once.
  const latestRef = useRef({ verifyEmail, storeCredentials, hookOptions })
  useEffect(() => {
    latestRef.current = { verifyEmail, storeCredentials, hookOptions }
  })

  useEffect(() => {
    if (!enabled) return
    if (callbackProcessedRef.current) return
    callbackProcessedRef.current = true

    const {
      verifyEmail: runVerifyEmail,
      storeCredentials: runStoreCredentials,
      hookOptions: callbacks,
    } = latestRef.current

    const url = parseCallbackUrl(window.location.href)
    const rawProvider = url.searchParams.get('openfortAuthProvider')
    if (rawProvider === null) return
    setCallbackError(null)

    const restoreReferrer = suppressReferrer()
    const state = url.searchParams.get('state')
    const callbackEmail = url.searchParams.get('email')
    const userId = url.searchParams.get('user_id')
    const token = url.searchParams.get('access_token')

    try {
      for (const key of [
        'openfortAuthProvider',
        'access_token',
        'refresh_token',
        'user_id',
        'player_id',
        'state',
        'email',
      ]) {
        url.searchParams.delete(key)
      }
      window.history.replaceState(window.history.state, document.title, url.toString())
    } finally {
      restoreReferrer()
    }

    const validProviders = new Set<string>([...Object.values(UIAuthProvider), 'email', 'password'])
    const reportCallbackError = (error: OpenfortError) => {
      setCallbackError(error)
      notifyHookCallback(callbacks.onError, error, 'onError')
    }

    if (!rawProvider || !validProviders.has(rawProvider)) {
      reportCallbackError(new AuthenticationError(`Unsupported authentication callback provider "${rawProvider}".`))
      return
    }

    const openfortAuthProvider = rawProvider

    ;(async () => {
      setProvider(openfortAuthProvider as UIAuthProvider)
      if (openfortAuthProvider === 'email' || openfortAuthProvider === 'password') {
        // Email verification flow
        // The backend verifies the email server-side via /auth/verify-email?token=...
        // and then redirects here. If a `state` token is present we verify client-side
        // as well; otherwise the email is already verified and we just signal success.
        if (state && callbackEmail) {
          // State present — verify client-side as well
          const options: OpenfortHookOptions<Omit<CallbackResult, 'type'>> = {
            onSuccess: (data) => {
              notifyHookCallback(callbacks.onSuccess, { ...data, type: 'verifyEmail' }, 'onSuccess')
            },
            onError: callbacks.onError,
          }

          await runVerifyEmail({ email: callbackEmail, state, ...options })
          setEmail(callbackEmail)
        } else if (callbackEmail) {
          // No state — backend already verified the email, just signal success
          setEmail(callbackEmail)
          setAlreadyVerified(true)
          notifyHookCallback(
            callbacks.onSuccess,
            {
              email: callbackEmail,
              type: 'verifyEmail',
            },
            'onSuccess'
          )
        } else {
          const err = new AuthenticationError('No email found in URL.')
          logger.error('No email found in URL')
          reportCallbackError(err)
          return
        }
      } else {
        if (!userId || !token) {
          logger.error(`Missing user id or access token`, {
            hasUserId: !!userId,
            hasToken: !!token,
          })
          const err = new AuthenticationError('Missing user id or access token.')
          reportCallbackError(err)
          return
        }

        logger.log('Processing authentication callback')

        const options: OpenfortHookOptions<Omit<CallbackResult, 'type'>> = {
          onSuccess: (data) => {
            notifyHookCallback(callbacks.onSuccess, { ...data, type: 'storeCredentials' }, 'onSuccess')
          },
          onError: callbacks.onError,
        }

        await runStoreCredentials({
          userId,
          token,
          logoutOnError: callbacks.logoutOnError,
          recoverWalletAutomatically: callbacks.recoverWalletAutomatically,
          ...options,
        })
      }
    })().catch((error) => {
      const callbackFailure = new AuthenticationError('Failed to process authentication callback.', {
        cause: toError(error),
      })
      logger.error('Failed to process authentication callback', callbackFailure)
      reportCallbackError(callbackFailure)
    })
  }, [enabled])

  return {
    email,
    provider,
    verifyEmail,
    storeCredentials,
    isLoading: isEmailLoading || isOAuthLoading,
    isError: callbackError !== null || isEmailError || isOAuthError,
    isSuccess: isEmailSuccess || isOAuthSuccess || alreadyVerified,
    error: callbackError || emailError || oAuthError,
  }
}
