'use client'

import type { User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { AuthenticationError, NotAuthenticatedError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { InvalidEmailError, MissingParameterError } from '../../../errors/validation.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { logger } from '../../../utils/logger.js'
import { isValidEmail } from '../../../utils/validation.js'
import { onError, onSuccess } from '../hookConsistency.js'
import { useUI } from '../useUI.js'
import type { EthereumUserWallet, SolanaUserWallet } from '../walletTypes.js'
import { buildCallbackUrl } from './requestEmailVerification.js'
import { type BaseFlowState, mapStatus } from './status.js'
import { type CreateWalletPostAuthOptions, useConnectToWalletPostAuth } from './useConnectToWalletPostAuth.js'

type EmailAuthResult = {
  error?: OpenfortError
  user?: User
  wallet?: EthereumUserWallet | SolanaUserWallet
  requiresEmailVerification?: boolean
}

type SignInEmailOptions = {
  email: string
  password: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult> &
  CreateWalletPostAuthOptions

type SignUpEmailOptions = {
  email: string
  password: string
  name?: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult> &
  CreateWalletPostAuthOptions

type RequestResetPasswordOptions = {
  email: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult>

type ResetPasswordOptions = {
  email: string
  password: string
  state: string
} & OpenfortHookOptions<EmailAuthResult>

type LinkEmailOptions = {
  email: string
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult>

type VerifyEmailOptions = {
  email: string
  state: string
} & OpenfortHookOptions<EmailVerificationResult>

export type EmailVerificationResult = {
  email?: string
  error?: OpenfortError
}

type UseEmailHookOptions = {
  emailVerificationRedirectTo?: string
} & OpenfortHookOptions<EmailAuthResult | EmailVerificationResult> &
  CreateWalletPostAuthOptions

/**
 * Hook for email-based authentication operations
 *
 * This hook manages email authentication flows including sign-in, sign-up, password reset,
 * email verification, and email linking. It handles both password and passwordless authentication
 * and automatically manages wallet connection after successful authentication.
 *
 * @param hookOptions - Optional configuration with callback functions and authentication options
 * @returns Current authentication state with email auth actions
 *
 * @example
 * ```tsx
 * const emailAuth = useEmailAuth({
 *   onSignInEmailSuccess: (result) => console.log('Signed in:', result.user),
 *   onSignInEmailError: (error) => console.error('Sign-in failed:', error),
 *   emailVerificationRedirectTo: 'https://yourapp.com/verify',
 *   recoverWalletAutomatically: true,
 * });
 *
 * // Sign up with email and password
 * await emailAuth.signUpEmail({
 *   email: 'user@example.com',
 *   password: 'securePassword123',
 *   name: 'John Doe',
 * });
 *
 * // Sign in with email and password
 * await emailAuth.signInEmail({
 *   email: 'user@example.com',
 *   password: 'securePassword123',
 * });
 *
 * // Request password reset
 * await emailAuth.requestResetPassword({
 *   email: 'user@example.com',
 * });
 *
 * // Reset password with state token
 * await emailAuth.resetPassword({
 *   email: 'user@example.com',
 *   password: 'newPassword123',
 *   state: 'reset-token-from-email',
 * });
 *
 * // Verify email with state token
 * await emailAuth.verifyEmail({
 *   email: 'user@example.com',
 *   state: 'verification-token-from-email',
 * });
 *
 * // Link email to existing authenticated account
 * await emailAuth.linkEmail({
 *   email: 'secondary@example.com',
 *   password: 'password123',
 * });
 *
 * // Check authentication state
 * if (emailAuth.isLoading) {
 *   console.log('Processing authentication...');
 * } else if (emailAuth.isError) {
 *   console.error('Authentication error:', emailAuth.error);
 * } else if (emailAuth.isSuccess) {
 *   console.log('Authentication successful');
 * }
 *
 * // Handle email verification requirement
 * if (emailAuth.requiresEmailVerification) {
 *   console.log('Please check your email to verify your account');
 * }
 * ```
 */
export const useEmailAuth = (hookOptions: UseEmailHookOptions = {}) => {
  const { client, updateUser } = useOpenfortCore()
  const { isOpen } = useUI()
  const [requiresEmailVerification, setRequiresEmailVerification] = useState(false)
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const reset = useCallback(() => {
    setStatus({
      status: 'idle',
    })
    setRequiresEmailVerification(false)
  }, [])

  const { tryUseWallet } = useConnectToWalletPostAuth()

  const signInEmail = useCallback(
    async (options: SignInEmailOptions): Promise<EmailAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })
        setRequiresEmailVerification(false)

        if (!options.email || !options.password) {
          const error = new MissingParameterError({ params: ['email', 'password'] })
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        if (!isValidEmail(options.email)) {
          const error = new InvalidEmailError()
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        const result = await client.auth.logInWithEmailPassword({
          email: options.email,
          password: options.password,
        })

        if ('action' in result) {
          setStatus({
            status: 'awaiting-input',
          })

          client.auth.requestEmailVerification({
            email: options.email,
            redirectUrl: buildCallbackUrl({
              email: options.email,
              callbackUrl: options.emailVerificationRedirectTo ?? hookOptions?.emailVerificationRedirectTo,
              provider: 'email',
              isOpen,
            }),
          })

          setRequiresEmailVerification(true)
          return onSuccess<EmailAuthResult>({
            data: { requiresEmailVerification: true },
            hookOptions,
            options,
          })
        } else {
          const { wallet } = await tryUseWallet({
            logoutOnError: options.logoutOnError ?? hookOptions.logoutOnError,
            recoverWalletAutomatically: options.recoverWalletAutomatically ?? hookOptions.recoverWalletAutomatically,
          })

          setStatus({
            status: 'success',
          })
          const user = result.user

          await updateUser()

          return onSuccess<EmailAuthResult>({
            data: { user, wallet },
            hookOptions,
            options,
          })
        }
      } catch (e) {
        const error = new AuthenticationError('Failed to login with email and password.', { cause: toError(e) })

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
    [client, updateUser, hookOptions, isOpen, tryUseWallet]
  )

  const requestResetPassword = useCallback(
    async (options: RequestResetPasswordOptions): Promise<EmailAuthResult> => {
      try {
        if (!isValidEmail(options.email)) {
          const error = new InvalidEmailError()
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        setStatus({
          status: 'loading',
        })
        setRequiresEmailVerification(false)

        await client.auth.requestResetPassword({
          email: options.email,
          redirectUrl: buildCallbackUrl({
            email: options.email,
            callbackUrl: options.emailVerificationRedirectTo ?? hookOptions?.emailVerificationRedirectTo,
            provider: 'password',
            isOpen,
          }),
        })

        setStatus({
          status: 'success',
        })

        setRequiresEmailVerification(true)
        return onSuccess<EmailAuthResult>({
          data: { requiresEmailVerification: true },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to reset password.', { cause: toError(e) })
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

  const resetPassword = useCallback(
    async (options: ResetPasswordOptions): Promise<EmailAuthResult> => {
      try {
        if (!isValidEmail(options.email)) {
          const error = new InvalidEmailError()
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        setStatus({
          status: 'loading',
        })
        setRequiresEmailVerification(false)

        await client.auth.resetPassword({
          password: options.password,
          token: options.state,
        })

        setStatus({
          status: 'success',
        })

        setRequiresEmailVerification(true)
        return onSuccess<EmailAuthResult>({
          data: { requiresEmailVerification: true },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to reset password.', { cause: toError(e) })
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
    [client, hookOptions]
  )

  const signUpEmail = useCallback(
    async (options: SignUpEmailOptions): Promise<EmailAuthResult> => {
      try {
        if (!options.email || !options.password) {
          const error = new MissingParameterError({ params: ['email', 'password'] })
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        if (!isValidEmail(options.email)) {
          const error = new InvalidEmailError()
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        setStatus({
          status: 'loading',
        })
        setRequiresEmailVerification(false)

        const result = await client.auth.signUpWithEmailPassword({
          email: options.email,
          password: options.password,
          callbackURL: buildCallbackUrl({
            email: options.email,
            callbackUrl: options.emailVerificationRedirectTo ?? hookOptions?.emailVerificationRedirectTo,
            provider: 'email',
            isOpen,
          }),
          ...(options.name && { name: options.name }),
        })

        // API returns token when auth succeeds immediately; otherwise requires email verification
        if ('token' in result && result.token != null) {
          const { wallet } = await tryUseWallet({
            logoutOnError: options.logoutOnError ?? hookOptions.logoutOnError,
            recoverWalletAutomatically: options.recoverWalletAutomatically ?? hookOptions.recoverWalletAutomatically,
          })

          setStatus({
            status: 'success',
          })
          const user = result.user
          await updateUser(user)

          return onSuccess<EmailAuthResult>({
            data: { user, wallet },
            hookOptions,
            options,
          })
        } else {
          setStatus({
            status: 'awaiting-input',
          })

          setRequiresEmailVerification(true)
          return onSuccess<EmailAuthResult>({
            data: { requiresEmailVerification: true },
            hookOptions,
            options,
          })
        }
      } catch (e) {
        const error = new AuthenticationError('Failed to login with email and password.', { cause: toError(e) })
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
    [client, updateUser, hookOptions, isOpen, tryUseWallet]
  )

  const linkEmail = useCallback(
    async (options: LinkEmailOptions): Promise<EmailAuthResult> => {
      try {
        if (!isValidEmail(options.email)) {
          const error = new InvalidEmailError()
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.validateAndRefreshToken()
        const authToken = await client.getAccessToken()
        if (!authToken) {
          logger.log('No token found')
          const error = new NotAuthenticatedError('No token found.')
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.auth.addEmail({
          // name: options.name || '',
          email: options.email,
          // password: options.password,
          // method: 'password',
          callbackURL: buildCallbackUrl({
            callbackUrl: options.emailVerificationRedirectTo ?? hookOptions?.emailVerificationRedirectTo,
            email: options.email,
            provider: 'email',
            isOpen,
          }),
        })
        logger.log('Email linked successfully')

        return onSuccess<EmailAuthResult>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to link email.', { cause: toError(e) })

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

  const verifyEmail = useCallback(
    async (options: VerifyEmailOptions): Promise<EmailVerificationResult> => {
      setStatus({
        status: 'loading',
      })

      try {
        if (!isValidEmail(options.email)) {
          const error = new InvalidEmailError()
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.auth.verifyEmail({
          token: options.state,
        })
        setStatus({
          status: 'success',
        })

        return onSuccess({
          hookOptions,
          options,
          data: {
            email: options.email,
          },
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to verify email.', { cause: toError(e) })

        setStatus({
          status: 'error',
          error,
        })

        logger.error('Error verifying email', e)

        return onError({
          hookOptions,
          options,
          error,
        })
      }
    },
    [client, hookOptions]
  )

  return {
    signInEmail,
    signUpEmail,
    verifyEmail,
    linkEmail,
    requestResetPassword,
    resetPassword,
    reset,
    ...mapStatus(status),
    requiresEmailVerification,
    isAwaitingInput: status.status === 'awaiting-input',
  }
}
