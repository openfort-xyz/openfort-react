'use client'

import type { User } from '@openfort/openfort-js'
import { useCallback, useRef, useState } from 'react'
import { AuthenticationError } from '../../../errors/auth.js'
import { type OpenfortError, toError } from '../../../errors/base.js'
import { MissingParameterError } from '../../../errors/validation.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { authTransitionSupersededResult, startLocalAuthTransition } from '../../../shared/utils/authTransitionQueue.js'
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

const DEFAULT_PHONE_OTP_HOOK_OPTIONS: UsePhoneHookOptions = {}

export const usePhoneOtpAuth = (hookOptions: UsePhoneHookOptions = DEFAULT_PHONE_OTP_HOOK_OPTIONS) => {
  const client = useOpenfortCore((s) => s.client)
  const { captureAuthSession, startAuthenticatedMutation, startAuthTransition } = useAuthTransitions()
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const [status, setStatus] = useState<BaseFlowState | { status: 'requesting' }>({
    status: 'idle',
  })
  const authInvocationRef = useRef(0)
  const reset = useCallback(() => {
    setStatus({
      status: 'idle',
    })
  }, [])

  const { tryUseWallet } = useConnectToWalletPostAuth()

  const logInWithPhoneOtp = useCallback(
    async (options: LoginWithPhoneOtpOptions): Promise<PhoneAuthResult> => {
      let settleStale: (() => boolean) | undefined
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.phoneNumber || !options.otp) {
          const error = new MissingParameterError({ params: ['phone', 'otp'] })
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

        const transition = startLocalAuthTransition(
          startAuthTransition,
          authInvocationRef,
          () =>
            client.auth.logInWithPhoneOtp({
              phoneNumber: options.phoneNumber,
              otp: options.otp,
            }),
          () => setStatus({ status: 'idle' })
        )
        settleStale = transition.settleStale
        const result = await transition.result
        if (settleStale()) return authTransitionSupersededResult()

        const user = result.user
        await updateUser(user)
        if (settleStale()) return authTransitionSupersededResult()

        const { wallet } = await tryUseWallet({
          logoutOnError: options.logoutOnError ?? hookOptions.logoutOnError,
          recoverWalletAutomatically: options.recoverWalletAutomatically ?? hookOptions.recoverWalletAutomatically,
        })
        if (settleStale()) return authTransitionSupersededResult()

        setStatus({
          status: 'success',
        })
        return onSuccess<PhoneAuthResult>({
          data: { user, wallet },
          hookOptions,
          options,
        })
      } catch (e) {
        if (settleStale?.()) return authTransitionSupersededResult()
        const error = new AuthenticationError('Failed to login with phone OTP.', { cause: toError(e) })

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
    [client, startAuthTransition, updateUser, hookOptions, tryUseWallet]
  )

  const requestPhoneOtp = useCallback(
    async (options: RequestPhoneOtpOptions): Promise<PhoneAuthResult> => {
      try {
        setStatus({
          status: 'requesting',
        })

        if (!options.phoneNumber) {
          const error = new MissingParameterError({ params: ['phoneNumber'] })
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
        const error = new AuthenticationError('Failed to request phone OTP.', { cause: toError(e) })

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
      let settleStale: (() => boolean) | undefined
      try {
        setStatus({
          status: 'loading',
        })

        if (!options.phoneNumber || !options.otp) {
          const error = new MissingParameterError({ params: ['phone', 'otp'] })
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

        const session = captureAuthSession()
        const transition = startLocalAuthTransition(
          startAuthenticatedMutation,
          authInvocationRef,
          () =>
            client.auth.linkPhoneOtp({
              phoneNumber: options.phoneNumber,
              otp: options.otp,
            }),
          () => setStatus({ status: 'idle' })
        )
        settleStale = () => {
          const sessionIsStale = !session.isCurrent()
          const transitionIsStale = transition.settleStale()
          return sessionIsStale || transitionIsStale
        }
        const result = await transition.result
        if (settleStale()) return authTransitionSupersededResult()
        const user = result.user

        await updateUser()
        if (settleStale()) return authTransitionSupersededResult()

        setStatus({
          status: 'success',
        })

        return onSuccess<PhoneAuthResult>({
          data: { user },
          hookOptions,
          options,
        })
      } catch (e) {
        if (settleStale?.()) return authTransitionSupersededResult()
        const error = new AuthenticationError('Failed to link phone OTP.', { cause: toError(e) })

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
    [captureAuthSession, client, startAuthenticatedMutation, updateUser, hookOptions]
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
