'use client'

import type { User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { AuthenticationError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { InvalidEmailError, MissingParameterError } from '../../../errors/validation.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { isValidEmail } from '../../../utils/validation.js'
import { onError, onSuccess } from '../hookConsistency.js'
import type { EthereumUserWallet, SolanaUserWallet } from '../walletTypes.js'
import { type BaseFlowState, mapStatus } from './status.js'
import { type CreateWalletPostAuthOptions, useConnectToWalletPostAuth } from './useConnectToWalletPostAuth.js'

type EmailOtpAuthResult = {
  error?: OpenfortError
  user?: User
  wallet?: EthereumUserWallet | SolanaUserWallet
}

type LoginWithEmailOtpOptions = {
  email: string
  otp: string
} & OpenfortHookOptions<EmailOtpAuthResult> &
  CreateWalletPostAuthOptions

type RequestEmailOtpOptions = {
  email: string
} & OpenfortHookOptions<EmailOtpAuthResult> &
  CreateWalletPostAuthOptions

type UseEmailOtpHookOptions = OpenfortHookOptions<EmailOtpAuthResult> & CreateWalletPostAuthOptions

export const useEmailOtpAuth = (hookOptions: UseEmailOtpHookOptions = {}) => {
  const client = useOpenfortCore((s) => s.client)
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const [status, setStatus] = useState<BaseFlowState | { status: 'requesting' }>({
    status: 'idle',
  })
  const reset = useCallback(() => {
    setStatus({
      status: 'idle',
    })
  }, [])

  const { tryUseWallet } = useConnectToWalletPostAuth()

  const signInEmailOtp = useCallback(
    async (options: LoginWithEmailOtpOptions): Promise<EmailOtpAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.email || !options.otp) {
          const error = new MissingParameterError({ params: ['email', 'otp'] })
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailOtpAuthResult>({
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
          return onError<EmailOtpAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        const result = await client.auth.logInWithEmailOtp({
          email: options.email,
          otp: options.otp,
        })

        const { wallet } = await tryUseWallet({
          logoutOnError: options.logoutOnError ?? hookOptions.logoutOnError,
          recoverWalletAutomatically: options.recoverWalletAutomatically ?? hookOptions.recoverWalletAutomatically,
        })

        setStatus({
          status: 'success',
        })
        const user = result.user

        await updateUser()

        return onSuccess<EmailOtpAuthResult>({
          data: { user, wallet },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to login with email OTP.', { cause: toError(e) })

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
    [client, updateUser, hookOptions, tryUseWallet]
  )

  const requestEmailOtp = useCallback(
    async (options: RequestEmailOtpOptions): Promise<EmailOtpAuthResult> => {
      try {
        setStatus({
          status: 'requesting',
        })

        if (!options.email) {
          const error = new MissingParameterError({ params: ['email'] })
          setStatus({
            status: 'error',
            error,
          })
          return onError<EmailOtpAuthResult>({
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
          return onError<EmailOtpAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.auth.requestEmailOtp({
          email: options.email,
        })

        setStatus({
          status: 'success',
        })
        return onSuccess<EmailOtpAuthResult>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new AuthenticationError('Failed to request email OTP.', { cause: toError(e) })

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

  return {
    signInEmailOtp,
    requestEmailOtp,

    reset,
    isRequesting: status.status === 'requesting',
    ...mapStatus(status),
    isAwaitingInput: status.status === 'awaiting-input',
  }
}
