'use client'

import type { User } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import { OpenfortError, OpenfortReactErrorType } from '../../../core/errors.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../../types.js'
import { onError, onSuccess } from '../hookConsistency.js'
import type { EthereumUserWallet, SolanaUserWallet } from '../walletTypes.js'
import { type BaseFlowState, mapStatus } from './status.js'
import { type CreateWalletPostAuthOptions, useConnectToWalletPostAuth } from './useConnectToWalletPostAuth.js'

type PhoneAuthResult = {
  error?: OpenfortError
  user?: User
  wallet?: EthereumUserWallet | SolanaUserWallet
}

type LoginWithPhoneOtpOptions = {
  phoneNumber: string
  otp: string
} & OpenfortHookOptions<PhoneAuthResult> &
  CreateWalletPostAuthOptions

type RequestPhoneOtpOptions = {
  phoneNumber: string
} & OpenfortHookOptions<PhoneAuthResult> &
  CreateWalletPostAuthOptions

type UsePhoneHookOptions = OpenfortHookOptions<PhoneAuthResult> & CreateWalletPostAuthOptions

export const usePhoneOtpAuth = (hookOptions: UsePhoneHookOptions = {}) => {
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

  const logInWithPhoneOtp = useCallback(
    async (options: LoginWithPhoneOtpOptions): Promise<PhoneAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.phoneNumber || !options.otp) {
          const error = new OpenfortError('Phone and OTP are required', OpenfortReactErrorType.VALIDATION_ERROR)
          setStatus({
            status: 'error',
            error,
          })
          return onError<PhoneAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        const result = await client.auth.logInWithPhoneOtp({
          phoneNumber: options.phoneNumber,
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

        return onSuccess<PhoneAuthResult>({
          data: { user, wallet },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new OpenfortError('Failed to login with phone OTP', OpenfortReactErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })

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

  const requestPhoneOtp = useCallback(
    async (options: RequestPhoneOtpOptions): Promise<PhoneAuthResult> => {
      try {
        setStatus({
          status: 'requesting',
        })

        if (!options.phoneNumber) {
          const error = new OpenfortError('Phone number is required', OpenfortReactErrorType.VALIDATION_ERROR)
          setStatus({
            status: 'error',
            error,
          })
          return onError<PhoneAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        await client.auth.requestPhoneOtp({
          phoneNumber: options.phoneNumber,
        })

        setStatus({
          status: 'idle',
        })
        return onSuccess<PhoneAuthResult>({
          data: {},
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new OpenfortError('Failed to request phone OTP', OpenfortReactErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })

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

  const linkPhoneOtp = useCallback(
    async (options: LoginWithPhoneOtpOptions): Promise<PhoneAuthResult> => {
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.phoneNumber || !options.otp) {
          const error = new OpenfortError('Phone and OTP are required', OpenfortReactErrorType.VALIDATION_ERROR)
          setStatus({
            status: 'error',
            error,
          })
          return onError<PhoneAuthResult>({
            hookOptions,
            options,
            error,
          })
        }

        const result = await client.auth.linkPhoneOtp({
          phoneNumber: options.phoneNumber,
          otp: options.otp,
        })

        setStatus({
          status: 'success',
        })
        const user = result.user

        await updateUser()

        return onSuccess<PhoneAuthResult>({
          data: { user },
          hookOptions,
          options,
        })
      } catch (e) {
        const error = new OpenfortError('Failed to link phone OTP', OpenfortReactErrorType.AUTHENTICATION_ERROR, {
          error: e,
        })

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
    [client, updateUser, hookOptions]
  )

  return {
    logInWithPhoneOtp,
    requestPhoneOtp,
    linkPhoneOtp,

    reset,
    isRequesting: status.status === 'requesting',
    ...mapStatus(status),
    isAwaitingInput: status.status === 'awaiting-input',
  }
}
